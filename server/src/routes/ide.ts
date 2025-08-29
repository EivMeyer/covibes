/**
 * IDE Routes
 * 
 * Handles file operations for the integrated IDE
 * Requirements:
 * - List files in repository
 * - Read file contents
 * - Write file contents
 * - Create/delete files
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { createAuthHandler } from '../types/express.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

// Import module augmentation

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const fileOperationSchema = z.object({
  path: z.string(),
  branch: z.enum(['main', 'staging']).default('main')
});

const saveFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  branch: z.enum(['main', 'staging']).default('main')
});

// Apply authentication to all IDE routes
router.use(authenticateToken);

/**
 * Get the base directory for a team's repository
 * Uses the shared workspace directory for agent/preview/IDE consistency
 */
async function getRepoPath(teamId: string, _branch: string): Promise<string> {
  const baseDir = path.join(os.homedir(), '.colabvibes', teamId);
  return baseDir;
}

/**
 * Recursively get file tree structure
 */
async function getFileTree(dir: string, basePath: string = ''): Promise<any[]> {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  // Filter out common directories to ignore
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage'];
  const ignoreFiles = ['.DS_Store', 'Thumbs.db'];

  for (const item of items) {
    if (ignoreDirs.includes(item.name) || ignoreFiles.includes(item.name)) {
      continue;
    }

    const fullPath = path.join(dir, item.name);
    const relativePath = path.join(basePath, item.name);

    if (item.isDirectory()) {
      const children = await getFileTree(fullPath, relativePath);
      files.push({
        name: item.name,
        path: relativePath,
        type: 'directory',
        children
      });
    } else {
      files.push({
        name: item.name,
        path: relativePath,
        type: 'file'
      });
    }
  }

  return files;
}

/**
 * GET /api/ide/files
 * Get file tree for the team's repository
 */
router.get('/files', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { branch = 'main' } = req.query as { branch?: string };

    // Get team to check repository
    const team = await prisma.teams.findUnique({
      where: { id: teamId }
    });

    if (!team?.repositoryUrl) {
      return res.json({
        files: [],
        message: 'No repository configured'
      });
    }

    // Get repository path
    const repoPath = await getRepoPath(teamId, branch);

    // Check if directory exists
    try {
      await fs.access(repoPath);
    } catch {
      return res.json({
        files: [],
        message: 'Repository not cloned yet. Start a preview first.'
      });
    }

    // Get file tree
    const files = await getFileTree(repoPath);

    res.json({
      files,
      branch,
      repository: team.repositoryUrl
    });

  } catch (error) {
    console.error('Error getting file tree:', error);
    res.status(500).json({ message: 'Failed to get file tree' });
  }
}));

/**
 * GET /api/ide/file
 * Read a specific file
 */
router.get('/file', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { path: filePath, branch = 'main' } = req.query as { 
      path?: string; 
      branch?: string;
    };

    if (!filePath) {
      return res.status(400).json({ message: 'File path required' });
    }

    // Prevent directory traversal attacks
    if (filePath.includes('..')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Get repository path
    const repoPath = await getRepoPath(teamId, branch);
    const fullPath = path.join(repoPath, filePath);

    // Check if file exists and is within repo
    if (!fullPath.startsWith(repoPath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Read file
    const content = await fs.readFile(fullPath, 'utf-8');

    res.json({
      path: filePath,
      content,
      branch
    });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: 'File not found' });
    }
    console.error('Error reading file:', error);
    res.status(500).json({ message: 'Failed to read file' });
  }
}));

/**
 * POST /api/ide/file
 * Save a file
 */
router.post('/file', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { path: filePath, content, branch } = saveFileSchema.parse(req.body);

    // Prevent directory traversal attacks
    if (filePath.includes('..')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Get repository path
    const repoPath = await getRepoPath(teamId, branch);
    const fullPath = path.join(repoPath, filePath);

    // Check if file is within repo
    if (!fullPath.startsWith(repoPath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    res.json({
      message: 'File saved successfully',
      path: filePath,
      branch
    });

  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ message: 'Failed to save file' });
  }
}));

/**
 * DELETE /api/ide/file
 * Delete a file
 */
router.delete('/file', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { path: filePath, branch } = fileOperationSchema.parse(req.query);

    // Prevent directory traversal attacks
    if (filePath.includes('..')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Get repository path
    const repoPath = await getRepoPath(teamId, branch);
    const fullPath = path.join(repoPath, filePath);

    // Check if file is within repo
    if (!fullPath.startsWith(repoPath)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Delete file
    await fs.unlink(fullPath);

    res.json({
      message: 'File deleted successfully',
      path: filePath,
      branch
    });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: 'File not found' });
    }
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
}));

/**
 * POST /api/ide/create
 * Create a new file or directory
 */
router.post('/create', createAuthHandler(async (req, res) => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { path: itemPath, type, branch = 'main' } = z.object({
      path: z.string(),
      type: z.enum(['file', 'directory']),
      branch: z.enum(['main', 'staging']).default('main')
    }).parse(req.body);

    // Prevent directory traversal attacks
    if (itemPath.includes('..')) {
      return res.status(400).json({ message: 'Invalid path' });
    }

    // Get repository path
    const repoPath = await getRepoPath(teamId, branch);
    const fullPath = path.join(repoPath, itemPath);

    // Check if path is within repo
    if (!fullPath.startsWith(repoPath)) {
      return res.status(400).json({ message: 'Invalid path' });
    }

    if (type === 'directory') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      // Ensure parent directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      // Create empty file
      await fs.writeFile(fullPath, '', 'utf-8');
    }

    res.json({
      message: `${type === 'directory' ? 'Directory' : 'File'} created successfully`,
      path: itemPath,
      type,
      branch
    });

  } catch (error: any) {
    if (error.code === 'EEXIST') {
      return res.status(400).json({ message: 'File or directory already exists' });
    }
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Failed to create item' });
  }
}));

export default router;