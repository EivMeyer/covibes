#!/usr/bin/env node

import jwt from 'jsonwebtoken';

// Use same JWT secret as server
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-key';

// Create test token with valid team and user IDs from the hardcoded test script
const testPayload = {
  userId: 'cmeihs04a000raujsjjwufbev',
  teamId: 'cmeiha047000paujsynv3j0y5',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

const token = jwt.sign(testPayload, JWT_SECRET);

console.log('🔐 Generated Test JWT Token:');
console.log(token);
console.log('');
console.log('📋 Token payload:', JSON.stringify(testPayload, null, 2));