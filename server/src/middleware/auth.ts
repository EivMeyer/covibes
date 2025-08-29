/**
 * JWT Authentication Middleware
 * 
 * Validates JWT tokens for protected routes
 * Uses Express module augmentation for type safety
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTUser } from '../types/express.js';

// Import module augmentation

export interface JWTPayload {
  userId: string;
  teamId: string;
  iat?: number;
  exp?: number;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  console.log('Auth middleware called for:', req.path);
  const authHeader = req.headers['authorization'];
  console.log('Auth header:', authHeader ? `Bearer ${authHeader.split(' ')[1]?.substring(0, 20)}...` : 'None');
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // For preview routes, also check query parameter (needed for iframe authentication)
  // Check both original URL and current path since preview routes get proxied
  const originalUrl = req.originalUrl || req.url;
  const isPreviewRoute = req.path.startsWith('/api/preview/') || originalUrl.includes('/api/preview/') || req.query['token'];
  
  if (!token && isPreviewRoute && req.query['token']) {
    token = req.query['token'] as string;
  }

  if (!token) {
    console.log('❌ No token provided for:', req.path);
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      console.error('❌ JWT verification failed:', err.message);
      console.error('❌ Token length:', token?.length);
      console.error('❌ Token starts with:', token?.substring(0, 50));
      console.error('❌ JWT_SECRET length:', JWT_SECRET?.length);
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    console.log('JWT verified successfully, userId:', decoded.userId);
    req.userId = decoded.userId;
    // Ensure decoded payload has the required fields
    if (decoded && decoded.userId && decoded.teamId) {
      req.user = {
        userId: decoded.userId,
        teamId: decoded.teamId
      } as JWTUser;
    }
    next();
  });
};