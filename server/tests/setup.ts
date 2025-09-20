// Test setup file for Jest
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.ENCRYPTION_KEY = '32-character-test-encryption-key!';
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/covibes_test';

// Increase timeout for async operations
jest.setTimeout(10000);