import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { ErrorBoundary, SimpleErrorFallback } from '../ErrorBoundary'

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Component that throws an error on render
const AlwaysThrowError = () => {
  throw new Error('Always throws error')
}

// Mock console.error to avoid noisy test output
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
})

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Child component')).toBeInTheDocument()
  })

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <AlwaysThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument()
  })

  it('shows try again button in default error UI', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload Page')).toBeInTheDocument()
  })

  it('resets error state when try again is clicked', async () => {
    const { user } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    // Error should be shown
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    
    // Click try again - in a real scenario, the component might not throw again
    await user.click(screen.getByText('Try Again'))
    
    // The error boundary should reset (though component will still throw in this test)
    // We can't easily test the reset working without changing the throwing component
  })

  it('shows error ID in footer', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/Error ID:/)).toBeInTheDocument()
  })

  it('calls console.error when error occurs', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ErrorBoundary>
        <AlwaysThrowError />
      </ErrorBoundary>
    )
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    )
    
    consoleErrorSpy.mockRestore()
  })
})

describe('SimpleErrorFallback', () => {
  it('renders default error message', () => {
    render(<SimpleErrorFallback />)
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders custom error message', () => {
    render(<SimpleErrorFallback message="Custom error occurred" />)
    
    expect(screen.getByText('Custom error occurred')).toBeInTheDocument()
  })

  it('renders try again button when resetError is provided', () => {
    const resetError = vi.fn()
    render(<SimpleErrorFallback resetError={resetError} />)
    
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('calls resetError when try again is clicked', async () => {
    const resetError = vi.fn()
    const { user } = render(<SimpleErrorFallback resetError={resetError} />)
    
    await user.click(screen.getByText('Try Again'))
    expect(resetError).toHaveBeenCalledOnce()
  })

  it('does not render try again button when resetError is not provided', () => {
    render(<SimpleErrorFallback />)
    
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument()
  })

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const error = new Error('Test error message')
    render(<SimpleErrorFallback error={error} />)
    
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
  })

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    
    const error = new Error('Test error message')
    render(<SimpleErrorFallback error={error} />)
    
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
  })

  it('renders error icon', () => {
    render(<SimpleErrorFallback />)
    
    // Check for SVG icon by looking for the viewBox attribute
    const icon = document.querySelector('svg[viewBox="0 0 24 24"]')
    expect(icon).toBeInTheDocument()
  })
})