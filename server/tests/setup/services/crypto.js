/**
 * Encryption Service for SSH Keys
 *
 * Handles secure encryption and decryption of SSH keys for storage
 * Requirements:
 * - Encrypt SSH private keys before storing in database
 * - Decrypt SSH keys for SSH connections
 * - Use strong encryption algorithms (AES-256-CBC)
 * - Generate secure encryption keys from environment variables
 * - Handle key rotation and migration
 */
import { createHash, randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto';
/**
 * Encryption service for sensitive data like SSH keys
 */
export class CryptoService {
    constructor(secretKey) {
        this.algorithm = 'aes-256-cbc';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        // Use provided key or get from environment
        const key = secretKey || process.env.ENCRYPTION_KEY || 'default-development-key-not-for-production';
        if (key === 'default-development-key-not-for-production' && process.env.NODE_ENV === 'production') {
            throw new Error('ENCRYPTION_KEY environment variable must be set in production');
        }
        // Derive encryption key using SHA-256
        this.encryptionKey = this.deriveKey(key);
    }
    /**
     * Encrypt data using AES-256-CBC with HMAC authentication
     */
    encrypt(plaintext) {
        if (!plaintext) {
            throw new Error('Plaintext is required for encryption');
        }
        try {
            // Generate random IV for each encryption
            const iv = randomBytes(this.ivLength);
            // Create cipher with IV
            const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
            // Encrypt data
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Create HMAC for authentication
            const hmac = createHmac('sha256', this.encryptionKey);
            hmac.update(encrypted + iv.toString('hex'));
            const tag = hmac.digest('hex').slice(0, 16);
            return {
                encrypted,
                iv: iv.toString('hex'),
                tag
            };
        }
        catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }
    /**
     * Decrypt data using AES-256-CBC with HMAC verification
     */
    decrypt(params) {
        const { encrypted, iv, tag } = params;
        if (!encrypted || !iv || !tag) {
            throw new Error('Encrypted data, IV, and tag are required for decryption');
        }
        try {
            // Verify HMAC for authentication
            const hmac = createHmac('sha256', this.encryptionKey);
            hmac.update(encrypted + iv);
            const expectedTag = hmac.digest('hex').slice(0, 16);
            if (tag !== expectedTag) {
                throw new Error('Authentication failed - data may have been tampered with');
            }
            // Create decipher with IV
            const ivBuffer = Buffer.from(iv, 'hex');
            const decipher = createDecipheriv(this.algorithm, this.encryptionKey, ivBuffer);
            // Decrypt data
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
    /**
     * Encrypt SSH private key for database storage
     */
    encryptSSHKey(privateKey) {
        if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
            throw new Error('Invalid SSH private key format');
        }
        return this.encrypt(privateKey);
    }
    /**
     * Decrypt SSH private key from database storage
     */
    decryptSSHKey(encryptedData) {
        const privateKey = this.decrypt(encryptedData);
        // Validate decrypted key format
        if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
            throw new Error('Decrypted data is not a valid SSH private key');
        }
        return privateKey;
    }
    /**
     * Hash data using SHA-256 (for non-reversible hashing)
     */
    hash(data) {
        return createHash('sha256').update(data).digest('hex');
    }
    /**
     * Generate secure random token
     */
    generateToken(length = 32) {
        return randomBytes(length).toString('hex');
    }
    /**
     * Derive encryption key from secret using PBKDF2-like approach
     */
    deriveKey(secret) {
        // Use multiple rounds of SHA-256 to derive key
        let derivedKey = Buffer.from(secret, 'utf8');
        for (let i = 0; i < 10000; i++) {
            derivedKey = Buffer.from(createHash('sha256').update(derivedKey).digest());
        }
        // Ensure key is exactly 32 bytes
        if (derivedKey.length > this.keyLength) {
            return derivedKey.subarray(0, this.keyLength);
        }
        else if (derivedKey.length < this.keyLength) {
            // Pad with zeros if too short (not ideal, but handles edge case)
            const padded = Buffer.alloc(this.keyLength);
            derivedKey.copy(padded);
            return padded;
        }
        return derivedKey;
    }
    /**
     * Validate encryption result format
     */
    validateEncryptionResult(result) {
        return (result &&
            typeof result.encrypted === 'string' &&
            typeof result.iv === 'string' &&
            typeof result.tag === 'string' &&
            result.encrypted.length > 0 &&
            result.iv.length === this.ivLength * 2 && // Hex string is 2x binary length
            result.tag.length > 0);
    }
    /**
     * Validate decryption parameters format
     */
    validateDecryptionParams(params) {
        return (params &&
            typeof params.encrypted === 'string' &&
            typeof params.iv === 'string' &&
            typeof params.tag === 'string' &&
            params.encrypted.length > 0 &&
            params.iv.length === this.ivLength * 2 &&
            params.tag.length > 0);
    }
    /**
     * Test encryption/decryption with sample data
     */
    testEncryption() {
        try {
            const testData = 'test-encryption-data-' + Date.now();
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);
            return decrypted === testData;
        }
        catch (error) {
            console.error('Encryption test failed:', error);
            return false;
        }
    }
    /**
     * Get encryption algorithm info
     */
    getAlgorithmInfo() {
        return {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            ivLength: this.ivLength
        };
    }
}
// Singleton instance
export const cryptoService = new CryptoService();
/**
 * Helper functions for common encryption tasks
 */
/**
 * Encrypt SSH key with default crypto service
 */
export function encryptSSHKey(privateKey) {
    return cryptoService.encryptSSHKey(privateKey);
}
/**
 * Decrypt SSH key with default crypto service
 */
export function decryptSSHKey(encryptedData) {
    return cryptoService.decryptSSHKey(encryptedData);
}
/**
 * Hash password or sensitive data
 */
export function hashData(data) {
    return cryptoService.hash(data);
}
/**
 * Generate secure random token
 */
export function generateSecureToken(length) {
    return cryptoService.generateToken(length);
}
/**
 * Create crypto service instance with custom key
 */
export function createCryptoService(secretKey) {
    return new CryptoService(secretKey);
}
/**
 * Validate environment encryption setup
 */
export function validateEncryptionSetup() {
    try {
        const testService = new CryptoService();
        const testPassed = testService.testEncryption();
        if (!testPassed) {
            return {
                valid: false,
                message: 'Encryption test failed - algorithm not working correctly'
            };
        }
        if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
            return {
                valid: false,
                message: 'ENCRYPTION_KEY environment variable must be set in production'
            };
        }
        return {
            valid: true,
            message: 'Encryption setup is valid'
        };
    }
    catch (error) {
        return {
            valid: false,
            message: `Encryption setup error: ${error.message}`
        };
    }
}
export default CryptoService;
