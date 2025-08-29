/**
 * Crypto Service Unit Tests
 * Tests encryption, decryption, and SSH key handling
 */

import { jest } from '@jest/globals';
import { 
  CryptoService, 
  cryptoService, 
  encryptSSHKey, 
  decryptSSHKey, 
  hashData, 
  generateSecureToken,
  createCryptoService,
  validateEncryptionSetup,
  type EncryptionResult,
  type DecryptionParams
} from '../../services/crypto';

describe('CryptoService', () => {
  const testSecret = 'test-secret-key-for-encryption';
  const sampleSSHKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEAtest-key-data-here
-----END OPENSSH PRIVATE KEY-----`;

  describe('constructor', () => {
    it('should create service with provided secret key', () => {
      const service = new CryptoService(testSecret);
      expect(service).toBeInstanceOf(CryptoService);
    });

    it('should use environment variable when no key provided', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'env-test-key';
      
      const service = new CryptoService();
      expect(service).toBeInstanceOf(CryptoService);
      
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should throw error in production without encryption key', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.ENCRYPTION_KEY;
      
      process.env.NODE_ENV = 'production';
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => new CryptoService()).toThrow('ENCRYPTION_KEY environment variable must be set in production');
      
      process.env.NODE_ENV = originalEnv;
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should allow development key in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      expect(() => new CryptoService()).not.toThrow();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('encrypt and decrypt', () => {
    let service: CryptoService;

    beforeEach(() => {
      service = new CryptoService(testSecret);
    });

    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'Hello, World! This is a test message.';
      
      const encrypted = service.encrypt(plaintext);
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should generate different encrypted results for same input', () => {
      const plaintext = 'Same input text';
      
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      
      // Both should decrypt to same plaintext
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string encryption', () => {
      expect(() => service.encrypt('')).toThrow('Plaintext is required for encryption');
    });

    it('should handle null/undefined encryption', () => {
      expect(() => service.encrypt(null as any)).toThrow('Plaintext is required for encryption');
      expect(() => service.encrypt(undefined as any)).toThrow('Plaintext is required for encryption');
    });

    it('should fail decryption with invalid parameters', () => {
      expect(() => service.decrypt({
        encrypted: '',
        iv: 'invalid',
        tag: 'invalid'
      })).toThrow('Encrypted data, IV, and tag are required for decryption');
    });

    it('should fail decryption with tampered data', () => {
      const plaintext = 'Test message';
      const encrypted = service.encrypt(plaintext);
      
      // Tamper with encrypted data
      const tamperedData = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -2) + '00'
      };
      
      expect(() => service.decrypt(tamperedData)).toThrow('Authentication failed - data may have been tampered with');
    });

    it('should fail decryption with wrong IV', () => {
      const plaintext = 'Test message';
      const encrypted = service.encrypt(plaintext);
      
      const wrongIV = {
        ...encrypted,
        iv: '0123456789abcdef0123456789abcdef'
      };
      
      expect(() => service.decrypt(wrongIV)).toThrow('Authentication failed - data may have been tampered with');
    });

    it('should handle large text encryption', () => {
      const largeText = 'A'.repeat(10000);
      
      const encrypted = service.encrypt(largeText);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(largeText);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ åäöñéü 中文 🚀🔒';
      
      const encrypted = service.encrypt(specialText);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(specialText);
    });
  });

  describe('SSH key encryption', () => {
    let service: CryptoService;

    beforeEach(() => {
      service = new CryptoService(testSecret);
    });

    it('should encrypt SSH private key', () => {
      const encrypted = service.encryptSSHKey(sampleSSHKey);
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.encrypted).not.toBe(sampleSSHKey);
    });

    it('should decrypt SSH private key', () => {
      const encrypted = service.encryptSSHKey(sampleSSHKey);
      const decrypted = service.decryptSSHKey(encrypted);
      
      expect(decrypted).toBe(sampleSSHKey);
    });

    it('should reject invalid SSH key format for encryption', () => {
      const invalidKey = 'not-an-ssh-key';
      
      expect(() => service.encryptSSHKey(invalidKey)).toThrow('Invalid SSH private key format');
    });

    it('should reject invalid decrypted SSH key format', () => {
      const plaintext = 'not-an-ssh-key';
      const encrypted = service.encrypt(plaintext);
      
      expect(() => service.decryptSSHKey(encrypted)).toThrow('Decrypted data is not a valid SSH private key');
    });

    it('should handle different SSH key formats', () => {
      const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAtest-rsa-key-data-here
-----END RSA PRIVATE KEY-----`;

      const opensshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----`;

      expect(() => service.encryptSSHKey(rsaKey)).not.toThrow();
      expect(() => service.encryptSSHKey(opensshKey)).not.toThrow();
    });
  });

  describe('utility methods', () => {
    let service: CryptoService;

    beforeEach(() => {
      service = new CryptoService(testSecret);
    });

    describe('hash', () => {
      it('should generate consistent hash for same input', () => {
        const data = 'test-data-to-hash';
        
        const hash1 = service.hash(data);
        const hash2 = service.hash(data);
        
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // SHA-256 hex length
      });

      it('should generate different hashes for different inputs', () => {
        const hash1 = service.hash('input1');
        const hash2 = service.hash('input2');
        
        expect(hash1).not.toBe(hash2);
      });

      it('should handle empty string hashing', () => {
        const hash = service.hash('');
        expect(hash).toHaveLength(64);
      });
    });

    describe('generateToken', () => {
      it('should generate token of default length', () => {
        const token = service.generateToken();
        expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      });

      it('should generate token of specified length', () => {
        const token = service.generateToken(16);
        expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
      });

      it('should generate unique tokens', () => {
        const token1 = service.generateToken();
        const token2 = service.generateToken();
        
        expect(token1).not.toBe(token2);
      });
    });

    describe('testEncryption', () => {
      it('should return true for working encryption', () => {
        const result = service.testEncryption();
        expect(result).toBe(true);
      });

      it('should handle encryption test errors gracefully', () => {
        // Mock encrypt to throw error
        jest.spyOn(service, 'encrypt').mockImplementation(() => {
          throw new Error('Encryption failed');
        });
        
        const result = service.testEncryption();
        expect(result).toBe(false);
        
        jest.restoreAllMocks();
      });
    });

    describe('getAlgorithmInfo', () => {
      it('should return algorithm information', () => {
        const info = service.getAlgorithmInfo();
        
        expect(info).toEqual({
          algorithm: 'aes-256-cbc',
          keyLength: 32,
          ivLength: 16
        });
      });
    });
  });

  describe('validation methods', () => {
    let service: CryptoService;

    beforeEach(() => {
      service = new CryptoService(testSecret);
    });

    describe('validateEncryptionResult', () => {
      it('should validate correct encryption result', () => {
        const encrypted = service.encrypt('test');
        const isValid = service.validateEncryptionResult(encrypted);
        
        expect(isValid).toBe(true);
      });

      it('should reject invalid encryption result', () => {
        const invalid = {
          encrypted: '',
          iv: 'short',
          tag: ''
        };
        
        const isValid = service.validateEncryptionResult(invalid);
        expect(isValid).toBe(false);
      });

      it('should reject missing properties', () => {
        const incomplete = {
          encrypted: 'test',
          iv: '0123456789abcdef0123456789abcdef'
          // missing tag
        };
        
        const isValid = service.validateEncryptionResult(incomplete);
        expect(isValid).toBe(false);
      });
    });

    describe('validateDecryptionParams', () => {
      it('should validate correct decryption params', () => {
        const encrypted = service.encrypt('test');
        const isValid = service.validateDecryptionParams(encrypted);
        
        expect(isValid).toBe(true);
      });

      it('should reject invalid decryption params', () => {
        const invalid = {
          encrypted: 'test',
          iv: 'short-iv',
          tag: 'test'
        };
        
        const isValid = service.validateDecryptionParams(invalid);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('key derivation', () => {
    it('should derive consistent keys from same secret', () => {
      const service1 = new CryptoService('same-secret');
      const service2 = new CryptoService('same-secret');
      
      const plaintext = 'test message';
      const encrypted = service1.encrypt(plaintext);
      const decrypted = service2.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should derive different keys from different secrets', () => {
      const service1 = new CryptoService('secret1');
      const service2 = new CryptoService('secret2');
      
      const plaintext = 'test message';
      const encrypted = service1.encrypt(plaintext);
      
      expect(() => service2.decrypt(encrypted)).toThrow('Authentication failed');
    });

    it('should handle short secrets by padding', () => {
      const shortSecret = 'abc';
      const service = new CryptoService(shortSecret);
      
      expect(() => service.encrypt('test')).not.toThrow();
    });

    it('should handle long secrets by truncating', () => {
      const longSecret = 'a'.repeat(100);
      const service = new CryptoService(longSecret);
      
      expect(() => service.encrypt('test')).not.toThrow();
    });
  });

  describe('error handling', () => {
    let service: CryptoService;

    beforeEach(() => {
      service = new CryptoService(testSecret);
    });

    it('should provide meaningful error messages', () => {
      expect(() => service.encrypt('')).toThrow('Plaintext is required for encryption');
      
      expect(() => service.decrypt({
        encrypted: '',
        iv: '',
        tag: ''
      })).toThrow('Encrypted data, IV, and tag are required for decryption');
    });

    it('should handle crypto operation failures', () => {
      const invalidParams = {
        encrypted: 'invalid-hex-data',
        iv: 'invalid-hex-iv-data',
        tag: 'invalid-tag'
      };
      
      expect(() => service.decrypt(invalidParams)).toThrow();
    });
  });
});

describe('Singleton instance', () => {
  it('should export working singleton instance', () => {
    expect(cryptoService).toBeInstanceOf(CryptoService);
    
    const plaintext = 'singleton test';
    const encrypted = cryptoService.encrypt(plaintext);
    const decrypted = cryptoService.decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });
});

describe('Helper functions', () => {
  const testSSHKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----`;

  describe('encryptSSHKey and decryptSSHKey', () => {
    it('should encrypt and decrypt SSH key', () => {
      const encrypted = encryptSSHKey(testSSHKey);
      const decrypted = decryptSSHKey(encrypted);
      
      expect(decrypted).toBe(testSSHKey);
    });
  });

  describe('hashData', () => {
    it('should hash data using singleton service', () => {
      const data = 'data to hash';
      const hash = hashData(data);
      
      expect(hash).toHaveLength(64);
      expect(hash).toBe(cryptoService.hash(data));
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(64);
    });

    it('should generate token with custom length', () => {
      const token = generateSecureToken(8);
      expect(token).toHaveLength(16);
    });
  });

  describe('createCryptoService', () => {
    it('should create service with custom key', () => {
      const customService = createCryptoService('custom-key');
      expect(customService).toBeInstanceOf(CryptoService);
      
      // Should be different from singleton
      const plaintext = 'test';
      const customEncrypted = customService.encrypt(plaintext);
      const singletonEncrypted = cryptoService.encrypt(plaintext);
      
      // Different services can't decrypt each other's data
      expect(() => customService.decrypt(singletonEncrypted)).toThrow();
      expect(() => cryptoService.decrypt(customEncrypted)).toThrow();
    });
  });

  describe('validateEncryptionSetup', () => {
    it('should validate working encryption setup', () => {
      const result = validateEncryptionSetup();
      expect(result.valid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should detect production environment without encryption key', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.ENCRYPTION_KEY;
      
      process.env.NODE_ENV = 'production';
      delete process.env.ENCRYPTION_KEY;
      
      const result = validateEncryptionSetup();
      expect(result.valid).toBe(false);
      expect(result.message).toContain('ENCRYPTION_KEY environment variable must be set');
      
      process.env.NODE_ENV = originalEnv;
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should handle encryption setup errors', () => {
      // Temporarily break the environment to trigger a validation error
      const originalKey = process.env.ENCRYPTION_KEY;
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Set production mode without encryption key to trigger error
      process.env.NODE_ENV = 'production';
      delete process.env.ENCRYPTION_KEY;
      
      const result = validateEncryptionSetup();
      expect(result.valid).toBe(false);
      expect(result.message).toContain('ENCRYPTION_KEY environment variable must be set in production');
      
      // Restore original environment
      process.env.ENCRYPTION_KEY = originalKey;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});

describe('Security properties', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService('test-security-key');
  });

  it('should use unique IVs for each encryption', () => {
    const plaintext = 'same plaintext';
    
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it('should include authentication tag', () => {
    const encrypted = service.encrypt('authenticated data');
    
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.tag.length).toBeGreaterThan(0);
  });

  it('should detect tampering with encrypted data', () => {
    const encrypted = service.encrypt('important data');
    
    // Modify encrypted data
    const modified = encrypted.encrypted.slice(0, -2) + 'XX';
    
    expect(() => service.decrypt({
      encrypted: modified,
      iv: encrypted.iv,
      tag: encrypted.tag
    })).toThrow('Authentication failed');
  });

  it('should detect tampering with IV', () => {
    const encrypted = service.encrypt('important data');
    
    // Modify IV
    const modifiedIV = '00' + encrypted.iv.slice(2);
    
    expect(() => service.decrypt({
      encrypted: encrypted.encrypted,
      iv: modifiedIV,
      tag: encrypted.tag
    })).toThrow('Authentication failed');
  });

  it('should produce cryptographically secure tokens', () => {
    const tokens = new Set();
    
    // Generate 100 tokens and ensure they're all unique
    for (let i = 0; i < 100; i++) {
      const token = service.generateToken(16);
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
    
    expect(tokens.size).toBe(100);
  });
});