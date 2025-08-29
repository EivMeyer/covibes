/**
 * JWT Authentication Middleware
 * 
 * Validates JWT tokens for protected routes and extracts user information
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request interface to include user data
interface AuthRequest extends Request {
  userId?: string;
  user?: {
    userId: string;
    teamId: string;
    iat?: number;
    exp?: number;
  };
}

// JWT token payload interface
interface JWTPayload {
  userId: string;
  teamId: string;
  iat?: number;
  exp?: number;
}

/**
 * Authentication middleware that validates JWT tokens
 * Expects Authorization header with Bearer token format
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer TOKEN"

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Add user information to request object
    req.userId = decoded.userId;
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(403).json({ error: 'Token has expired' });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    
    res.status(403).json({ error: 'Token verification failed' });
    return;
  }
};

export default authenticateToken;