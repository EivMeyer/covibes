import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import type { User, Team } from '@/types'

// Mock data for providers
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

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: User
  team?: Team
  authenticated?: boolean
}

interface RenderResultWithUser extends RenderResult {
  user: ReturnType<typeof userEvent.setup>
}

const AllTheProviders = ({ 
  children, 
  user: _user = mockUser, 
  team: _team = mockTeam, 
  authenticated: _authenticated = true 
}: {
  children: ReactNode
  user?: User | undefined
  team?: Team | undefined
  authenticated?: boolean | undefined
}) => {
  // Since AppProvider uses hooks internally, we need to mock the hooks instead
  // For now, just return the children wrapped in a div for testing
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  )
}

const customRender = (
  ui: ReactElement,
  { user, team, authenticated, ...options }: CustomRenderOptions = {}
): RenderResultWithUser => {
  const userEventInstance = userEvent.setup()

  return {
    user: userEventInstance,
    ...render(ui, {
      wrapper: (props) => (
        <AllTheProviders 
          {...props} 
          user={user}
          team={team}
          authenticated={authenticated}
        />
      ),
      ...options
    })
  }
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Helper functions
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  ...mockUser,
  ...overrides
})

export const createMockTeam = (overrides: Partial<Team> = {}): Team => ({
  ...mockTeam,
  ...overrides
})

// Wait helper for async operations
export const waitFor = async (callback: () => void | Promise<void>, timeout = 1000) => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    try {
      await callback()
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  throw new Error(`waitFor timeout after ${timeout}ms`)
}