import React from 'react';
import type { ComponentProps } from '@/types';

interface LoadingSpinnerProps extends ComponentProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-16 w-16'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <svg
          className={`animate-spin ${sizeClasses[size]} text-electric`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-electric/20 animate-pulse`} />
      </div>
      {text && (
        <p className="mt-3 text-sm text-gray-300 font-medium">{text}</p>
      )}
    </div>
  );
};

export const LoadingOverlay: React.FC<LoadingSpinnerProps> = ({
  text = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}>
      <div className="glass p-8 rounded-xl shadow-card-hover">
        <LoadingSpinner size="lg" text={text} />
      </div>
    </div>
  );
};