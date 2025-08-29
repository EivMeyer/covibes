import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { Input } from '../Input'

describe('Input', () => {
  it('renders basic input correctly', () => {
    render(<Input placeholder="Enter text" />)
    
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('renders with label', () => {
    render(<Input label="Username" id="username" />)
    
    const label = screen.getByText('Username')
    const input = screen.getByLabelText('Username')
    
    expect(label).toBeInTheDocument()
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'username')
  })

  it('shows required indicator when required', () => {
    render(<Input label="Email" required />)
    
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeRequired()
  })

  it('handles different input types', () => {
    const { rerender } = render(<Input type="email" data-testid="input" />)
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'email')

    rerender(<Input type="password" data-testid="input" />)
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'password')

    rerender(<Input type="number" data-testid="input" />)
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'number')
  })

  it('handles controlled input value', () => {
    const { rerender } = render(<Input value="test value" onChange={vi.fn()} />)
    
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('test value')

    rerender(<Input value="updated value" onChange={vi.fn()} />)
    expect(input.value).toBe('updated value')
  })

  it('calls onChange when input changes', async () => {
    const handleChange = vi.fn()
    const { user } = render(<Input onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'hello')
    
    expect(handleChange).toHaveBeenCalledTimes(5) // Once per character
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: 'hello' })
      })
    )
  })

  it('calls onFocus and onBlur events', async () => {
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()
    const { user } = render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
    
    const input = screen.getByRole('textbox')
    
    await user.click(input)
    expect(handleFocus).toHaveBeenCalledOnce()
    
    await user.tab()
    expect(handleBlur).toHaveBeenCalledOnce()
  })

  it('shows error state', () => {
    render(<Input error="This field is required" />)
    
    const input = screen.getByRole('textbox')
    const errorMessage = screen.getByText('This field is required')
    
    expect(input).toHaveClass('border-coral', 'focus:ring-coral')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage).toHaveClass('text-coral')
  })

  it('handles disabled state', async () => {
    const handleChange = vi.fn()
    const { user } = render(<Input disabled onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    
    await user.type(input, 'should not work')
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-input')
  })

  it('forwards additional props', () => {
    render(<Input data-testid="custom-input" autoComplete="username" />)
    
    const input = screen.getByTestId('custom-input')
    expect(input).toHaveAttribute('autoComplete', 'username')
  })

  it('handles autoFocus', () => {
    render(<Input autoFocus />)
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('associates label with input using htmlFor', () => {
    render(<Input label="Test Label" id="test-input" />)
    
    const label = screen.getByText('Test Label')
    const input = screen.getByRole('textbox')
    
    expect(label).toHaveAttribute('for', 'test-input')
    expect(input).toHaveAttribute('id', 'test-input')
  })
})