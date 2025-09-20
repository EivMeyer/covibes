import React, { useEffect, useRef, useState } from 'react';
import { Target, MousePointer, X, Send, Bot, MessageSquare, Terminal, Palette, Copy, Minimize2, Maximize2, AlignCenter, Type, Droplets, Smartphone, Space, Zap, Trash2, Sparkles, Layout, Heart, TestTube, ChevronDown } from 'lucide-react';

interface SelectedElement {
  html: string;
  selector: string;
  computedStyles: Record<string, string>;
  rect: DOMRect;
  text: string;
  tagName: string;
  className: string;
  id: string;
}

interface LastActiveTarget {
  type: 'agent' | 'terminal' | 'chat';
  id: string;
  name: string;
  timestamp: number;
}

interface PreviewInspectorProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  isActive: boolean;
  onDeactivate: () => void;
  teamId: string; // Need team ID for API calls
  lastActiveTarget?: LastActiveTarget | null;
  sendToLastActive?: (message: string) => boolean;
  agents?: any[] | undefined; // List of available agents
}

export const PreviewInspector: React.FC<PreviewInspectorProps> = ({
  iframeRef,
  isActive,
  onDeactivate,
  teamId,
  lastActiveTarget,
  sendToLastActive,
  agents,
}) => {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isCrossOrigin, setIsCrossOrigin] = useState(false);
  const [isServerSideEnabled, setIsServerSideEnabled] = useState(false);
  const [lastSentAction, setLastSentAction] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [newText, setNewText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<LastActiveTarget | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update selected target when lastActiveTarget changes
  useEffect(() => {
    if (lastActiveTarget && !selectedTarget) {
      setSelectedTarget(lastActiveTarget);
    }
  }, [lastActiveTarget]); // Remove selectedTarget from deps to prevent infinite loop

  // Prepare available targets for dropdown - only running agents
  const availableTargets: LastActiveTarget[] = (agents || [])
    .filter(agent => agent.status === 'running') // Only show running agents
    .map(agent => ({
      type: 'agent' as const,
      id: agent.id,
      name: agent.agentName || agent.userName || `Agent ${agent.id.slice(-6)}`,
      timestamp: Date.now()
    }));

  // Get current target or fallback to lastActiveTarget
  const currentTarget = selectedTarget || lastActiveTarget;

  // Function to send to a specific target (selected or last active)
  const sendToTarget = (message: string, target?: LastActiveTarget | null): boolean => {
    const targetToUse = target || currentTarget;
    if (!targetToUse || !sendToLastActive) return false;

    // For now, use the existing sendToLastActive function
    // In the future, this could be enhanced to handle different target types
    return sendToLastActive(message);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTargetDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTargetDropdown(false);
      }
    };

    if (showTargetDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTargetDropdown]);

  useEffect(() => {
    if (!iframeRef.current || !isActive) return;

    const iframe = iframeRef.current;
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) return;

    // Since we now always inject the script server-side, we just need to activate it
    const activateInspector = () => {
      console.log(`🔍 [FRONTEND] Activating inspector for team ${teamId}`);

      // Send message to iframe to activate the already-injected inspector
      iframeWindow.postMessage({
        type: 'enable-inspector',
        active: true
      }, '*');

      console.log(`📤 [FRONTEND] Sent activation message to iframe`);
      setIsServerSideEnabled(true);
      setIsCrossOrigin(false);
    };

    // Wait a bit for iframe to load and process the injected script
    const timer = setTimeout(activateInspector, 500);

    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'inspector-element-selected') {
        console.log(`📥 [FRONTEND] Received element selection:`, event.data.data);
        setSelectedElement(event.data.data);

        // Calculate menu position within preview bounds
        if (iframeRef.current) {
          const iframeRect = iframeRef.current.getBoundingClientRect();
          const menuWidth = 260;
          const menuHeight = 400; // Approximate max height
          const padding = 10; // Padding from edges

          let x = event.data.position.x;
          let y = event.data.position.y;

          // Ensure menu stays within horizontal bounds
          if (x + menuWidth > iframeRect.width - padding) {
            x = iframeRect.width - menuWidth - padding;
          }
          if (x < padding) {
            x = padding;
          }

          // Ensure menu stays within vertical bounds
          if (y + menuHeight > iframeRect.height - padding) {
            y = iframeRect.height - menuHeight - padding;
          }
          if (y < padding) {
            y = padding;
          }

          setMenuPosition({ x, y });
        } else {
          setMenuPosition({ x: event.data.position.x, y: event.data.position.y });
        }

        setShowContextMenu(true);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);

      // Disable inspector when component unmounts or becomes inactive
      if (iframeWindow) {
        iframeWindow.postMessage({
          type: 'enable-inspector',
          active: false
        }, '*');
        console.log(`📤 [FRONTEND] Sent deactivation message to iframe`);
      }
    };
  }, [isActive, iframeRef, teamId]);

  const formatElementContext = (element: SelectedElement): string => {
    const styles = Object.entries(element.computedStyles)
      .map(([key, value]) => `  - ${key}: ${value}`)
      .join('\n');

    return `[ELEMENT CONTEXT]
Type: ${element.tagName}${element.className ? ` (class="${element.className}")` : ''}${element.id ? ` (id="${element.id}")` : ''}
Selector: ${element.selector}
Position: ${Math.round(element.rect.left)}px from left, ${Math.round(element.rect.top)}px from top
Size: ${Math.round(element.rect.width)}px × ${Math.round(element.rect.height)}px
${element.text ? `Text: "${element.text}"` : ''}
${styles ? `Key Styles:\n${styles}` : ''}
HTML: ${element.html}
[END CONTEXT]`;
  };

  interface ActionPrompt {
    id: string;
    title: string;
    icon: React.ReactNode;
    description: string;
    generatePrompt: (element: SelectedElement) => string;
  }

  const actionPrompts: ActionPrompt[] = [
    {
      id: 'copy-context',
      title: 'Copy Context',
      icon: <Copy className="w-4 h-4" />,
      description: 'Copy element context to clipboard',
      generatePrompt: (element) => formatElementContext(element)
    },
    {
      id: 'delete-element',
      title: 'Delete Element',
      icon: <Trash2 className="w-4 h-4" />,
      description: 'Remove this element from the page',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nDelete this element completely from the page. Remove it from the DOM.`
    },
    {
      id: 'change-color',
      title: 'Change Color',
      icon: <Palette className="w-4 h-4" />,
      description: 'Apply selected color to element',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nChange the color to: ${selectedColor}\n\nApply this color to the most appropriate property (background-color, color, border-color, etc.) based on the element type.`
    },
    {
      id: 'change-text',
      title: 'Change Text',
      icon: <Type className="w-4 h-4" />,
      description: 'Change the text content of element',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nChange the text content to: "${newText}"\n\nReplace the existing text with the new text while maintaining the element's styling and structure.`
    },
    {
      id: 'fix-ai-slop',
      title: 'Fix AI Slop',
      icon: <Bot className="w-4 h-4" />,
      description: 'Make this look professional and human-designed',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element looks like AI-generated content. Make it look professional, human-designed, and polished.`
    },
    {
      id: 'make-smaller',
      title: 'Make Smaller',
      icon: <Minimize2 className="w-4 h-4" />,
      description: 'Reduce size and visual footprint',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nMake this element smaller and more compact while maintaining usability.`
    },
    {
      id: 'make-larger',
      title: 'Make Larger',
      icon: <Maximize2 className="w-4 h-4" />,
      description: 'Increase size and prominence',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nMake this element larger and more prominent in the layout.`
    },
    {
      id: 'center-align',
      title: 'Center & Align',
      icon: <AlignCenter className="w-4 h-4" />,
      description: 'Fix alignment and centering',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nFix the alignment and centering of this element. Make it properly centered and aligned.`
    },
    {
      id: 'add-spacing',
      title: 'Add Better Spacing',
      icon: <Space className="w-4 h-4" />,
      description: 'Improve whitespace and breathing room',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nImprove the spacing around and within this element. Add appropriate padding and margins.`
    },
    {
      id: 'make-minimalist',
      title: 'Make Minimalist',
      icon: <Zap className="w-4 h-4" />,
      description: 'Create minimalist inspired design',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nRedesign this element with minimalist inspiration. Focus on simplicity, clean lines, essential elements only, and plenty of whitespace.`
    },
    {
      id: 'make-fancy',
      title: 'Make More Fancy',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Add sophisticated design elements',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nMake this element more fancy and sophisticated. Add elegant touches, smooth animations, gradients, shadows, and premium feeling design elements.`
    },
    {
      id: 'align-with-page',
      title: 'Align with Page Design',
      icon: <Layout className="w-4 h-4" />,
      description: 'Match the design of the rest of the page',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nAlign this element's design with the rest of the page. Match the color scheme, typography, spacing, and overall aesthetic of the surrounding interface.`
    },
    {
      id: 'make-alive',
      title: 'Make Alive',
      icon: <Heart className="w-4 h-4" />,
      description: 'Add life with animations and interactions',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nMake this element feel alive and dynamic. Add subtle animations, hover effects, transitions, and micro-interactions that make it feel responsive and engaging.`
    },
    {
      id: 'test-functionality',
      title: 'Test if it Works',
      icon: <TestTube className="w-4 h-4" />,
      description: 'Test functionality and interactions',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nTest if this element works correctly. Check all interactive features, validate functionality, ensure proper behavior, and report any issues found.`
    }
  ];

  const handleActionClick = async (action: ActionPrompt) => {
    if (!selectedElement) return;

    // Special handling for copy context
    if (action.id === 'copy-context') {
      await copyToClipboard();
      setShowContextMenu(false);  // Close the menu after copying
      return;
    }

    // Special handling for color change - show color picker popup
    if (action.id === 'change-color') {
      setShowColorPicker(true);
      setShowTextEditor(false);
      setShowContextMenu(false);  // Close the menu when opening color picker
      return;
    }

    // Special handling for text change - show text editor popup
    if (action.id === 'change-text') {
      setNewText(selectedElement.text || '');
      setShowTextEditor(true);
      setShowColorPicker(false);
      setShowContextMenu(false);  // Close the menu when opening text editor
      return;
    }

    if (!currentTarget || !sendToLastActive) return;

    const prompt = action.generatePrompt(selectedElement);
    const success = sendToTarget(prompt, currentTarget);

    if (success) {
      setLastSentAction(`${action.title} → ${currentTarget.name}`);
      setTimeout(() => setLastSentAction(null), 3000);
      setShowContextMenu(false);
      setSelectedElement(null);
    } else {
      console.warn('No target to send to');
    }
  };

  const copyToClipboard = async () => {
    if (!selectedElement) return;

    const contextText = formatElementContext(selectedElement);

    try {
      await navigator.clipboard.writeText(contextText);
      setLastSentAction('Context Copied to Clipboard');
      setTimeout(() => setLastSentAction(null), 3000);
      setShowContextMenu(false);
      setSelectedElement(null);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = contextText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        setLastSentAction('Context Copied to Clipboard');
        setTimeout(() => setLastSentAction(null), 3000);
        setShowContextMenu(false);
        setSelectedElement(null);
      } catch (fallbackError) {
        console.error('Could not copy element context to clipboard', fallbackError);
        setLastSentAction('Copy Failed');
        setTimeout(() => setLastSentAction(null), 3000);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  if (!isActive) return null;

  return (
    <>
      {/* Inspector indicator */}
      <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded-md bg-blue-600/90 backdrop-blur-sm shadow-lg flex items-center space-x-1.5">
        <Target className="w-4 h-4 text-white" />
        <span className="text-xs font-medium text-white">Inspector</span>
        <button
          onClick={() => {
            onDeactivate();
            setShowContextMenu(false);
            setSelectedElement(null);
            setIsCrossOrigin(false);
            setIsServerSideEnabled(false);
          }}
          className="ml-1 p-0.5 rounded hover:bg-black/20"
        >
          <X className="w-3 h-3 text-white/80" />
        </button>
      </div>


      {/* Cross-origin limitation message - only show if server-side failed */}
      {isCrossOrigin && !isServerSideEnabled && (
        <div className="absolute top-14 left-2 z-50 bg-orange-100 border border-orange-300 text-orange-800 px-3 py-2 rounded-lg shadow-lg max-w-xs">
          <div className="text-xs font-medium mb-1">Cross-origin Preview Detected</div>
          <div className="text-xs">
            Server-side injection failed. Try opening the preview in a new tab and using browser DevTools to inspect elements.
          </div>
        </div>
      )}

      {/* Compact Action Menu */}
      {showContextMenu && selectedElement && (
        <div
          className="absolute z-50 rounded-md overflow-hidden"
          style={{
            top: menuPosition.y,
            left: menuPosition.x,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            boxShadow: `
              0 20px 25px -5px rgba(0, 0, 0, 0.3),
              0 10px 10px -5px rgba(0, 0, 0, 0.2),
              0 0 0 1px rgba(59, 130, 246, 0.05),
              inset 0 1px 0 0 rgba(148, 163, 184, 0.1)
            `,
            width: '260px',
          }}
        >
          {/* Glass shine effect overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, rgba(255, 255, 255, 0.03) 0%, transparent 40%, rgba(255, 255, 255, 0.01) 100%)',
            }}
          />

          {/* Minimal header */}
          <div className="relative px-3 py-1.5 border-b border-white/10 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-xs text-blue-400/80 font-mono truncate">
                    {selectedElement.tagName.toLowerCase()}
                    {selectedElement.id && `#${selectedElement.id.split(' ')[0]}`}
                    {selectedElement.className && `.${selectedElement.className.split(' ')[0]}`}
                  </code>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {Math.round(selectedElement.rect.width)}×{Math.round(selectedElement.rect.height)}
                  </span>
                </div>
                {selectedElement.text && (
                  <div className="mt-0.5">
                    <span className="text-xs text-gray-400 truncate block" title={selectedElement.text}>
                      "{selectedElement.text}"
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowContextMenu(false)}
                className="p-0.5 hover:bg-white/10 rounded transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3 text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>

          {/* Target Selection Dropdown */}
          <div className="relative px-3 py-1 border-b border-white/10 bg-gradient-to-r from-transparent via-green-500/[0.02] to-transparent">
            {currentTarget ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowTargetDropdown(!showTargetDropdown)}
                  className="flex items-center gap-1.5 w-full hover:bg-white/5 px-1 py-0.5 rounded transition-colors"
                >
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_4px_rgba(74,222,128,0.5)]" />
                  <span className="text-xs text-gray-300 flex-1 text-left">
                    Sending to: {currentTarget.name}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showTargetDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showTargetDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/20 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                    {availableTargets.map((target) => (
                      <button
                        key={`${target.type}-${target.id}`}
                        onClick={() => {
                          setSelectedTarget(target);
                          setShowTargetDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors ${
                          currentTarget?.id === target.id ? 'bg-white/5 text-blue-400' : 'text-gray-300'
                        }`}
                      >
                        {target.type === 'agent' && <Bot className="w-3 h-3" />}
                        {target.type === 'terminal' && <Terminal className="w-3 h-3" />}
                        {target.type === 'chat' && <MessageSquare className="w-3 h-3" />}
                        <span className="flex-1 text-left">{target.name}</span>
                        {currentTarget?.id === target.id && (
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                <span className="text-xs text-orange-400/80">No active agent/terminal</span>
              </div>
            )}
          </div>


          {/* Compact action list */}
          <div className="relative max-h-72 overflow-y-auto">
            {actionPrompts.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className="relative w-full px-3 py-1.5 text-left hover:bg-white/[0.03] transition-all group border-b border-white/5 last:border-0"
                title={action.description}
              >
                <div className="flex items-center">
                  <div className="w-5 flex-shrink-0 text-blue-400/60 group-hover:text-blue-400 transition-colors">
                    {action.icon}
                  </div>
                  <div className="ml-2.5 text-xs text-white/80 font-medium group-hover:text-white/95 transition-colors">
                    {action.title}
                  </div>
                </div>
                {/* Hover shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                     style={{
                       background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.05), transparent)',
                     }}
                />
              </button>
            ))}
          </div>

        </div>
      )}

      {/* Minimal success feedback */}
      {lastSentAction && (
        <div className="absolute top-14 right-2 z-50 px-2 py-1 rounded bg-green-600/90 backdrop-blur-sm">
          <div className="text-xs text-white">✓ {lastSentAction}</div>
        </div>
      )}

      {/* Color Picker Popup */}
      {showColorPicker && selectedElement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowColorPicker(false)}
          />

          {/* Popup */}
          <div
            className="relative w-80 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.90) 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: `
                0 24px 48px -12px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(59, 130, 246, 0.1),
                inset 0 1px 0 0 rgba(148, 163, 184, 0.1)
              `,
            }}
          >
            {/* Glass shine */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, rgba(255, 255, 255, 0.05) 0%, transparent 40%)',
              }}
            />

            {/* Header */}
            <div className="relative px-4 py-3 border-b border-white/10 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Choose Color</h3>
                </div>
                <button
                  onClick={() => setShowColorPicker(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="relative p-4 space-y-4">
              {/* Color input */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-20 h-20 rounded-lg cursor-pointer border-2 border-white/20 hover:border-blue-400/50 transition-all shadow-inner"
                  style={{
                    background: selectedColor,
                    padding: '2px'
                  }}
                />
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50 font-mono"
                    placeholder="#000000"
                  />
                  <div className="text-xs text-gray-400">
                    Click the square or enter hex code
                  </div>
                </div>
              </div>

              {/* Quick color presets */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Quick Colors</div>
                <div className="grid grid-cols-8 gap-2">
                  {[
                    '#000000', '#FFFFFF', '#EF4444', '#F59E0B',
                    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
                    '#6B7280', '#F3F4F6', '#DC2626', '#F97316',
                    '#059669', '#2563EB', '#7C3AED', '#DB2777'
                  ].map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className="w-8 h-8 rounded-md border border-white/20 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative px-4 py-3 border-t border-white/10 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent flex justify-end gap-2">
              <button
                onClick={() => setShowColorPicker(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedElement && currentTarget) {
                    const colorAction = actionPrompts.find(a => a.id === 'change-color');
                    if (colorAction) {
                      const prompt = colorAction.generatePrompt(selectedElement);
                      const success = sendToTarget(prompt, currentTarget);
                      if (success) {
                        setLastSentAction(`Color: ${selectedColor} → ${currentTarget.name}`);
                        setTimeout(() => setLastSentAction(null), 2000);
                        setShowColorPicker(false);
                        setShowContextMenu(false);
                        setSelectedElement(null);
                      }
                    }
                  }
                }}
                className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-500/90 hover:to-blue-400/90 rounded-lg transition-all shadow-lg shadow-blue-500/20"
              >
                Apply Color
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Editor Popup */}
      {showTextEditor && selectedElement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowTextEditor(false)}
          />

          {/* Popup */}
          <div
            className="relative w-96 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.90) 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: `
                0 24px 48px -12px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(59, 130, 246, 0.1),
                inset 0 1px 0 0 rgba(148, 163, 184, 0.1)
              `,
            }}
          >
            {/* Glass shine */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, rgba(255, 255, 255, 0.05) 0%, transparent 40%)',
              }}
            />

            {/* Header */}
            <div className="relative px-4 py-3 border-b border-white/10 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Change Text</h3>
                </div>
                <button
                  onClick={() => setShowTextEditor(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="relative p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Current Text
                </label>
                <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300">
                  {selectedElement.text || '(empty)'}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  New Text
                </label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/50 resize-none"
                  placeholder="Enter new text..."
                  rows={3}
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="relative px-4 py-3 border-t border-white/10 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent flex justify-end gap-2">
              <button
                onClick={() => setShowTextEditor(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedElement && currentTarget && newText) {
                    const textAction = actionPrompts.find(a => a.id === 'change-text');
                    if (textAction) {
                      const prompt = textAction.generatePrompt(selectedElement);
                      const success = sendToTarget(prompt, currentTarget);
                      if (success) {
                        setLastSentAction(`Text Changed → ${currentTarget.name}`);
                        setTimeout(() => setLastSentAction(null), 2000);
                        setShowTextEditor(false);
                        setShowContextMenu(false);
                        setSelectedElement(null);
                      }
                    }
                  }
                }}
                className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-500/90 hover:to-blue-400/90 rounded-lg transition-all shadow-lg shadow-blue-500/20"
              >
                Apply Text
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};