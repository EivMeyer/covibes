import React from 'react';
import type { ComponentProps } from '@/types';

interface ButtonProps extends ComponentProps {
  onClick?: ((event?: React.MouseEvent<HTMLButtonElement>) => void) | undefined;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-midnight-900 relative overflow-hidden';
  
  const variantClasses = {
    primary: 'bg-electric hover:bg-electric/90 text-midnight-900 focus:ring-electric shadow-glow hover:shadow-glow hover:scale-105 active:scale-95',
    secondary: 'bg-midnight-600 hover:bg-midnight-500 text-white focus:ring-midnight-500 border border-midnight-500 hover:border-midnight-400',
    success: 'bg-success hover:bg-success/90 text-midnight-900 focus:ring-success hover:scale-105 active:scale-95',
    danger: 'bg-coral hover:bg-coral/90 text-white focus:ring-coral hover:scale-105 active:scale-95',
    warning: 'bg-amber hover:bg-amber/90 text-midnight-900 focus:ring-amber shadow-glow-amber hover:shadow-glow-amber hover:scale-105 active:scale-95'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm h-8',
    md: 'px-4 py-2 text-base h-10',
    lg: 'px-6 py-3 text-lg h-12'
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="sr-only">Loading</span>
        </div>
      ) : (
        <div className="flex items-center justify-center space-x-2">
          {children}
        </div>
      )}
    </button>
  );
};