import { ApiError } from '@/services/api';
import { SocketError } from '@/services/socket';

// Error types
export const ErrorType = {
  NETWORK: 'NETWORK',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export interface ProcessedError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  statusCode?: number;
  isRetryable: boolean;
  userMessage: string;
}

// Error processing function
export function processError(error: unknown): ProcessedError {
  // Handle API errors
  if (error instanceof ApiError) {
    return {
      type: getErrorTypeFromStatus(error.status),
      message: error.message,
      originalError: error,
      statusCode: error.status,
      isRetryable: error.status >= 500 || error.status === 429,
      userMessage: getUserFriendlyMessage(error.status, error.message),
    };
  }

  // Handle Socket errors
  if (error instanceof SocketError) {
    return {
      type: ErrorType.NETWORK,
      message: error.message,
      originalError: error,
      isRetryable: true,
      userMessage: `Connection error: ${error.message}`,
    };
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    return {
      type: ErrorType.CLIENT,
      message: error.message,
      originalError: error,
      isRetryable: false,
      userMessage: error.message,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: ErrorType.UNKNOWN,
      message: error,
      isRetryable: false,
      userMessage: error,
    };
  }

  // Handle unknown error types
  return {
    type: ErrorType.UNKNOWN,
    message: 'An unexpected error occurred',
    isRetryable: false,
    userMessage: 'Something went wrong. Please try again.',
  };
}

function getErrorTypeFromStatus(status: number): ErrorType {
  switch (true) {
    case status === 401:
      return ErrorType.AUTHENTICATION;
    case status === 403:
      return ErrorType.AUTHORIZATION;
    case status === 404:
      return ErrorType.NOT_FOUND;
    case status >= 400 && status < 500:
      return ErrorType.VALIDATION;
    case status >= 500:
      return ErrorType.SERVER;
    default:
      return ErrorType.NETWORK;
  }
}

function getUserFriendlyMessage(status: number, originalMessage: string): string {
  const defaultMessages = {
    400: 'Invalid request. Please check your input.',
    401: 'Please log in to continue.',
    403: 'You don\'t have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This action conflicts with existing data.',
    422: 'Please check your input and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Server error. Please try again later.',
    502: 'Service temporarily unavailable.',
    503: 'Service temporarily unavailable.',
  };

  const defaultMessage = defaultMessages[status as keyof typeof defaultMessages];
  
  // Use the original message if it's user-friendly, otherwise use default
  if (originalMessage && !originalMessage.toLowerCase().includes('internal') && 
      !originalMessage.toLowerCase().includes('error') && 
      originalMessage.length < 100) {
    return originalMessage;
  }
  
  return defaultMessage || 'An error occurred. Please try again.';
}

// Error logging
export function logError(error: ProcessedError, context?: string): void {
  const logData = {
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.error('Application Error:', logData);

  // In production, you might want to send this to an error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: sendToErrorService(logData);
  }
}

// Retry utility for retryable errors
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
  backoff: number = 2
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const processedError = processError(error);
      
      // Don't retry if error is not retryable or we're on the last attempt
      if (!processedError.isRetryable || attempt === maxAttempts) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoff;
    }
  }
  
  throw lastError;
}

// Error boundary utility
export function createErrorBoundaryHandler(
  onError?: (error: ProcessedError) => void
) {
  return (error: Error, _errorInfo: { componentStack: string }) => {
    const processedError = processError(error);
    logError(processedError, 'React Error Boundary');
    onError?.(processedError);
  };
}

// Toast notification helpers
export function getErrorToastConfig(error: ProcessedError) {
  return {
    title: getErrorTitle(error.type),
    description: error.userMessage,
    status: 'error' as const,
    duration: error.isRetryable ? 5000 : 3000,
    isClosable: true,
  };
}

function getErrorTitle(type: ErrorType): string {
  const titles = {
    [ErrorType.NETWORK]: 'Connection Error',
    [ErrorType.AUTHENTICATION]: 'Authentication Required',
    [ErrorType.AUTHORIZATION]: 'Permission Denied',
    [ErrorType.VALIDATION]: 'Invalid Input',
    [ErrorType.NOT_FOUND]: 'Not Found',
    [ErrorType.SERVER]: 'Server Error',
    [ErrorType.CLIENT]: 'Error',
    [ErrorType.UNKNOWN]: 'Unexpected Error',
  };
  
  return titles[type];
}