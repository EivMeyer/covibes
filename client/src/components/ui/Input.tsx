import React, { forwardRef } from 'react';
import type { ComponentProps } from '@/types';

interface InputProps extends ComponentProps {
  id?: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  disabled = false,
  required = false,
  autoComplete,
  autoFocus,
  maxLength,
  error,
  label,
  className = '',
  ...props
}, ref) => {
  const baseClasses = 'w-full px-4 py-3 bg-midnight-700 text-white rounded-lg border border-midnight-500 placeholder-gray-400 focus:ring-2 focus:ring-electric focus:border-electric hover:border-midnight-400 transition-all duration-200 focus:outline-none';
  const errorClasses = error ? 'border-coral focus:ring-coral focus:border-coral' : '';
  
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-2 text-gray-200">
          {label}
          {required && <span className="text-coral ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className={`${baseClasses} ${errorClasses} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-coral text-sm mt-2 flex items-center">
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';