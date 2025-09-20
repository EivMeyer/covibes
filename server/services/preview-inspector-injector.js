/**
 * Preview Inspector Injector
 *
 * TODO: Inject the inspector script server-side to avoid CORS issues
 *
 * This service should:
 * 1. Intercept HTML responses from preview containers
 * 2. Inject the inspector script before </head> tag
 * 3. Enable element selection even for cross-origin previews
 *
 * Implementation approaches:
 * A) Proxy middleware that modifies HTML responses
 * B) Inject at Docker container build time
 * C) Add to preview template files
 *
 * The inspector script to inject:
 */

const INSPECTOR_SCRIPT = `
<script id="colabvibe-inspector">
(function() {
  // Same script as in PreviewInspector.tsx but injected server-side
  let hoveredElement = null;
  const originalStyles = new WeakMap();

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.className) {
        selector += '.' + Array.from(el.classList).join('.');
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function getImportantStyles(element) {
    const styles = window.getComputedStyle(element);
    const important = {};
    const keys = [
      'display', 'position', 'width', 'height',
      'padding', 'margin', 'color', 'backgroundColor',
      'fontSize', 'fontWeight', 'border', 'borderRadius',
      'boxShadow', 'opacity', 'zIndex', 'overflow'
    ];

    keys.forEach(key => {
      const value = styles[key];
      if (value && value !== 'none' && value !== 'auto' && value !== '0px') {
        important[key] = value;
      }
    });

    return important;
  }

  // Listen for enable/disable messages from parent
  window.addEventListener('message', function(event) {
    if (event.data.type === 'enable-inspector') {
      window.__inspectorActive = event.data.active;
    }
  });

  // Mouse handlers
  function handleMouseOver(e) {
    if (!window.__inspectorActive) return;

    if (e.target === hoveredElement) return;

    if (hoveredElement && originalStyles.has(hoveredElement)) {
      hoveredElement.style.outline = originalStyles.get(hoveredElement).outline || '';
      hoveredElement.style.cursor = originalStyles.get(hoveredElement).cursor || '';
    }

    originalStyles.set(e.target, {
      outline: e.target.style.outline,
      cursor: e.target.style.cursor
    });

    e.target.style.outline = '2px solid #3B82F6';
    e.target.style.cursor = 'crosshair';
    hoveredElement = e.target;
  }

  function handleMouseOut(e) {
    if (!window.__inspectorActive) return;
    if (e.target === hoveredElement && originalStyles.has(e.target)) {
      e.target.style.outline = originalStyles.get(e.target).outline || '';
      e.target.style.cursor = originalStyles.get(e.target).cursor || '';
      hoveredElement = null;
    }
  }

  function handleClick(e) {
    if (!window.__inspectorActive) return;

    e.preventDefault();
    e.stopPropagation();

    window.parent.postMessage({
      type: 'inspector-element-selected',
      data: {
        html: e.target.outerHTML.substring(0, 500),
        selector: getSelector(e.target),
        computedStyles: getImportantStyles(e.target),
        rect: e.target.getBoundingClientRect(),
        text: e.target.textContent?.substring(0, 200) || '',
        tagName: e.target.tagName.toLowerCase(),
        className: e.target.className || '',
        id: e.target.id || ''
      },
      position: { x: e.pageX, y: e.pageY }
    }, '*');
  }

  // Set up event listeners
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleClick);

  console.log('ColabVibe Inspector ready (server-injected)');
})();
</script>
`;

/**
 * Middleware to inject inspector script into HTML responses
 *
 * Usage in preview proxy:
 * app.use('/preview/*', injectInspectorScript);
 */
export function injectInspectorScript(req, res, next) {
  // TODO: Implement HTML response interception
  // 1. Capture response body
  // 2. Check if it's HTML content
  // 3. Inject script before </head>
  // 4. Return modified HTML

  next();
}

export { INSPECTOR_SCRIPT };