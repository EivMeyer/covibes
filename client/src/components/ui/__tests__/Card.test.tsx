import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { Card, CardHeader, CardContent, CardFooter } from '../Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default props correctly', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('p-4', 'bg-midnight-800', 'border', 'border-midnight-600', 'rounded-lg', 'shadow-card')
  })

  it('applies different padding sizes', () => {
    const { rerender } = render(<Card padding="none" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).not.toHaveClass('p-4')

    rerender(<Card padding="sm" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('p-3')

    rerender(<Card padding="md" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('p-4')

    rerender(<Card padding="lg" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('p-6')
  })

  it('applies different variants', () => {
    const { rerender } = render(<Card variant="default" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('bg-midnight-800', 'border-midnight-600')

    rerender(<Card variant="dark" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('bg-midnight-700', 'border-midnight-500')

    rerender(<Card variant="darker" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('bg-midnight-900', 'border-midnight-700')
  })

  it('applies custom className', () => {
    render(<Card className="custom-card" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('custom-card')
  })

  it('forwards additional props', () => {
    render(<Card data-custom="test" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveAttribute('data-custom', 'test')
  })
})

describe('CardHeader', () => {
  it('renders with title and subtitle', () => {
    render(
      <CardHeader title="Test Title" subtitle="Test Subtitle" />
    )
    
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
    expect(screen.getByText('Test Title')).toHaveClass('text-lg', 'font-semibold', 'text-white')
    expect(screen.getByText('Test Subtitle')).toHaveClass('text-sm', 'text-gray-400')
  })

  it('renders with action element', () => {
    const action = <button>Action Button</button>
    render(<CardHeader title="Title" action={action} />)
    
    expect(screen.getByText('Action Button')).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <CardHeader>
        <div>Custom Header Content</div>
      </CardHeader>
    )
    
    expect(screen.getByText('Custom Header Content')).toBeInTheDocument()
  })

  it('renders with only title', () => {
    render(<CardHeader title="Only Title" />)
    
    expect(screen.getByText('Only Title')).toBeInTheDocument()
    expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument()
  })

  it('renders with only subtitle', () => {
    render(<CardHeader subtitle="Only Subtitle" />)
    
    expect(screen.getByText('Only Subtitle')).toBeInTheDocument()
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<CardHeader className="custom-header" data-testid="header" title="Title" />)
    expect(screen.getByTestId('header')).toHaveClass('custom-header')
  })
})

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content body</CardContent>)
    expect(screen.getByText('Content body')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<CardContent className="custom-content" data-testid="content">Content</CardContent>)
    expect(screen.getByTestId('content')).toHaveClass('custom-content')
  })

  it('forwards additional props', () => {
    render(<CardContent data-custom="test" data-testid="content">Content</CardContent>)
    expect(screen.getByTestId('content')).toHaveAttribute('data-custom', 'test')
  })
})

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(<CardFooter>Footer content</CardFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('applies default styles', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveClass('mt-4', 'pt-4', 'border-t', 'border-midnight-600')
  })

  it('applies custom className', () => {
    render(<CardFooter className="custom-footer" data-testid="footer">Footer</CardFooter>)
    expect(screen.getByTestId('footer')).toHaveClass('custom-footer')
  })

  it('forwards additional props', () => {
    render(<CardFooter data-custom="test" data-testid="footer">Footer</CardFooter>)
    expect(screen.getByTestId('footer')).toHaveAttribute('data-custom', 'test')
  })
})

describe('Card Components Integration', () => {
  it('renders a complete card with all components', () => {
    const action = <button>Edit</button>
    
    render(
      <Card data-testid="full-card">
        <CardHeader 
          title="Card Title" 
          subtitle="Card description"
          action={action}
        />
        <CardContent>
          <p>This is the card body content.</p>
        </CardContent>
        <CardFooter>
          <button>Footer Action</button>
        </CardFooter>
      </Card>
    )
    
    const card = screen.getByTestId('full-card')
    expect(card).toBeInTheDocument()
    
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card description')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('This is the card body content.')).toBeInTheDocument()
    expect(screen.getByText('Footer Action')).toBeInTheDocument()
  })
})