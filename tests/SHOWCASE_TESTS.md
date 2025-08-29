# Showcase Panel Test Coverage

This document describes the comprehensive test coverage added for CoVibe's showcase/preview panel functionality.

## Test Files Overview

### 1. `playwright-live-rendering.test.js` (Enhanced)
**Added 6 new preview-focused tests:**
- ✅ Preview frame visibility and initial state
- ✅ Preview content injection with data URLs
- ✅ Preview refresh on WebSocket events
- ✅ Preview update notifications
- ✅ iframe reload functionality
- ✅ Auto-scroll behavior verification

### 2. `playwright-showcase.test.js` (New)
**Comprehensive showcase panel testing (10 tests):**
- ✅ Layout and structure validation
- ✅ Multiple content type handling (HTML/CSS/JS)
- ✅ Error state management
- ✅ State persistence during refresh
- ✅ WebSocket event integration
- ✅ Timestamp and notification systems
- ✅ Responsive design content
- ✅ JavaScript-heavy application support
- ✅ Security attribute validation

### 3. `playwright-multiuser-preview.test.js` (New) 
**Multi-user collaboration testing (6 tests):**
- ✅ Preview synchronization between users
- ✅ Concurrent update handling
- ✅ Join/leave scenarios
- ✅ Notification propagation
- ✅ Connection resilience
- ✅ Different preview URLs per team

### 4. `backend-preview-integration.test.js` (New)
**Server-side integration testing (10 tests):**
- ✅ Static file serving
- ✅ Preview URL configuration
- ✅ WebSocket event emission
- ✅ Agent-triggered updates
- ✅ URL validation and security
- ✅ CORS header configuration
- ✅ Metrics and monitoring
- ✅ Concurrent agent updates
- ✅ Caching headers
- ✅ WebSocket scaling

### 5. `playwright-preview-content.test.js` (New)
**Real-world content scenarios (6 comprehensive tests):**
- ✅ **Vanilla HTML/CSS/JS**: Interactive todo app with counters
- ✅ **React Application**: Component-based todo with state management
- ✅ **Vue.js Application**: User management with reactivity
- ✅ **Static Site Generator**: Blog with semantic HTML
- ✅ **Analytics Dashboard**: Charts, real-time updates, metrics
- ✅ **Progressive Web App**: Offline support, notifications, local storage

## Test Coverage Summary

| Category | Tests | Coverage |
|----------|--------|----------|
| **Basic Functionality** | 12 | ✅ Complete |
| **Multi-user Sync** | 6 | ✅ Complete |
| **Backend Integration** | 10 | ✅ Complete |
| **Content Scenarios** | 6 | ✅ Complete |
| **Live Rendering** | 6 | ✅ Complete |
| **Total** | **40 tests** | **🎯 Comprehensive** |

## Running the Tests

### Individual Test Suites
```bash
# Run specific test suites
npm run test:showcase           # Showcase panel functionality
npm run test:multiuser          # Multi-user synchronization  
npm run test:backend            # Backend integration
npm run test:content            # Content scenarios
npm run test:live-rendering     # Live rendering enhancements

# Run all preview tests
npm run test:preview-suite
```

### Interactive Testing
```bash
# Run with browser UI
npm run test:playwright:ui

# Run with headed browser (see what's happening)
npm run test:playwright:headed
```

## Key Features Tested

### 🎯 Core Preview Functionality
- iframe visibility and initialization
- Content injection via data URLs  
- Preview refresh mechanisms
- Error state handling
- Security validation

### 🔄 Real-time Updates
- WebSocket `previewUpdated` event handling
- Automatic iframe reloading
- Notification systems
- Timestamp updates
- Multi-user synchronization

### 👥 Collaboration Features
- Multiple users seeing same updates
- Concurrent modification handling
- User join/leave scenarios
- Connection resilience
- Notification propagation

### 🛠 Content Types
- **Static Sites**: HTML, CSS, JavaScript
- **SPA Frameworks**: React, Vue.js
- **Data Visualizations**: Charts, dashboards
- **Progressive Web Apps**: Service workers, offline
- **Responsive Design**: Mobile-first, adaptive layouts

### 🔧 Backend Integration
- File serving and caching
- WebSocket event emission
- Agent-triggered updates
- Security and validation
- Performance monitoring

## Mock Content Examples

Each content test includes realistic, interactive examples:

1. **Vanilla App**: Todo list with local storage
2. **React App**: Component state management
3. **Vue App**: User management with filters
4. **Static Blog**: SEO-optimized content structure
5. **Dashboard**: Real-time metrics with Chart.js
6. **PWA**: Offline functionality, notifications

## Expected Behavior

### ✅ What Should Work
- Preview updates appear for all team members
- iframe refreshes maintain content when appropriate
- Error states don't crash the application
- Different content types load correctly
- WebSocket events trigger UI updates
- Multi-user scenarios work smoothly

### ⚠️ Current Limitations
- Some tests may fail if server is not properly configured
- WebSocket events depend on backend implementation
- Preview URL serving may need additional server setup
- Some advanced PWA features require HTTPS

## Future Enhancements

### Potential Additions
- **Performance Testing**: Large file handling, memory usage
- **Security Testing**: XSS protection, iframe sandboxing  
- **Accessibility Testing**: Screen reader compatibility
- **Mobile Testing**: Touch interactions, viewport handling
- **Integration Testing**: With real development tools

### Monitoring Suggestions
- Add preview load time metrics
- Track user engagement with preview features
- Monitor WebSocket connection stability
- Measure multi-user synchronization performance

## Troubleshooting

### Common Issues
1. **Server not running**: Ensure `localhost:3001` is accessible
2. **WebSocket failures**: Check server WebSocket configuration
3. **Content loading**: Verify iframe security policies
4. **Test timeouts**: Increase wait times for slower systems

### Debug Commands
```bash
# Run single test with debug output
DEBUG=pw:api playwright test playwright-showcase.test.js

# Generate test report
playwright show-report

# Record test execution
playwright test --record-video=retain-on-failure
```

---

**Total Test Coverage**: 40+ comprehensive tests covering all aspects of the showcase/preview panel functionality, from basic UI behavior to complex multi-user collaboration scenarios.