/**
 * Authentication Middleware Unit Tests
 * Tests JWT token validation and user authentication
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../middleware/auth';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Create mock request/response objects
const createMockRequest = (headers: Record<string, string> = {}): Request => ({
  headers,
  body: {},
  params: {},
  query: {},
} as Request);

const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Authentication Middleware', () => {
  const JWT_SECRET = 'test-jwt-secret';
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    const validPayload = {
      userId: 'user-123',
      teamId: 'team-456',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should authenticate valid token and call next', () => {
      const req = createMockRequest({
        authorization: 'Bearer valid-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockReturnValue(validPayload);

      authenticateToken(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', JWT_SECRET);
      expect((req as any).userId).toBe('user-123');
      expect((req as any).user).toEqual(validPayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
      expect(mockJwt.verify).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header has no token', () => {
      const req = createMockRequest({
        authorization: 'Bearer'
      });
      const res = createMockResponse();
      const next = createMockNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when authorization header is malformed', () => {
      const req = createMockRequest({
        authorization: 'InvalidFormat token-here'
      });
      const res = createMockResponse();
      const next = createMockNext();

      const invalidError = new jwt.JsonWebTokenError('Invalid token');
      mockJwt.verify.mockImplementation(() => {
        throw invalidError;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for expired token', () => {
      const req = createMockRequest({
        authorization: 'Bearer expired-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      const expiredError = new jwt.TokenExpiredError('Token expired', new Date());
      mockJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token has expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for invalid token format', () => {
      const req = createMockRequest({
        authorization: 'Bearer invalid-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      const invalidError = new jwt.JsonWebTokenError('Invalid token');
      mockJwt.verify.mockImplementation(() => {
        throw invalidError;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for general verification errors', () => {
      const req = createMockRequest({
        authorization: 'Bearer problematic-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockImplementation(() => {
        throw new Error('General verification error');
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token verification failed' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use fallback secret when JWT_SECRET not set', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const req = createMockRequest({
        authorization: 'Bearer valid-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockReturnValue(validPayload);

      authenticateToken(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'fallback-secret-key');
      
      process.env.JWT_SECRET = originalSecret;
    });

    it('should handle different token formats in Authorization header', () => {
      const testCases = [
        {
          header: 'Bearer token123',
          expectedToken: 'token123'
        },
        {
          header: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.signature',
          expectedToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.signature'
        },
        {
          header: 'Bearer token-with-dashes',
          expectedToken: 'token-with-dashes'
        }
      ];

      testCases.forEach(({ header, expectedToken }) => {
        jest.clearAllMocks();
        
        const req = createMockRequest({ authorization: header });
        const res = createMockResponse();
        const next = createMockNext();

        mockJwt.verify.mockReturnValue(validPayload);

        authenticateToken(req, res, next);

        expect(mockJwt.verify).toHaveBeenCalledWith(expectedToken, JWT_SECRET);
      });
    });

    it('should add user information to request object', () => {
      const customPayload = {
        userId: 'custom-user-456',
        teamId: 'custom-team-789',
        iat: 1234567890,
        exp: 1234567899
      };

      const req = createMockRequest({
        authorization: 'Bearer custom-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockReturnValue(customPayload);

      authenticateToken(req, res, next);

      expect((req as any).userId).toBe('custom-user-456');
      expect((req as any).user).toEqual(customPayload);
      expect(next).toHaveBeenCalled();
    });

    it('should handle tokens with minimal payload', () => {
      const minimalPayload = {
        userId: 'min-user',
        teamId: 'min-team'
        // No iat/exp
      };

      const req = createMockRequest({
        authorization: 'Bearer minimal-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockReturnValue(minimalPayload);

      authenticateToken(req, res, next);

      expect((req as any).userId).toBe('min-user');
      expect((req as any).user).toEqual(minimalPayload);
      expect(next).toHaveBeenCalled();
    });

    it('should handle case-insensitive Bearer prefix', () => {
      const testCases = [
        'Bearer token123',
        'bearer token123',
        'BEARER token123'
      ];

      testCases.forEach((authHeader) => {
        jest.clearAllMocks();
        
        const req = createMockRequest({ authorization: authHeader });
        const res = createMockResponse();
        const next = createMockNext();

        mockJwt.verify.mockReturnValue(validPayload);

        authenticateToken(req, res, next);

        // Should extract token correctly regardless of case
        const expectedToken = authHeader.split(' ')[1];
        expect(mockJwt.verify).toHaveBeenCalledWith(expectedToken, JWT_SECRET);
      });
    });

    it('should handle authorization header with proper Bearer format', () => {
      const req = createMockRequest({
        authorization: 'Bearer token-with-spaces'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockReturnValue(validPayload);

      authenticateToken(req, res, next);

      // Should extract token correctly
      expect(mockJwt.verify).toHaveBeenCalledWith('token-with-spaces', JWT_SECRET);
    });

    it('should not modify request object on authentication failure', () => {
      const req = createMockRequest({
        authorization: 'Bearer invalid-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      authenticateToken(req, res, next);

      expect((req as any).userId).toBeUndefined();
      expect((req as any).user).toBeUndefined();
    });

    it('should handle jwt.verify returning non-object', () => {
      const req = createMockRequest({
        authorization: 'Bearer strange-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Mock jwt.verify to return a string instead of object
      mockJwt.verify.mockReturnValue('not-an-object' as any);

      authenticateToken(req, res, next);

      // Should handle gracefully
      expect((req as any).userId).toBe(undefined);
      expect((req as any).user).toBe('not-an-object');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle null authorization header', () => {
      const req = createMockRequest({
        authorization: null as any
      });
      const res = createMockResponse();
      const next = createMockNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should handle empty string authorization header', () => {
      const req = createMockRequest({
        authorization: ''
      });
      const res = createMockResponse();
      const next = createMockNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should handle authorization header with only Bearer', () => {
      const req = createMockRequest({
        authorization: 'Bearer '
      });
      const res = createMockResponse();
      const next = createMockNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should handle jwt.verify throwing unexpected error types', () => {
      const req = createMockRequest({
        authorization: 'Bearer problematic-token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Mock jwt.verify to throw non-JWT error
      mockJwt.verify.mockImplementation(() => {
        throw new TypeError('Unexpected error type');
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token verification failed' });
    });
  });

  describe('Integration with Express types', () => {
    const validPayload = {
      userId: 'user-123',
      teamId: 'team-456',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should properly extend Request interface', () => {
      interface AuthRequest extends Request {
        userId?: string;
        user?: {
          userId: string;
          teamId: string;
          iat?: number;
          exp?: number;
        };
      }

      const req = createMockRequest({
        authorization: 'Bearer valid-token'
      }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      mockJwt.verify.mockReturnValue(validPayload);

      authenticateToken(req, res, next);

      // TypeScript should allow these assignments
      expect(req.userId).toBe('user-123');
      expect(req.user?.userId).toBe('user-123');
      expect(req.user?.teamId).toBe('team-456');
    });

    it('should work with Express middleware chain', () => {
      const middlewares: ((req: Request, res: Response, next: NextFunction) => void)[] = [
        authenticateToken,
        (req: Request, res: Response, next: NextFunction) => {
          // Simulated route handler
          const authReq = req as any;
          expect(authReq.userId).toBeTruthy();
          res.json({ success: true, userId: authReq.userId });
        }
      ];

      const req = createMockRequest({
        authorization: 'Bearer valid-token'
      });
      const res = createMockResponse();

      mockJwt.verify.mockReturnValue(validPayload);

      // Simulate middleware chain
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
        middlewares[1](req, res, () => {});
      };

      middlewares[0](req, res, next);

      expect(nextCalled).toBe(true);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        userId: 'user-123'
      });
    });
  });

  describe('Performance considerations', () => {
    it('should not call jwt.verify when no token present', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      authenticateToken(req, res, next);

      expect(mockJwt.verify).not.toHaveBeenCalled();
    });

    it('should handle multiple concurrent authentication requests', () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        req: createMockRequest({
          authorization: `Bearer token-${i}`
        }),
        res: createMockResponse(),
        next: createMockNext()
      }));

      mockJwt.verify.mockImplementation((token) => ({
        userId: `user-${token}`,
        teamId: `team-${token}`,
        iat: Date.now(),
        exp: Date.now() + 3600
      }));

      // Process all requests
      requests.forEach(({ req, res, next }) => {
        authenticateToken(req, res, next);
      });

      // All should be processed correctly
      expect(mockJwt.verify).toHaveBeenCalledTimes(10);
      requests.forEach(({ next }) => {
        expect(next).toHaveBeenCalled();
      });
    });
  });
});