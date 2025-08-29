import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// Schema for workspace data
const WorkspaceUpdateSchema = z.object({
    tiles: z.array(z.any()).optional(),
    layouts: z.record(z.any()).optional(),
    sidebarWidth: z.number().min(100).max(600).optional()
});
// Get team's workspace configuration
router.get('/config', authenticateToken, async (req, res) => {
    try {
        // Use req.userId which is set by the authenticateToken middleware
        const userId = req.userId;
        if (!userId) {
            console.log('❌ Workspace GET: User not authenticated');
            return res.status(401).json({ error: 'User not authenticated' });
        }
        console.log(`📊 Loading workspace config for user: ${userId}`);
        // Get user's team first
        console.log(`📊 Finding user in database: ${userId}`);
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                teamId: true,
                teams: {
                    select: {
                        workspaceTiles: true,
                        workspaceLayouts: true,
                        sidebarWidth: true
                    }
                }
            }
        });
        console.log(`📊 User found:`, !!user, `Team found:`, !!user?.teams);
        if (!user || !user.teams) {
            console.log(`📊 ERROR: User or team not found for userId: ${userId}`);
            return res.status(404).json({ error: 'User or team not found' });
        }
        console.log(`📊 Team data retrieved for teamId: ${user.teamId}`);
        // Provide sensible defaults for null values
        console.log(`📊 Raw workspace data from DB:`, {
            tiles: user.teams.workspaceTiles,
            layouts: user.teams.workspaceLayouts,
            sidebarWidth: user.teams.sidebarWidth
        });
        const workspaceTiles = user.teams.workspaceTiles || [];
        const workspaceLayouts = user.teams.workspaceLayouts || {};
        const sidebarWidth = user.teams.sidebarWidth || 256;
        console.log(`📊 Processed workspace data:`, {
            tilesType: typeof workspaceTiles,
            tilesIsArray: Array.isArray(workspaceTiles),
            layoutsType: typeof workspaceLayouts,
            sidebarType: typeof sidebarWidth
        });
        console.log('📊📊📊 SERVER RETURNING WORKSPACE DATA:', {
            tiles: workspaceTiles,
            layouts: workspaceLayouts,
            sidebarWidth
        });
        console.log(`📊 Returning workspace config for team ${user.teamId}:`, {
            tilesCount: Array.isArray(workspaceTiles) ? workspaceTiles.length : 0,
            hasLayouts: Object.keys(workspaceLayouts).length > 0,
            sidebarWidth
        });
        const responseData = {
            tiles: workspaceTiles,
            layouts: workspaceLayouts,
            sidebarWidth: sidebarWidth
        };
        console.log(`📊 About to send JSON response:`, JSON.stringify(responseData));
        res.json(responseData);
        console.log(`📊 JSON response sent successfully`);
    }
    catch (error) {
        console.error('Error fetching workspace config:', error);
        res.status(500).json({ error: 'Failed to fetch workspace configuration' });
    }
});
// Update team's workspace configuration
router.put('/config', authenticateToken, async (req, res) => {
    try {
        // Use req.userId which is set by the authenticateToken middleware
        const userId = req.userId;
        if (!userId) {
            console.log('❌ Workspace PUT: User not authenticated');
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const validation = WorkspaceUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            console.log('❌ Workspace PUT: Invalid data:', validation.error);
            return res.status(400).json({ error: 'Invalid workspace data', details: validation.error });
        }
        const { tiles, layouts, sidebarWidth } = validation.data;
        console.log('💾💾💾 SERVER RECEIVED WORKSPACE DATA:', JSON.stringify(validation.data, null, 2));
        console.log(`💾 Updating workspace for user ${userId}:`, {
            tilesCount: tiles ? Array.isArray(tiles) ? tiles.length : 0 : 'unchanged',
            hasLayouts: layouts ? Object.keys(layouts).length > 0 : 'unchanged',
            sidebarWidth: sidebarWidth || 'unchanged'
        });
        // Get user's team ID first
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { teamId: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const updateData = {};
        if (tiles !== undefined) {
            updateData.workspaceTiles = tiles;
            console.log('🔍 Setting workspaceTiles to:', JSON.stringify(tiles));
        }
        if (layouts !== undefined) {
            updateData.workspaceLayouts = layouts;
            console.log('🔍 Setting workspaceLayouts to:', JSON.stringify(layouts));
        }
        if (sidebarWidth !== undefined) {
            updateData.sidebarWidth = sidebarWidth;
            console.log('🔍 Setting sidebarWidth to:', sidebarWidth);
        }
        console.log('📦 Full updateData being sent to Prisma:', JSON.stringify(updateData, null, 2));
        console.log('🔑 Updating team with ID:', user.teamId);
        const updatedTeam = await prisma.teams.update({
            where: { id: user.teamId },
            data: updateData,
            select: {
                id: true,
                workspaceTiles: true,
                workspaceLayouts: true,
                sidebarWidth: true
            }
        });
        console.log('🔍 Response from Prisma after update:', {
            id: updatedTeam.id,
            workspaceTiles: JSON.stringify(updatedTeam.workspaceTiles),
            workspaceLayouts: JSON.stringify(updatedTeam.workspaceLayouts),
            sidebarWidth: updatedTeam.sidebarWidth
        });
        // Verify the data was actually saved
        const verifyTeam = await prisma.teams.findUnique({
            where: { id: user.teamId },
            select: {
                workspaceTiles: true,
                workspaceLayouts: true,
                sidebarWidth: true
            }
        });
        console.log('✅ Verification query - data in database:', {
            workspaceTiles: JSON.stringify(verifyTeam?.workspaceTiles),
            workspaceLayouts: JSON.stringify(verifyTeam?.workspaceLayouts),
            sidebarWidth: verifyTeam?.sidebarWidth
        });
        console.log(`✅ Workspace updated successfully for team ${updatedTeam.id}`);
        res.json({
            tiles: updatedTeam.workspaceTiles || [],
            layouts: updatedTeam.workspaceLayouts || {},
            sidebarWidth: updatedTeam.sidebarWidth,
            message: 'Team workspace configuration updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating workspace config:', error);
        res.status(500).json({ error: 'Failed to update workspace configuration' });
    }
});
// Clear team workspace configuration (reset to defaults)
router.delete('/config', authenticateToken, async (req, res) => {
    try {
        // Use req.userId which is set by the authenticateToken middleware
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Get user's team ID first
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { teamId: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await prisma.teams.update({
            where: { id: user.teamId },
            data: {
                workspaceTiles: null,
                workspaceLayouts: null,
                sidebarWidth: 256
            }
        });
        res.json({ message: 'Team workspace configuration reset to defaults' });
    }
    catch (error) {
        console.error('Error resetting workspace config:', error);
        res.status(500).json({ error: 'Failed to reset workspace configuration' });
    }
});
export default router;
