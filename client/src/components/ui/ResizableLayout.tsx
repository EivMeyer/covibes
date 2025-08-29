import React from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

interface ResizableLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  preview?: React.ReactNode;
  showPreview?: boolean;
  className?: string;
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  sidebar,
  main,
  preview,
  showPreview = true,
  className = '',
}) => {
  if (!showPreview || !preview) {
    // Two pane layout: Sidebar + Main
    return (
      <div className={`w-full h-full ${className}`}>
        <Allotment>
          <Allotment.Pane minSize={200} preferredSize={300} maxSize={800}>
            <div className="hidden md:flex h-full bg-midnight-800">
              {sidebar}
            </div>
          </Allotment.Pane>
          <Allotment.Pane>
            <div className="h-full bg-midnight-900">
              {main}
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    );
  }

  // Three pane layout: Sidebar + Main + Preview
  return (
    <div className={`w-full h-full ${className}`}>
      <Allotment>
        <Allotment.Pane minSize={200} preferredSize={300}>
          <div className="hidden md:flex h-full w-full bg-midnight-800">
            {sidebar}
          </div>
        </Allotment.Pane>
        <Allotment.Pane>
          <div className="h-full bg-midnight-900">
            {main}
          </div>
        </Allotment.Pane>
        <Allotment.Pane minSize={250} preferredSize={400}>
          <div className="hidden xl:block h-full w-full">
            {preview}
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};