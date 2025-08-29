import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ComponentProps } from '@/types';

interface SidebarProps extends ComponentProps {
  onSpawnAgent?: () => void;
  canSpawnAgent?: boolean;
  vmConnected?: boolean;
  socketConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  children,
  onSpawnAgent,
  canSpawnAgent = false,
  vmConnected = true,
  socketConnected = true,
  className = '',
  ...props
}) => {
  return (
    <aside 
      className={`w-full h-full bg-midnight-800 flex flex-col overflow-hidden shadow-card ${className}`}
      {...props}
    >
      {/* Simple header */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={onSpawnAgent}
          disabled={!canSpawnAgent}
          className={`w-full px-3 py-2 text-sm text-left rounded-md transition-colors ${
            canSpawnAgent 
              ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
              : 'text-gray-500 cursor-not-allowed'
          }`}
        >
          + New Agent
        </button>
        {!canSpawnAgent && (
          <div className="mt-2 px-3 py-1 text-xs text-gray-500">
            {!vmConnected ? 'Configure VM first' : 'Connecting...'}
          </div>
        )}
      </div>

      {/* Scrollable content - FLEX CONTAINER for expandable sections */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {children}
      </div>
    </aside>
  );
};

interface SidebarSectionProps extends ComponentProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  defaultExpanded?: boolean; // Support both for backwards compat
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  icon,
  action,
  children,
  collapsible = false,
  defaultCollapsed = false,
  defaultExpanded,
  className = '',
  ...props
}) => {
  // defaultExpanded is opposite of defaultCollapsed
  const initialCollapsed = defaultExpanded !== undefined ? !defaultExpanded : defaultCollapsed;
  const [isCollapsed, setIsCollapsed] = React.useState(initialCollapsed);
  
  // Ensure state is properly initialized only once
  React.useEffect(() => {
    setIsCollapsed(defaultCollapsed);
  }, []); // Empty dependency to run only on mount

  const toggleCollapsed = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className={`border-b border-midnight-600/50 last:border-b-0 ${className}`}>
      <div 
        className={`p-3 sm:p-4 ${collapsible ? 'cursor-pointer hover:bg-midnight-700/50 transition-colors duration-200' : ''}`}
        onClick={toggleCollapsed}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {icon && <div className="text-gray-400">{icon}</div>}
            <h3 className="text-sm font-bold text-electric uppercase tracking-wider">
              {title}
            </h3>
            {collapsible && (
              <svg 
                className={`w-4 h-4 text-electric transition-all duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
          {action && !isCollapsed && (
            <div className="flex-shrink-0">{action}</div>
          )}
        </div>
        
        {!isCollapsed && children && (
          <div className="mt-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

