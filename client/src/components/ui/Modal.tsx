import React, { useEffect, useCallback } from 'react';
import type { ComponentProps } from '@/types';
import { Button } from './Button';

interface ModalProps extends ComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  children,
  className = '',
}) => {
  // Handle escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-gray-800/95 backdrop-blur-md rounded-xl w-full ${sizeClasses[size]} max-h-full overflow-y-auto shadow-2xl border border-gray-700/50 animate-slideUp ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {(title || showCloseButton) && (
          <div className="flex justify-between items-center p-6 border-b border-gray-600">
            {title && <h2 id="modal-title" className="text-xl font-bold text-white">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ModalFooterProps extends ComponentProps {
  onCancel?: () => void;
  onConfirm?: ((e?: React.FormEvent) => void) | (() => void);
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  isLoading?: boolean;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  confirmVariant = 'primary',
  isLoading = false,
  children,
  className = '',
}) => {
  return (
    <div className={`flex justify-end space-x-3 pt-4 border-t border-gray-600 ${className}`}>
      {children || (
        <>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              {cancelText}
            </Button>
          )}
          {onConfirm && (
            <Button variant={confirmVariant} onClick={onConfirm} loading={isLoading}>
              {confirmText}
            </Button>
          )}
        </>
      )}
    </div>
  );
};