import React from 'react';
import type { ComponentProps } from '@/types';

interface CardProps extends ComponentProps {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dark' | 'darker' | 'glass';
  onClick?: () => void;
  floating?: boolean;
  glowing?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  variant = 'default',
  className = '',
  onClick,
  floating = false,
  glowing = false,
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantClasses = {
    default: 'bg-midnight-800 border border-midnight-600 shadow-card',
    dark: 'bg-midnight-700 border border-midnight-500 shadow-card',
    darker: 'bg-midnight-900 border border-midnight-700 shadow-card',
    glass: 'glass shadow-card',
  };

  const animationClasses = `
    ${floating ? 'float' : ''}
    ${glowing ? 'shadow-glow hover:shadow-glow' : ''}
    ${onClick ? 'cursor-pointer card-hover hover:scale-105 active:scale-95 transition-all duration-200' : 'transition-all duration-200'}
  `;

  return (
    <div
      className={`rounded-lg ${paddingClasses[padding]} ${variantClasses[variant]} ${animationClasses} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps extends ComponentProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`} {...props}>
      <div className="flex-1">
        {title && (
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        )}
        {subtitle && (
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        )}
        {children}
      </div>
      {action && (
        <div className="ml-4 flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};

export const CardContent: React.FC<ComponentProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<ComponentProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`mt-4 pt-4 border-t border-midnight-600 ${className}`} {...props}>
      {children}
    </div>
  );
};