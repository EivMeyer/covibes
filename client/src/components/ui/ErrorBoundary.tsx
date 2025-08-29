import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | undefined;
  errorInfo?: ErrorInfo | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-red-400">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-400">
                We encountered an unexpected error. Don't worry, we've logged the issue.
              </p>
            </div>

            {/* Error details (only in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-gray-800 border border-gray-700 rounded-lg p-4">
                <summary className="text-sm font-medium text-red-400 cursor-pointer mb-2">
                  Error Details (Development)
                </summary>
                <div className="text-xs font-mono text-gray-300 space-y-2">
                  <div>
                    <strong className="text-red-400">Error:</strong>
                    <div className="bg-gray-900 p-2 rounded mt-1">
                      {this.state.error.message}
                    </div>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong className="text-red-400">Stack:</strong>
                      <pre className="bg-gray-900 p-2 rounded mt-1 overflow-auto text-xs">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            <div className="text-xs text-gray-500">
              <p>If this problem persists, please contact support.</p>
              <p className="mt-1">Error ID: {Date.now()}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simpler error fallback for smaller components
export const SimpleErrorFallback: React.FC<{ 
  error?: Error; 
  resetError?: () => void;
  message?: string;
}> = ({ 
  error, 
  resetError, 
  message = "Something went wrong" 
}) => (
  <div className="flex items-center justify-center p-8 text-center">
    <div className="space-y-4">
      <div className="text-red-400">
        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <div>
        <p className="text-red-400 font-medium">{message}</p>
        {error && process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-500 mt-1 font-mono">
            {error.message}
          </p>
        )}
      </div>

      {resetError && (
        <button
          onClick={resetError}
          className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);