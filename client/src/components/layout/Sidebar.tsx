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
      <div className="p-2 border-b border-midnight-700/30">
        <button
          onClick={onSpawnAgent}
          disabled={!canSpawnAgent}
          className={`w-full px-2 py-1.5 text-xs text-left rounded transition-colors ${
            canSpawnAgent
              ? 'text-gray-300 hover:text-white hover:bg-gray-700/50'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          + New Agent
        </button>
        {!canSpawnAgent && (
          <div className="mt-1 px-2 text-[10px] text-gray-600">
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
    <div className={`border-b border-midnight-700/30 last:border-b-0 ${className}`}>
      <div
        className={`py-2 px-3 ${collapsible ? 'cursor-pointer hover:bg-midnight-700/20 transition-colors duration-200' : ''}`}
        onClick={toggleCollapsed}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {icon && <div className="text-gray-500 text-xs">{icon}</div>}
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {title}
            </h3>
            {collapsible && (
              <svg
                className={`w-3 h-3 text-slate-500 transition-all duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
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
          <div className="mt-1">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

