import React, { forwardRef } from 'react';
import type { ComponentProps } from '@/types';

interface TextareaProps extends ComponentProps {
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  error?: string;
  label?: string;
  rows?: number;
  cols?: number;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  id,
  name,
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  required = false,
  autoFocus,
  error,
  label,
  rows = 4,
  cols,
  resize = 'vertical',
  className = '',
  ...props
}, ref) => {
  const baseClasses = 'w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 font-mono text-xs';
  const errorClasses = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  const resizeClasses = {
    none: 'resize-none',
    both: 'resize',
    horizontal: 'resize-x',
    vertical: 'resize-y',
  };
  
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-2 text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        rows={rows}
        cols={cols}
        className={`${baseClasses} ${errorClasses} ${resizeClasses[resize]} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-red-400 text-sm mt-1">{error}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';