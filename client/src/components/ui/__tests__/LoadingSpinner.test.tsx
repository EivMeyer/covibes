import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { LoadingSpinner, LoadingOverlay } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders spinner correctly', () => {
    render(<LoadingSpinner />)
    
    // Look for spinner by finding the SVG with animation class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders with custom text', () => {
    render(<LoadingSpinner text="Loading data..." />)
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('does not render text by default', () => {
    render(<LoadingSpinner />)
    
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('applies different sizes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />)
    expect(document.querySelector('.h-5.w-5')).toBeInTheDocument()

    rerender(<LoadingSpinner size="md" />)
    expect(document.querySelector('.h-8.w-8')).toBeInTheDocument()

    rerender(<LoadingSpinner size="lg" />)
    expect(document.querySelector('.h-16.w-16')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <div data-testid="container">
        <LoadingSpinner className="custom-spinner" />
      </div>
    )
    
    const container = screen.getByTestId('container')
    expect(container.querySelector('.custom-spinner')).toBeInTheDocument()
  })
})

describe('LoadingOverlay', () => {
  it('renders overlay with default text', () => {
    render(<LoadingOverlay />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
  })

  it('renders overlay with custom text', () => {
    render(<LoadingOverlay text="Please wait..." />)
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument()
  })

  it('has proper overlay styling', () => {
    render(<LoadingOverlay />)
    
    const overlay = document.querySelector('.fixed.inset-0')
    expect(overlay).toHaveClass('bg-black/70', 'backdrop-blur-sm', 'z-50')
  })
})