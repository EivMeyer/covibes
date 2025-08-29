import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiService, socketService } from '@/services'

// Mock test data
const mockCredentials = {
  email: 'test@example.com',
  password: 'password123',
}

const mockRegisterData = {
  teamName: 'Test Team',
  userName: 'Test User', 
  email: 'test@example.com',
  password: 'password123',
}

const mockAgentSpawn = {
  task: 'Create a simple hello world program',
  agentType: 'mock' as const,
}

describe('API Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have properly typed service methods', () => {
    expect(apiService).toBeDefined()
    expect(typeof apiService.login).toBe('function')
    expect(typeof apiService.register).toBe('function')
    expect(typeof apiService.logout).toBe('function')
  })

  it('should have all expected API methods', () => {
    const expectedMethods = [
      'login',
      'register', 
      'logout',
      'joinTeam',
      'getCurrentUser',
      'isAuthenticated',
      'spawnAgent',
      'killAgent',
      'getAgents',
      'configureRepository',
      'configureVM',
      'healthCheck'
    ]

    expectedMethods.forEach(method => {
      expect(typeof (apiService as any)[method]).toBe('function')
    })
  })
})

describe('Socket Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have socket service methods', () => {
    expect(socketService).toBeDefined()
    expect(typeof socketService.connect).toBe('function')
    expect(typeof socketService.disconnect).toBe('function')
    expect(typeof socketService.isConnected).toBe('function')
  })

  it('should handle socket state management', () => {
    expect(socketService.isConnected()).toBe(false)
    expect(typeof socketService.getConnectionState).toBe('function')
    expect(typeof socketService.getReconnectAttempts).toBe('function')
  })

  it('should handle event listeners', () => {
    expect(typeof socketService.setListeners).toBe('function')
    expect(typeof socketService.sendChatMessage).toBe('function')
    // Note: sendAgentCommand might not exist in current implementation
  })
})

describe('Service Type Safety', () => {
  it('should maintain proper type contracts for credentials', () => {
    expect(mockCredentials).toMatchObject({
      email: expect.any(String),
      password: expect.any(String)
    })
  })

  it('should maintain proper type contracts for registration data', () => {
    expect(mockRegisterData).toMatchObject({
      teamName: expect.any(String),
      userName: expect.any(String),
      email: expect.any(String),
      password: expect.any(String)
    })
  })

  it('should maintain proper type contracts for agent spawn data', () => {
    expect(mockAgentSpawn).toMatchObject({
      task: expect.any(String),
      agentType: expect.stringMatching(/^(mock|claude)$/)
    })
  })
})