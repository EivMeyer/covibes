/**
 * Express Request extension for authentication
 * 
 * Properly extends Express Request interface to include authentication properties
 * Resolves exactOptionalPropertyTypes compatibility issues with strict TypeScript
 */

declare global {
  namespace Express {
    interface Request {
      userId?: string | undefined;
      user?: {
        userId: string;
        teamId: string;
      } | undefined;
    }
    
    interface User {
      userId: string;
      teamId: string;
    }
  }
}

export {};