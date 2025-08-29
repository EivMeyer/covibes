import React, { useState, useRef, useEffect } from 'react';

import type { GridTile } from './WorkspaceGrid';

interface SimpleGridProps {
  tiles: GridTile[];
  onAddTile: (type: GridTile['type']) => void;
  onRemoveTile: (id: string) => void;
  renderTile: (tile: GridTile) => React.ReactNode;
}

export const SimpleGrid: React.FC<SimpleGridProps> = ({
  tiles,
  onAddTile,
  onRemoveTile,
  renderTile
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const menuItems = [
    {
      type: 'terminal' as GridTile['type'],
      label: 'Terminal',
      icon: '⚡',
      description: 'Agent terminal',
      color: 'text-cyan-400 bg-cyan-600/10 hover:bg-cyan-600/20 border-cyan-600/30'
    },
    {
      type: 'chat' as GridTile['type'],
      label: 'Chat',
      icon: '💬',
      description: 'Team chat',
      color: 'text-purple-400 bg-purple-600/10 hover:bg-purple-600/20 border-purple-600/30'
    },
    {
      type: 'preview' as GridTile['type'],
      label: 'Preview',
      icon: '🌐',
      description: 'Live preview',
      color: 'text-green-400 bg-green-600/10 hover:bg-green-600/20 border-green-600/30'
    },
    {
      type: 'ide' as GridTile['type'],
      label: 'IDE',
      icon: '📝',
      description: 'Code editor',
      color: 'text-blue-400 bg-blue-600/10 hover:bg-blue-600/20 border-blue-600/30'
    }
  ];

  const handleAddTile = (type: GridTile['type']) => {
    onAddTile(type);
    setIsMenuOpen(false);
  };

  const PlusButtonMenu = () => (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" ref={menuRef}>
      {/* Reset Button */}
      {tiles.length > 0 && (
        <button
          onClick={() => {
            // Clear all tiles
            tiles.forEach(tile => onRemoveTile(tile.id));
          }}
          className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-110"
          title="Clear workspace"
        >
          <svg 
            className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
            />
          </svg>
        </button>
      )}

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute bottom-16 right-0 mb-2 min-w-[300px] bg-midnight-800/95 backdrop-blur-xl border border-midnight-600/50 rounded-2xl shadow-2xl p-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="p-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-midnight-600/30 mb-2">
            ✨ Add Component
          </div>
          <div className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAddTile(item.type)}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all duration-300 group hover:scale-[1.02] ${item.color}`}
              >
                <div className="flex-shrink-0 text-xl group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white group-hover:text-white/90 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                    {item.description}
                  </div>
                </div>
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Stylish + Button with enhanced effects */}
      <div className="relative">
        {/* Animated ring effect */}
        <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-electric via-blue-500 to-electric opacity-75 ${isMenuOpen ? 'animate-pulse' : ''}`} 
             style={{ 
               filter: 'blur(8px)',
               animation: isMenuOpen ? 'none' : 'spin 6s linear infinite'
             }} />
        
        {/* Glowing ring */}
        <div className="absolute -inset-1 bg-gradient-to-r from-electric to-blue-500 rounded-full opacity-40 blur-sm animate-pulse" />
        
        {/* Main button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`relative w-16 h-16 bg-gradient-to-r from-electric via-blue-500 to-electric text-white rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center group overflow-hidden ${
            isMenuOpen ? 'rotate-45 scale-110 shadow-electric/50' : 'hover:scale-115 hover:shadow-electric/30'
          }`}
          style={{
            background: isMenuOpen 
              ? 'linear-gradient(135deg, #3b82f6, #1d4ed8, #3b82f6)' 
              : 'linear-gradient(135deg, #3b82f6, #1d4ed8, #6366f1)',
            boxShadow: isMenuOpen 
              ? '0 0 40px rgba(59, 130, 246, 0.6), 0 0 80px rgba(59, 130, 246, 0.3)' 
              : '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          <svg 
            className={`w-7 h-7 transition-all duration-500 z-10 ${isMenuOpen ? 'scale-90' : 'group-hover:scale-110'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2.5} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
        </button>
      </div>
      
      {/* Enhanced background blur when menu is open */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10 transition-all duration-300" />
      )}
    </div>
  );

  if (tiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-midnight-900 relative">
        <div className="text-center space-y-6">
          <h2 className="text-xl text-gray-400">Workspace is empty</h2>
          <p className="text-sm text-gray-500">Use the + button to add components to your workspace</p>
        </div>
        
        <PlusButtonMenu />
      </div>
    );
  }

  return (
    <div className="h-full bg-midnight-900 p-4">
      {/* Simple CSS Grid - STABLE CONTAINERS */}
      <div 
        className="grid h-full gap-4"
        style={{
          gridTemplateColumns: tiles.length === 1 ? '1fr' : tiles.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
          gridTemplateRows: tiles.length === 1 ? '1fr' : tiles.length <= 2 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))'
        }}
      >
        {tiles.map((tile) => (
          <div 
            key={tile.id} 
            className="bg-midnight-800 rounded-lg border border-midnight-600 overflow-hidden flex flex-col"
            style={{ minHeight: '400px' }}
          >
            {/* Simple header */}
            <div className="bg-gray-800 p-2 text-xs text-gray-300 flex justify-between items-center flex-shrink-0">
              <span>{tile.title}</span>
              <button
                onClick={() => onRemoveTile(tile.id)}
                className="text-red-400 hover:text-red-300 px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>
            
            {/* Stable content area - NO DYNAMIC RESIZING */}
            <div className="flex-1" style={{ minHeight: '350px' }}>
              {renderTile(tile)}
            </div>
          </div>
        ))}
      </div>
      
      <PlusButtonMenu />
    </div>
  );
};