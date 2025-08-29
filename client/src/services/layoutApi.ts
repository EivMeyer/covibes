// Core requirement: Layout persistence API service
// Enables saving and loading user dashboard layouts from server

import { apiService } from './api'

export interface LayoutData {
  // Dashboard layout preferences (react-grid-layout format)
  dashboardLayouts?: {
    lg: Array<{
      i: string
      x: number
      y: number
      w: number
      h: number
      minW?: number
      minH?: number
      maxW?: number
      maxH?: number
    }>
  }
  
  // Workspace tiles configuration
  workspaceTiles?: Array<{
    id: string
    type: 'terminal' | 'chat' | 'preview' | 'ide'
    title: string
    agentId?: string
  }>
  
  // Sidebar configuration
  sidebarWidth?: number
  
  // Other layout preferences
  [key: string]: any
}

export interface LayoutResponse {
  success: boolean
  layoutData: LayoutData | null
  lastUpdated: string | null
}

export interface SaveLayoutResponse {
  success: boolean
  message: string
  lastUpdated: string
}

class LayoutApiService {
  /**
   * Get user's layout preferences for current team
   * @param layoutType - Type of layout to retrieve (default: 'dashboard')
   */
  async getLayout(layoutType: string = 'dashboard'): Promise<LayoutResponse> {
    try {
      const response = await apiService.axiosInstance.get(`/layout?type=${layoutType}`)
      return response.data
    } catch (error) {
      console.error('Failed to load layout preferences:', error)
      // Return empty state on error so UI can use defaults
      return {
        success: false,
        layoutData: null,
        lastUpdated: null,
      }
    }
  }

  /**
   * Save user's layout preferences
   * @param layoutData - Layout configuration to save
   * @param layoutType - Type of layout to save (default: 'dashboard')
   */
  async saveLayout(
    layoutData: LayoutData,
    layoutType: string = 'dashboard'
  ): Promise<SaveLayoutResponse> {
    try {
      const response = await apiService.axiosInstance.post('/layout', {
        layoutType,
        layoutData,
      })
      return response.data
    } catch (error) {
      console.error('Failed to save layout preferences:', error)
      throw new Error('Failed to save layout preferences')
    }
  }

  /**
   * Reset user's layout preferences to default
   * @param layoutType - Type of layout to reset (default: 'dashboard')
   */
  async resetLayout(layoutType: string = 'dashboard'): Promise<SaveLayoutResponse> {
    try {
      const response = await apiService.axiosInstance.delete(`/layout?type=${layoutType}`)
      return response.data
    } catch (error) {
      console.error('Failed to reset layout preferences:', error)
      throw new Error('Failed to reset layout preferences')
    }
  }

  /**
   * Load layout with fallback to localStorage
   * This provides offline support and migration from localStorage
   */
  async loadLayoutWithFallback(
    layoutType: string = 'dashboard',
    localStorageKeys: string[]
  ): Promise<LayoutData | null> {
    try {
      // Try to load from server first
      const serverResponse = await this.getLayout(layoutType)
      
      if (serverResponse.success && serverResponse.layoutData) {
        console.log('✅ Loaded layout from server')
        return serverResponse.layoutData
      }
      
      // Fallback to localStorage if server doesn't have data
      console.log('📦 Falling back to localStorage')
      const localData: LayoutData = {}
      
      for (const key of localStorageKeys) {
        const stored = localStorage.getItem(key)
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            
            // Map localStorage keys to our layout data structure
            if (key === 'dashboard-layouts') {
              localData.dashboardLayouts = parsed
            } else if (key === 'workspace-tiles') {
              localData.workspaceTiles = parsed
            } else if (key === 'sidebar-width') {
              localData.sidebarWidth = parseInt(stored, 10)
            }
          } catch (e) {
            console.warn(`Failed to parse localStorage key ${key}:`, e)
          }
        }
      }
      
      // If we found localStorage data, save it to server for future
      if (Object.keys(localData).length > 0) {
        console.log('🔄 Migrating localStorage data to server')
        try {
          await this.saveLayout(localData, layoutType)
          console.log('✅ Successfully migrated localStorage to server')
        } catch (e) {
          console.warn('⚠️ Failed to migrate localStorage to server:', e)
        }
      }
      
      return Object.keys(localData).length > 0 ? localData : null
    } catch (error) {
      console.error('Failed to load layout with fallback:', error)
      return null
    }
  }

  /**
   * Save layout with fallback to localStorage
   * This ensures layout is saved even if server is unavailable
   */
  async saveLayoutWithFallback(
    layoutData: LayoutData,
    layoutType: string = 'dashboard',
    localStorageKeys?: { [key in keyof LayoutData]?: string }
  ): Promise<boolean> {
    let serverSaved = false
    let localSaved = false

    // Try to save to server
    try {
      await this.saveLayout(layoutData, layoutType)
      serverSaved = true
      console.log('✅ Saved layout to server')
    } catch (error) {
      console.warn('⚠️ Failed to save layout to server, using localStorage fallback')
    }

    // Always save to localStorage as backup
    try {
      if (localStorageKeys) {
        Object.entries(localStorageKeys).forEach(([dataKey, storageKey]) => {
          const value = layoutData[dataKey as keyof LayoutData]
          if (value !== undefined && storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(value))
          }
        })
      } else {
        // Default localStorage mapping
        if (layoutData.dashboardLayouts) {
          localStorage.setItem('dashboard-layouts', JSON.stringify(layoutData.dashboardLayouts))
        }
        if (layoutData.workspaceTiles) {
          localStorage.setItem('workspace-tiles', JSON.stringify(layoutData.workspaceTiles))
        }
        if (layoutData.sidebarWidth) {
          localStorage.setItem('sidebar-width', layoutData.sidebarWidth.toString())
        }
      }
      localSaved = true
      console.log('✅ Saved layout to localStorage')
    } catch (error) {
      console.warn('⚠️ Failed to save layout to localStorage:', error)
    }

    return serverSaved || localSaved
  }
}

// Export singleton instance
export const layoutApi = new LayoutApiService()
export default layoutApi