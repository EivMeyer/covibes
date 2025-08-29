import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

// Core requirement: Layout persistence per user per project (team)
// User's dashboard layout should persist when they logout and login to the same project

// GET /api/layout - Get user's layout preferences for current team
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId
    const teamId = req.user?.teamId
    const layoutType = (req.query['type'] as string) || 'dashboard'

    if (!userId || !teamId) {
      return res.status(400).json({ error: 'User ID and Team ID are required' })
    }

    // Find the user's layout preference for this team and layout type
    const layoutPreference = await prisma.userLayoutPreference.findUnique({
      where: {
        userId_teamId_layoutType: {
          userId,
          teamId,
          layoutType,
        },
      },
    })

    if (layoutPreference) {
      res.json({
        success: true,
        layoutData: layoutPreference.layoutData,
        lastUpdated: layoutPreference.updatedAt,
      })
    } else {
      // No saved layout found, return empty state
      res.json({
        success: true,
        layoutData: null,
        lastUpdated: null,
      })
    }
  } catch (error: any) {
    console.error('Error fetching layout preferences:', error)
    res.status(500).json({ error: 'Failed to fetch layout preferences' })
  }
})

// POST /api/layout - Save/update user's layout preferences
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId
    const teamId = req.user?.teamId
    const { layoutType = 'dashboard', layoutData } = req.body

    if (!userId || !teamId) {
      return res.status(400).json({ error: 'User ID and Team ID are required' })
    }

    if (!layoutData) {
      return res.status(400).json({ error: 'Layout data is required' })
    }

    // Validate layoutData is a valid JSON object
    if (typeof layoutData !== 'object' || layoutData === null) {
      return res.status(400).json({ error: 'Layout data must be a valid JSON object' })
    }

    // Use upsert to create or update the layout preference
    const layoutPreference = await prisma.userLayoutPreference.upsert({
      where: {
        userId_teamId_layoutType: {
          userId,
          teamId,
          layoutType,
        },
      },
      update: {
        layoutData,
        updatedAt: new Date(),
      },
      create: {
        userId,
        teamId,
        layoutType,
        layoutData,
      },
    })

    res.json({
      success: true,
      message: 'Layout preferences saved successfully',
      lastUpdated: layoutPreference.updatedAt,
    })
  } catch (error: any) {
    console.error('Error saving layout preferences:', error)
    res.status(500).json({ error: 'Failed to save layout preferences' })
  }
})

// DELETE /api/layout - Delete user's layout preferences (reset to default)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId
    const teamId = req.user?.teamId
    const layoutType = (req.query['type'] as string) || 'dashboard'

    if (!userId || !teamId) {
      return res.status(400).json({ error: 'User ID and Team ID are required' })
    }

    // Delete the layout preference
    await prisma.userLayoutPreference.delete({
      where: {
        userId_teamId_layoutType: {
          userId,
          teamId,
          layoutType,
        },
      },
    })

    res.json({
      success: true,
      message: 'Layout preferences reset successfully',
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      // Record not found, that's fine
      res.json({
        success: true,
        message: 'Layout preferences were already at default',
      })
    } else {
      console.error('Error deleting layout preferences:', error)
      res.status(500).json({ error: 'Failed to reset layout preferences' })
    }
  }
})

export default router