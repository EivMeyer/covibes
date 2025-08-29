/**
 * Express.js TypeScript Architecture
 * 
 * Provides type-safe authentication for Express routes with exactOptionalPropertyTypes support
 * Uses proper Express module augmentation to avoid middleware compatibility issues
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

// Import the module augmentation to ensure it's loaded

export interface JWTUser {
  userId: string;
  teamId: string;
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticated(req: Request): req is Request & { 
  userId: string; 
  user: JWTUser; 
} {
  return !!(req.userId && req.user && req.user.userId && req.user.teamId);
}

/**
 * Authenticated request handler type
 * Uses Express.Request (augmented) instead of custom interface
 */
export type AuthRequestHandler = RequestHandler;

/**
 * Helper to assert authentication status in route handlers
 */
export function requireAuth(req: Request): asserts req is Request & { 
  userId: string; 
  user: JWTUser; 
} {
  if (!req.userId) {
    throw new Error('User not authenticated: userId missing');
  }
  if (!req.user || !req.user.userId || !req.user.teamId) {
    throw new Error('User not authenticated: user object missing');
  }
}

/**
 * Helper to get authenticated user info safely
 */
export function getAuthUser(req: Request): JWTUser | null {
  if (req.userId && req.user && req.user.userId && req.user.teamId) {
    return {
      userId: req.user.userId,
      teamId: req.user.teamId
    };
  }
  return null;
}

/**
 * Create a type-safe authenticated route handler
 * No wrapper needed - uses proper Express module augmentation
 */
export function createAuthHandler(
  handler: (req: Request, res: Response, next?: NextFunction) => Promise<Response | void> | Response | void
): RequestHandler {
  return handler as RequestHandler;
}