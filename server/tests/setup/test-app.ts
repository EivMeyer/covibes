/**
 * Test Application Setup
 * 
 * Creates an Express app configured for testing without starting the server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import route handlers
import authRoutes from '../../src/routes/auth.js';
import agentRoutes from '../../src/routes/agents.js';
import teamRoutes from '../../src/routes/team.js';
import vmRoutes from '../../src/routes/vm.js';
import previewRoutes from '../../src/routes/preview.js';

// Load environment variables
dotenv.config();

// Initialize Express app for testing
const app = express();

// Test-specific configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for tests
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: 'test' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/vm', vmRoutes);
app.use('/api/preview', previewRoutes);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Test app error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;