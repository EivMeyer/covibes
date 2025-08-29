import { http, HttpResponse } from 'msw'
import type { User, Team, Agent, ChatMessage } from '@/types'

// Mock data
const mockUser: User = {
  id: '1',
  teamId: '1',
  name: 'testuser',
  email: 'test@example.com',
  createdAt: new Date().toISOString()
}

const mockTeam: Team = {
  id: '1',
  name: 'Test Team',
  inviteCode: 'TEST123',
  createdAt: new Date().toISOString()
}

const mockAgent: Agent = {
  id: '1',
  task: 'Test Agent',
  status: 'running',
  agentType: 'mock',
  teamId: '1',
  userId: '1',
  startedAt: new Date().toISOString()
}

const mockMessage: ChatMessage = {
  id: '1',
  content: 'Test message',
  userId: '1',
  userName: 'testuser',
  teamId: '1',
  timestamp: new Date().toISOString(),
  type: 'user'
}

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/register', () => {
    return HttpResponse.json({
      success: true,
      user: mockUser,
      team: mockTeam,
      token: 'mock-jwt-token'
    })
  }),

  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      success: true,
      user: mockUser,
      team: mockTeam,
      token: 'mock-jwt-token'
    })
  }),

  http.post('/api/auth/join', () => {
    return HttpResponse.json({
      success: true,
      user: mockUser,
      team: mockTeam,
      token: 'mock-jwt-token'
    })
  }),

  // Team endpoints
  http.get('/api/teams/:teamId/users', () => {
    return HttpResponse.json({ users: [mockUser] })
  }),

  // Agent endpoints
  http.get('/api/teams/:teamId/agents', () => {
    return HttpResponse.json({ agents: [mockAgent] })
  }),

  http.post('/api/teams/:teamId/agents', () => {
    return HttpResponse.json({
      success: true,
      agent: { ...mockAgent, id: Date.now().toString() }
    })
  }),

  http.delete('/api/teams/:teamId/agents/:agentId', () => {
    return HttpResponse.json({ success: true })
  }),

  // Chat endpoints
  http.get('/api/teams/:teamId/messages', () => {
    return HttpResponse.json({ messages: [mockMessage] })
  }),

  http.post('/api/teams/:teamId/messages', () => {
    return HttpResponse.json({
      success: true,
      message: { ...mockMessage, id: Date.now().toString() }
    })
  }),

  // Config endpoints
  http.post('/api/teams/:teamId/config/repo', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/teams/:teamId/config/vm', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/teams/:teamId/config', () => {
    return HttpResponse.json({
      repoUrl: 'https://github.com/test/repo',
      vmConfig: {
        host: 'test-vm',
        port: 22,
        username: 'ubuntu'
      }
    })
  })
]