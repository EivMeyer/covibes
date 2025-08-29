import React from 'react';

interface TabItem {
  id: 'agents' | 'team' | 'preview';
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileTabBarProps {
  activeTab: 'agents' | 'team' | 'preview';
  onTabChange: (tab: 'agents' | 'team' | 'preview') => void;
  badges?: {
    agents?: number;
    team?: number;
    preview?: number;
  };
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onTabChange,
  badges = {}
}) => {
  const tabs: TabItem[] = [
    {
      id: 'agents',
      label: 'Agents',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      badge: badges.agents
    },
    {
      id: 'team',
      label: 'Team',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      badge: badges.team
    },
    {
      id: 'preview',
      label: 'Preview',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      badge: badges.preview
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-midnight-800 border-t border-midnight-600 z-30">
      <div className="flex justify-around items-center">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-col items-center justify-center py-2 px-4 flex-1 transition-all duration-200 ${
              activeTab === tab.id 
                ? 'text-electric' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {/* Active indicator */}
            {activeTab === tab.id && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-electric" />
            )}
            
            {/* Icon with badge */}
            <div className="relative">
              {tab.icon}
              {tab.badge && tab.badge > 0 && (
                <div className="absolute -top-1 -right-1 bg-coral text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </div>
              )}
            </div>
            
            {/* Label */}
            <span className="text-xs mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};