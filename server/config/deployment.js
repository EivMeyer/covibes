/**
 * Centralized Deployment Configuration
 * 
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL DEPLOYMENT SETTINGS
 * 
 * When IP addresses change, UPDATE ONLY THIS FILE.
 * All other files import from here.
 */

// PRODUCTION CONFIGURATION - CHANGE IPs HERE ONLY
const DEPLOYMENT_CONFIG = {
  // Primary EC2 Instance Configuration
  PRIMARY_HOST: 'ec2-13-48-135-139.eu-north-1.compute.amazonaws.com',
  
  // Derived configurations (automatically calculated)
  get EC2_HOST() { return this.PRIMARY_HOST; },
  get BASE_HOST() { return this.PRIMARY_HOST; },
  
  // Standard ports
  SERVER_PORT: 3001,
  CLIENT_PORT: 3000,
  PREVIEW_PORT_RANGE: { min: 7000, max: 8000 },
  
  // Standard connection details
  EC2_USERNAME: 'ubuntu',
  
  // URLs (automatically generated from PRIMARY_HOST)
  get SERVER_URL() { return `http://${this.PRIMARY_HOST}:${this.SERVER_PORT}`; },
  get CLIENT_URL() { return `http://${this.PRIMARY_HOST}:${this.CLIENT_PORT}`; },
  get WEBSOCKET_URL() { return `ws://${this.PRIMARY_HOST}:${this.SERVER_PORT}`; },
  
  // Validation
  validate() {
    if (!this.PRIMARY_HOST || !this.PRIMARY_HOST.startsWith('ec2-')) {
      throw new Error(`Invalid PRIMARY_HOST: ${this.PRIMARY_HOST}. Must be EC2 hostname.`);
    }
    console.log(`✅ Deployment config validated: ${this.PRIMARY_HOST}`);
  }
};

// Environment variable overrides (for backwards compatibility)
if (process.env.EC2_HOST && process.env.EC2_HOST !== DEPLOYMENT_CONFIG.PRIMARY_HOST) {
  console.warn(`⚠️  Environment EC2_HOST (${process.env.EC2_HOST}) differs from config (${DEPLOYMENT_CONFIG.PRIMARY_HOST})`);
  console.warn(`   Using config value: ${DEPLOYMENT_CONFIG.PRIMARY_HOST}`);
}

// Validate on import
DEPLOYMENT_CONFIG.validate();

// ES Module exports
export const PRIMARY_HOST = DEPLOYMENT_CONFIG.PRIMARY_HOST;
export const EC2_HOST = DEPLOYMENT_CONFIG.EC2_HOST;
export const BASE_HOST = DEPLOYMENT_CONFIG.BASE_HOST;
export const SERVER_PORT = DEPLOYMENT_CONFIG.SERVER_PORT;
export const CLIENT_PORT = DEPLOYMENT_CONFIG.CLIENT_PORT;
export const PREVIEW_PORT_RANGE = DEPLOYMENT_CONFIG.PREVIEW_PORT_RANGE;
export const EC2_USERNAME = DEPLOYMENT_CONFIG.EC2_USERNAME;
export const SERVER_URL = DEPLOYMENT_CONFIG.SERVER_URL;
export const CLIENT_URL = DEPLOYMENT_CONFIG.CLIENT_URL;
export const WEBSOCKET_URL = DEPLOYMENT_CONFIG.WEBSOCKET_URL;

export default DEPLOYMENT_CONFIG;