import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'
import { apiService } from '@/services/api'

// Mock the API service
vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api')
  return {
    ...actual,
    apiService: {
      isAuthenticated: vi.fn(),
      getCurrentUser: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      joinTeam: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
    },
  }
})

const mockApiService = apiService as any

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes and completes loading', async () => {
    mockApiService.isAuthenticated.mockReturnValue(false)
    
    const { result } = renderHook(() => useAuth())
    
    // Wait for initialization to complete since it happens in useEffect
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.user).toBe(null)
    expect(result.current.team).toBe(null)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('sets unauthenticated state when no token exists', async () => {
    mockApiService.isAuthenticated.mockReturnValue(false)
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBe(null)
    expect(result.current.team).toBe(null)
  })

  it('loads user data when authenticated', async () => {
    const mockUser = {
      id: '1',
      teamId: '1',
      userName: 'Test User',
      email: 'test@example.com',
    }
    const mockTeam = {
      id: '1',
      name: 'Test Team',
      inviteCode: 'test-code',
    }

    mockApiService.isAuthenticated.mockReturnValue(true)
    mockApiService.getCurrentUser.mockResolvedValue({
      user: mockUser,
      team: mockTeam,
    })
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.team).toEqual(mockTeam)
  })

  it('handles login successfully', async () => {
    const mockUser = {
      id: '1',
      teamId: '1', 
      userName: 'Test User',
      email: 'test@example.com',
    }
    const mockTeam = {
      id: '1',
      name: 'Test Team',
      inviteCode: 'test-code',
    }

    mockApiService.isAuthenticated.mockReturnValue(false)
    mockApiService.login.mockResolvedValue({
      token: 'test-token',
      user: mockUser,
      team: mockTeam,
    })
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      })
    })
    
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.team).toEqual(mockTeam)
    expect(result.current.error).toBe(null)
  })

  it('handles login error', async () => {
    const mockError = new Error('Invalid credentials')
    
    mockApiService.isAuthenticated.mockReturnValue(false)
    mockApiService.login.mockRejectedValue(mockError)
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      try {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrong-password',
        })
      } catch {
        // Expected to throw
      }
    })
    
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBe('Login failed')
    expect(result.current.user).toBe(null)
  })

  it('handles register successfully', async () => {
    const mockUser = {
      id: '1',
      teamId: '1',
      userName: 'New User',
      email: 'new@example.com',
    }
    const mockTeam = {
      id: '1', 
      name: 'New Team',
      inviteCode: 'new-code',
    }

    mockApiService.isAuthenticated.mockReturnValue(false)
    mockApiService.register.mockResolvedValue({
      token: 'test-token',
      user: mockUser,
      team: mockTeam,
    })
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.register({
        teamName: 'New Team',
        userName: 'New User',
        email: 'new@example.com',
        password: 'password123',
      })
    })
    
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.team).toEqual(mockTeam)
  })

  it('handles logout', async () => {
    // First set up authenticated state
    const mockUser = {
      id: '1',
      teamId: '1',
      userName: 'Test User',
      email: 'test@example.com',
    }
    const mockTeam = {
      id: '1',
      name: 'Test Team', 
      inviteCode: 'test-code',
    }

    mockApiService.isAuthenticated.mockReturnValue(true)
    mockApiService.getCurrentUser.mockResolvedValue({
      user: mockUser,
      team: mockTeam,
    })
    mockApiService.logout.mockResolvedValue(undefined)
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Logout
    await act(async () => {
      await result.current.logout()
    })
    
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBe(null)
    expect(result.current.team).toBe(null)
  })

  it('clears error', async () => {
    const mockError = new Error('Test error')
    
    mockApiService.isAuthenticated.mockReturnValue(false)
    mockApiService.login.mockRejectedValue(mockError)
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Create an error
    await act(async () => {
      try {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrong-password',
        })
      } catch {
        // Expected to throw
      }
    })
    
    expect(result.current.error).toBe('Login failed')
    
    // Clear error
    act(() => {
      result.current.clearError()
    })
    
    expect(result.current.error).toBe(null)
  })

  it('handles join team successfully', async () => {
    const mockUser = {
      id: '2',
      teamId: '1',
      userName: 'Joining User',
      email: 'join@example.com',
    }
    const mockTeam = {
      id: '1',
      name: 'Existing Team',
      inviteCode: 'existing-code',
    }

    mockApiService.isAuthenticated.mockReturnValue(false)
    mockApiService.joinTeam.mockResolvedValue({
      token: 'join-token',
      user: mockUser,
      team: mockTeam,
    })
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.joinTeam({
        inviteCode: 'existing-code',
        userName: 'Joining User',
        email: 'join@example.com',
        password: 'password123',
      })
    })
    
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.team).toEqual(mockTeam)
  })
})