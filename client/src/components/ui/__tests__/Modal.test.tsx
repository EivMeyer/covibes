import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { Modal, ModalFooter } from '../Modal'

describe('Modal', () => {
  beforeEach(() => {
    // Reset body overflow style before each test
    document.body.style.overflow = 'unset'
  })

  afterEach(() => {
    // Clean up body overflow style after each test
    document.body.style.overflow = 'unset'
  })

  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={vi.fn()}>Content</Modal>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders with title', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        Content
      </Modal>
    )
    
    const title = screen.getByText('Test Modal')
    const dialog = screen.getByRole('dialog')
    
    expect(title).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
  })

  it('shows close button by default', () => {
    render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>)
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument()
  })

  it('hides close button when showCloseButton is false', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} showCloseButton={false}>
        Content
      </Modal>
    )
    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn()
    const { user } = render(<Modal isOpen={true} onClose={handleClose}>Content</Modal>)
    
    await user.click(screen.getByLabelText('Close modal'))
    expect(handleClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when escape key is pressed', async () => {
    const handleClose = vi.fn()
    const { user } = render(<Modal isOpen={true} onClose={handleClose}>Content</Modal>)
    
    await user.keyboard('{Escape}')
    expect(handleClose).toHaveBeenCalledOnce()
  })

  it('does not close on escape when closeOnEscape is false', async () => {
    const handleClose = vi.fn()
    const { user } = render(
      <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
        Content
      </Modal>
    )
    
    await user.keyboard('{Escape}')
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const handleClose = vi.fn()
    const { user } = render(<Modal isOpen={true} onClose={handleClose}>Content</Modal>)
    
    // Click on the backdrop (the overlay div)
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(handleClose).toHaveBeenCalledOnce()
  })

  it('does not close when backdrop is clicked if closeOnBackdropClick is false', async () => {
    const handleClose = vi.fn()
    const { user } = render(
      <Modal isOpen={true} onClose={handleClose} closeOnBackdropClick={false}>
        Content
      </Modal>
    )
    
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('does not close when clicking inside modal content', async () => {
    const handleClose = vi.fn()
    const { user } = render(<Modal isOpen={true} onClose={handleClose}>Content</Modal>)
    
    await user.click(screen.getByText('Content'))
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Modal isOpen={true} onClose={vi.fn()} size="sm">Content</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-md')

    rerender(<Modal isOpen={true} onClose={vi.fn()} size="md">Content</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-lg')

    rerender(<Modal isOpen={true} onClose={vi.fn()} size="lg">Content</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-2xl')

    rerender(<Modal isOpen={true} onClose={vi.fn()} size="xl">Content</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-4xl')
  })

  it('applies custom className', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} className="custom-modal">
        Content
      </Modal>
    )
    expect(screen.getByRole('dialog')).toHaveClass('custom-modal')
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('resets body overflow when closed', () => {
    const { rerender } = render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    
    rerender(<Modal isOpen={false} onClose={vi.fn()}>Content</Modal>)
    expect(document.body.style.overflow).toBe('unset')
  })

  it('has proper accessibility attributes', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Accessible Modal">
        Content
      </Modal>
    )
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
  })
})

describe('ModalFooter', () => {
  it('renders default cancel and confirm buttons', () => {
    const handleCancel = vi.fn()
    const handleConfirm = vi.fn()
    
    render(
      <ModalFooter onCancel={handleCancel} onConfirm={handleConfirm} />
    )
    
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('renders custom button text', () => {
    const handleCancel = vi.fn()
    const handleConfirm = vi.fn()
    
    render(
      <ModalFooter 
        onCancel={handleCancel} 
        onConfirm={handleConfirm}
        cancelText="No"
        confirmText="Yes"
      />
    )
    
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('calls handlers when buttons are clicked', async () => {
    const handleCancel = vi.fn()
    const handleConfirm = vi.fn()
    const { user } = render(
      <ModalFooter onCancel={handleCancel} onConfirm={handleConfirm} />
    )
    
    await user.click(screen.getByText('Cancel'))
    expect(handleCancel).toHaveBeenCalledOnce()
    
    await user.click(screen.getByText('Confirm'))
    expect(handleConfirm).toHaveBeenCalledOnce()
  })

  it('shows loading state on confirm button', () => {
    render(
      <ModalFooter onConfirm={vi.fn()} isLoading={true} />
    )
    
    const confirmButton = screen.getByRole('button', { name: 'Loading' })
    expect(confirmButton).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('disables buttons when loading', async () => {
    const handleCancel = vi.fn()
    const handleConfirm = vi.fn()
    const { user } = render(
      <ModalFooter 
        onCancel={handleCancel} 
        onConfirm={handleConfirm}
        isLoading={true}
      />
    )
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    const confirmButton = screen.getByRole('button', { name: 'Loading' })
    
    expect(cancelButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
    
    await user.click(cancelButton)
    expect(handleCancel).not.toHaveBeenCalled()
  })

  it('applies different confirm button variants', () => {
    const { rerender } = render(
      <ModalFooter onConfirm={vi.fn()} confirmVariant="danger" />
    )
    expect(screen.getByRole('button', { name: /confirm/i })).toHaveClass('bg-coral')

    rerender(<ModalFooter onConfirm={vi.fn()} confirmVariant="success" />)
    expect(screen.getByRole('button', { name: /confirm/i })).toHaveClass('bg-success')
  })

  it('renders custom children instead of default buttons', () => {
    render(
      <ModalFooter onCancel={vi.fn()} onConfirm={vi.fn()}>
        <button>Custom Button</button>
      </ModalFooter>
    )
    
    expect(screen.getByText('Custom Button')).toBeInTheDocument()
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('only shows cancel button when onConfirm is not provided', () => {
    render(<ModalFooter onCancel={vi.fn()} />)
    
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('only shows confirm button when onCancel is not provided', () => {
    render(<ModalFooter onConfirm={vi.fn()} />)
    
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <div data-testid="container">
        <ModalFooter className="custom-footer" />
      </div>
    )
    const container = screen.getByTestId('container')
    const footer = container.querySelector('.custom-footer')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass('custom-footer')
  })
})