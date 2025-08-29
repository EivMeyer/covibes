/**
 * Services Index
 * 
 * Central export point for all CoVibe services
 */

// SSH Service
export { 
  SSHService, 
  sshService, 
  loadSSHKey, 
  createEC2Connection 
} from './ssh.js';

// VM Manager Service
export { 
  VMManager, 
  createVMManager,
  type VMInstance,
  type VMConfig 
} from './vm-manager.js';


// Crypto Service
export { 
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
} from './crypto.js';