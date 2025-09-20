import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import type { RequestWithUser } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get both user and team settings
router.get('/', authenticateToken, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.user!.teamId;

    // Fetch user settings
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { soundsEnabled: true }
    });

    // Fetch team settings
    const team = await prisma.teams.findUnique({
      where: { id: teamId },
      select: { enableContextSharing: true }
    });

    if (!user || !team) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({
      user: {
        soundsEnabled: user.soundsEnabled
      },
      team: {
        enableContextSharing: team.enableContextSharing
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update user settings
router.put('/user', authenticateToken, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user!.userId;
    const { soundsEnabled } = req.body;

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { soundsEnabled },
      select: { soundsEnabled: true }
    });

    res.json({ soundsEnabled: updatedUser.soundsEnabled });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

// Update team settings (all users can update since everyone is admin)
router.put('/team', authenticateToken, async (req: RequestWithUser, res) => {
  try {
    const teamId = req.user!.teamId;
    const { enableContextSharing } = req.body;

    const updatedTeam = await prisma.teams.update({
      where: { id: teamId },
      data: { enableContextSharing },
      select: { enableContextSharing: true }
    });

    // If context sharing setting changed, we should regenerate claude configs for active agents
    // This will be handled by the claude-config-manager when agents are spawned next time

    res.json({ enableContextSharing: updatedTeam.enableContextSharing });
  } catch (error) {
    console.error('Error updating team settings:', error);
    res.status(500).json({ error: 'Failed to update team settings' });
  }
});

export default router;