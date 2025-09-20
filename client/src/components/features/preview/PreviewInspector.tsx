import React, { useEffect, useRef, useState } from 'react';
import { Target, MousePointer, X, Send, Bot, MessageSquare, Terminal, Palette } from 'lucide-react';

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
}

export const PreviewInspector: React.FC<PreviewInspectorProps> = ({
  iframeRef,
  isActive,
  onDeactivate,
  teamId,
  lastActiveTarget,
  sendToLastActive,
}) => {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isCrossOrigin, setIsCrossOrigin] = useState(false);
  const [isServerSideEnabled, setIsServerSideEnabled] = useState(false);
  const [lastSentAction, setLastSentAction] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const colorInputRef = useRef<HTMLInputElement>(null);

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
        setMenuPosition({ x: event.data.position.x, y: event.data.position.y });
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
      id: 'fix-ai-slop',
      title: 'Fix AI Slop Appearance',
      icon: <Bot className="w-4 h-4" />,
      description: 'Make this look more professional and human-designed',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element looks like AI-generated content. Please make it look more professional, human-designed, and polished. Focus on:\n- Natural spacing and typography\n- Better visual hierarchy\n- Professional color choices\n- Remove any generic/template-like appearance\n- Make it feel more intentional and crafted`
    },
    {
      id: 'make-smaller',
      title: 'Make Smaller',
      icon: <X className="w-3 h-3" />,
      description: 'Reduce the size and visual footprint',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element is too large and takes up too much space. Please make it smaller by:\n- Reducing padding and margins\n- Using smaller font sizes where appropriate\n- Decreasing width/height\n- Making it more compact and condensed\n- Optimizing space usage\n- Maintaining readability while shrinking size`
    },
    {
      id: 'make-larger',
      title: 'Make Larger',
      icon: <Send className="w-5 h-5" />,
      description: 'Increase the size and visual prominence',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element is too small and hard to see/interact with. Please make it larger by:\n- Increasing padding and margins\n- Using bigger font sizes\n- Expanding width/height\n- Making it more prominent and visible\n- Ensuring proper touch targets (44px+ for mobile)\n- Making it stand out more in the layout`
    },
    {
      id: 'center-align',
      title: 'Center & Align',
      icon: <Terminal className="w-4 h-4" />,
      description: 'Fix alignment and centering issues',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element has alignment issues. Please fix the positioning by:\n- Centering the element properly\n- Aligning text and content correctly\n- Using flexbox or grid for proper layout\n- Ensuring visual balance\n- Making alignment consistent with the design\n- Fixing any off-center or misaligned elements`
    },
    {
      id: 'make-readable',
      title: 'Make Actually Readable',
      icon: <MessageSquare className="w-4 h-4" />,
      description: 'Improve typography and readability',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element has poor readability. Please improve it by:\n- Fixing font sizes and line heights\n- Improving contrast ratios\n- Better text spacing and margins\n- Choosing more readable fonts\n- Ensuring accessibility standards\n- Making text scannable and clear`
    },
    {
      id: 'fix-colors',
      title: 'Fix Colors & Contrast',
      icon: <MousePointer className="w-4 h-4" />,
      description: 'Improve color scheme and visual contrast',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element has color and contrast issues. Please fix by:\n- Improving color contrast ratios (WCAG standards)\n- Using a better color palette\n- Making text readable against backgrounds\n- Ensuring colors work together harmoniously\n- Adding visual hierarchy through color\n- Making sure colors are accessible`
    },
    {
      id: 'fix-mobile',
      title: 'Fix Mobile Issues',
      icon: <Terminal className="w-4 h-4" />,
      description: 'Make this work properly on mobile devices',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element has mobile/responsive issues. Please fix:\n- Make it responsive across all screen sizes\n- Ensure touch targets are appropriate size (44px+)\n- Fix any overflow or layout breaking\n- Optimize for mobile interaction patterns\n- Test on common mobile breakpoints\n- Ensure proper scaling and spacing`
    },
    {
      id: 'add-spacing',
      title: 'Add Better Spacing',
      icon: <Send className="w-4 h-4" />,
      description: 'Improve whitespace and visual breathing room',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element needs better spacing. Please improve by:\n- Adding appropriate margins and padding\n- Creating visual breathing room\n- Using consistent spacing patterns\n- Balancing whitespace effectively\n- Separating content logically\n- Making the layout feel less cramped`
    },
    {
      id: 'simplify',
      title: 'Simplify & Declutter',
      icon: <X className="w-4 h-4" />,
      description: 'Remove unnecessary complexity and clutter',
      generatePrompt: (element) =>
        `${formatElementContext(element)}\n\nThis element is too complex or cluttered. Please simplify it:\n- Remove unnecessary visual elements\n- Reduce cognitive load\n- Focus on the core functionality\n- Use more whitespace effectively\n- Streamline the design\n- Make it more intuitive and direct`
    }
  ];

  const handleActionClick = async (action: ActionPrompt) => {
    if (!selectedElement || !sendToLastActive) return;

    const prompt = action.generatePrompt(selectedElement);
    const success = sendToLastActive(prompt);

    if (success) {
      setLastSentAction(action.title);
      setTimeout(() => setLastSentAction(null), 3000);
      setShowContextMenu(false);
      setSelectedElement(null);
    } else {
      console.warn('No active agent or terminal to send to');
    }
  };

  if (!isActive) return null;

  return (
    <>
      {/* Inspector indicator */}
      <div className={`absolute top-2 left-2 z-50 px-3 py-1 rounded-lg shadow-lg flex items-center space-x-2 ${
        isCrossOrigin
          ? 'bg-orange-600 text-white'
          : isServerSideEnabled
          ? 'bg-green-600 text-white'
          : 'bg-blue-600 text-white'
      }`}>
        <Target className="w-5 h-5 text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text" style={{
          filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.4))'
        }} />
        <span className="text-sm font-medium">
          {isCrossOrigin
            ? 'Inspector (Limited)'
            : isServerSideEnabled
            ? 'Inspector (Server-Side)'
            : 'Inspector Active'
          }
        </span>
        <button
          onClick={() => {
            onDeactivate();
            setShowContextMenu(false);
            setSelectedElement(null);
            setIsCrossOrigin(false);
            setIsServerSideEnabled(false);
          }}
          className={`ml-2 p-1 rounded ${
            isCrossOrigin ? 'hover:bg-orange-700' : isServerSideEnabled ? 'hover:bg-green-700' : 'hover:bg-blue-700'
          }`}
        >
          <X className="w-3 h-3" />
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

      {/* Action menu */}
      {showContextMenu && selectedElement && (
        <div
          className="absolute z-50 bg-midnight-800 border border-midnight-600 rounded-lg shadow-xl min-w-64 max-w-80"
          style={{
            top: Math.min(menuPosition.y, window.innerHeight - 400),
            left: Math.min(menuPosition.x, window.innerWidth - 320),
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-midnight-700">
            <div className="text-xs text-gray-400">Selected Element</div>
            <div className="text-sm text-white font-mono">
              {selectedElement.tagName}
              {selectedElement.id && `#${selectedElement.id}`}
              {selectedElement.className && `.${selectedElement.className.split(' ')[0]}`}
            </div>
            {lastActiveTarget && (
              <div className="text-xs text-blue-400 mt-1">
                → Sending to {lastActiveTarget.name}
              </div>
            )}
          </div>

          {/* Color Picker Action - Always First */}
          <div className="border-b border-midnight-700">
            <div className="px-3 py-2 hover:bg-midnight-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Palette className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-sm text-white font-medium">Change Color</div>
                    <div className="text-xs text-gray-400">Pick a color and apply to element</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={selectedColor}
                    onChange={(e) => {
                      setSelectedColor(e.target.value);
                    }}
                    className="w-10 h-10 rounded cursor-pointer border-2 border-midnight-600 hover:border-blue-400 transition-colors"
                    title="Pick a color"
                  />
                  <div className="text-xs text-gray-500 font-mono">
                    {selectedColor}
                  </div>
                  <button
                    onClick={() => {
                      if (!selectedElement || !sendToLastActive) return;
                      const prompt = `${formatElementContext(selectedElement)}\n\nPlease change the color of this element to: ${selectedColor}\n\nApply this color to the most appropriate property (background-color, color, border-color, etc.) based on the element type. If it's text, change the text color. If it's a container or button, change the background color. Make sure the result has good contrast and remains readable.`;
                      const success = sendToLastActive(prompt);
                      if (success) {
                        setLastSentAction(`Change Color to ${selectedColor}`);
                        setTimeout(() => setLastSentAction(null), 3000);
                        setShowContextMenu(false);
                        setSelectedElement(null);
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Other Actions */}
          <div className="py-1 max-h-64 overflow-y-auto">
            {actionPrompts.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className="w-full px-3 py-2 text-left hover:bg-midnight-700 transition-colors group"
              >
                <div className="flex items-start space-x-3">
                  <div className="text-blue-400 mt-0.5 group-hover:text-blue-300">
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium group-hover:text-blue-100">
                      {action.title}
                    </div>
                    <div className="text-xs text-gray-400 leading-relaxed">
                      {action.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-midnight-700 flex items-center justify-between">
            <button
              onClick={() => setShowContextMenu(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Close (ESC)
            </button>
            {!lastActiveTarget && (
              <div className="text-xs text-orange-400">
                No active agent/terminal
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success feedback */}
      {lastSentAction && (
        <div className="absolute top-16 right-4 z-50 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg">
          <div className="text-sm font-medium">✓ Sent: {lastSentAction}</div>
          <div className="text-xs opacity-90">
            to {lastActiveTarget?.name}
          </div>
        </div>
      )}
    </>
  );
};