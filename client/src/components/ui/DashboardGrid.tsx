import React, { useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  preview?: React.ReactNode;
  showPreview?: boolean;
  className?: string;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  sidebar,
  main,
  preview,
  showPreview = true,
  className = '',
}) => {
  // Default layouts for different breakpoints
  const [layouts, setLayouts] = useState(() => {
    const defaultLayouts = {
      lg: [
        { i: 'sidebar', x: 0, y: 0, w: 12, h: 12, minW: 4 },
        { i: 'main', x: 12, y: 0, w: 24, h: 12, minW: 6 },
        ...(showPreview && preview ? [{ i: 'preview', x: 36, y: 0, w: 12, h: 12, minW: 4 }] : [])
      ],
      md: [
        { i: 'sidebar', x: 0, y: 0, w: 6, h: 8, minW: 2 },
        { i: 'main', x: 0, y: 8, w: 12, h: 8, minW: 2 },
        ...(showPreview && preview ? [{ i: 'preview', x: 6, y: 0, w: 6, h: 8, minW: 2 }] : [])
      ],
      sm: [
        { i: 'sidebar', x: 0, y: 0, w: 12, h: 6, minW: 2 },
        { i: 'main', x: 0, y: 6, w: 12, h: 8, minW: 2 },
        ...(showPreview && preview ? [{ i: 'preview', x: 0, y: 14, w: 12, h: 6, minW: 2 }] : [])
      ]
    };
    
    // Load saved layouts from localStorage
    const saved = localStorage.getItem('dashboard-layouts');
    return saved ? JSON.parse(saved) : defaultLayouts;
  });

  const handleLayoutChange = (layout: any, layouts: any) => {
    setLayouts(layouts);
    // Save layouts to localStorage
    localStorage.setItem('dashboard-layouts', JSON.stringify(layouts));
  };

  const resetLayout = () => {
    localStorage.removeItem('dashboard-layouts');
    window.location.reload();
  };

  return (
    <div className={`w-full h-full ${className}`}>
      {/* Reset Layout Button */}
      <div className="absolute top-2 right-2 z-50">
        <button
          onClick={resetLayout}
          className="px-3 py-1 bg-midnight-600 hover:bg-midnight-500 text-white text-sm rounded transition-colors"
          title="Reset dashboard layout"
        >
          ⚡ Reset Layout
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 48, md: 24, sm: 12, xs: 6, xxs: 2 }}
        rowHeight={60}
        margin={[8, 8]}
        containerPadding={[8, 8]}
        isDraggable={true}
        isResizable={true}
        autoSize={true}
        preventCollision={false}
        compactType="vertical"
      >
        {/* Command Deck */}
        <div key="sidebar" className="bg-midnight-800 rounded-lg overflow-hidden shadow-card">
          <div className="h-full flex flex-col">
            <div className="p-2 bg-midnight-700 border-b border-midnight-600 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Command Deck</h3>
              <div className="flex items-center text-xs text-gray-400">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Drag & Resize
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {sidebar}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div key="main" className="bg-midnight-900 rounded-lg overflow-hidden shadow-card">
          <div className="h-full flex flex-col">
            <div className="p-2 bg-midnight-800 border-b border-midnight-600 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Team Collaboration</h3>
              <div className="flex items-center text-xs text-gray-400">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Drag & Resize
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {main}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && preview && (
          <div key="preview" className="bg-midnight-800 rounded-lg overflow-hidden shadow-card">
            <div className="h-full flex flex-col">
              <div className="p-2 bg-midnight-700 border-b border-midnight-600 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Live Preview</h3>
                <div className="flex items-center text-xs text-gray-400">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  Drag & Resize
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {preview}
              </div>
            </div>
          </div>
        )}
      </ResponsiveGridLayout>
    </div>
  );
};