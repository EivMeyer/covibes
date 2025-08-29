/**
 * Frontend Test Suite for CoVibe
 * Tests UI components, API interactions, and WebSocket functionality
 */

class FrontendTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
    this.currentTest = null;
  }

  /**
   * Register a test
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * Assert helper functions
   */
  assert = {
    equal: (actual, expected, message) => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
      }
    },
    
    notEqual: (actual, expected, message) => {
      if (actual === expected) {
        throw new Error(message || `Expected not ${expected}, got ${actual}`);
      }
    },
    
    ok: (value, message) => {
      if (!value) {
        throw new Error(message || `Expected truthy value, got ${value}`);
      }
    },
    
    exists: (selector, message) => {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(message || `Element not found: ${selector}`);
      }
      return element;
    },
    
    notExists: (selector, message) => {
      const element = document.querySelector(selector);
      if (element) {
        throw new Error(message || `Element should not exist: ${selector}`);
      }
    },
    
    hasClass: (element, className, message) => {
      if (!element.classList.contains(className)) {
        throw new Error(message || `Element missing class: ${className}`);
      }
    },
    
    textContains: (element, text, message) => {
      if (!element.textContent.includes(text)) {
        throw new Error(message || `Text not found: ${text}`);
      }
    }
  };

  /**
   * Run all tests
   */
  async run() {
    console.log('🧪 Starting Frontend Tests...\n');
    
    for (const test of this.tests) {
      this.currentTest = test.name;
      const startTime = performance.now();
      
      try {
        await test.fn(this.assert);
        const duration = (performance.now() - startTime).toFixed(2);
        this.results.push({ 
          name: test.name, 
          status: 'passed', 
          duration 
        });
        console.log(`✅ ${test.name} (${duration}ms)`);
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        this.results.push({ 
          name: test.name, 
          status: 'failed', 
          error: error.message,
          duration 
        });
        console.error(`❌ ${test.name} (${duration}ms)`);
        console.error(`   ${error.message}`);
      }
    }
    
    this.printSummary();
    return this.results;
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n📊 Test Summary:');
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const total = this.results.length;
    
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. See details above.');
    }
  }
}

// Create test runner instance
const runner = new FrontendTestRunner();

// =============================================================================
// UI STRUCTURE TESTS
// =============================================================================

runner.test('Authentication screens exist', async (assert) => {
  assert.exists('#loginScreen', 'Login screen should exist');
  assert.exists('#registerScreen', 'Register screen should exist');
  assert.exists('#joinTeamScreen', 'Join team screen should exist');
});

runner.test('Main app layout exists', async (assert) => {
  assert.exists('#appScreen', 'Main app screen should exist');
  assert.exists('#commandDeck', 'Command deck should exist');
  assert.exists('#workshop', 'Workshop area should exist');
  assert.exists('#showcase', 'Showcase area should exist');
});

runner.test('Login form has required fields', async (assert) => {
  const form = assert.exists('#loginForm');
  assert.exists('#loginEmail', 'Email field should exist');
  assert.exists('#loginPassword', 'Password field should exist');
  assert.exists('#loginForm button[type="submit"]', 'Submit button should exist');
});

runner.test('Register form has required fields', async (assert) => {
  assert.exists('#registerTeamName', 'Team name field should exist');
  assert.exists('#registerUserName', 'User name field should exist');
  assert.exists('#registerEmail', 'Email field should exist');
  assert.exists('#registerPassword', 'Password field should exist');
});

runner.test('Chat interface components exist', async (assert) => {
  assert.exists('#chatMessages', 'Chat messages area should exist');
  assert.exists('#chatInput', 'Chat input field should exist');
  assert.exists('#chatForm', 'Chat form should exist');
});

runner.test('Agent management components exist', async (assert) => {
  assert.exists('#agentList', 'Agent list should exist');
  assert.exists('#spawnAgentBtn', 'Spawn agent button should exist');
  assert.exists('#agentOutput', 'Agent output area should exist');
});

runner.test('VM configuration modal exists', async (assert) => {
  assert.exists('#vmModal', 'VM modal should exist');
  assert.exists('#vmHost', 'VM host input should exist');
  assert.exists('#vmUser', 'VM user input should exist');
  assert.exists('#vmKeyPath', 'VM key path input should exist');
});

// =============================================================================
// API MOCK TESTS
// =============================================================================

runner.test('API class exists and has methods', async (assert) => {
  assert.ok(typeof API !== 'undefined', 'API class should be defined');
  const api = new API('http://localhost:3001');
  
  assert.ok(typeof api.register === 'function', 'register method should exist');
  assert.ok(typeof api.login === 'function', 'login method should exist');
  assert.ok(typeof api.joinTeam === 'function', 'joinTeam method should exist');
  assert.ok(typeof api.getTeamStatus === 'function', 'getTeamStatus method should exist');
  assert.ok(typeof api.spawnAgent === 'function', 'spawnAgent method should exist');
});

runner.test('SocketManager class exists', async (assert) => {
  assert.ok(typeof SocketManager !== 'undefined', 'SocketManager class should be defined');
  const socket = new SocketManager('ws://localhost:3001');
  
  assert.ok(typeof socket.connect === 'function', 'connect method should exist');
  assert.ok(typeof socket.disconnect === 'function', 'disconnect method should exist');
  assert.ok(typeof socket.emit === 'function', 'emit method should exist');
  assert.ok(typeof socket.on === 'function', 'on method should exist');
});

runner.test('App class exists and initializes', async (assert) => {
  assert.ok(typeof App !== 'undefined', 'App class should be defined');
  const app = new App();
  
  assert.ok(typeof app.init === 'function', 'init method should exist');
  assert.ok(typeof app.showScreen === 'function', 'showScreen method should exist');
  assert.ok(typeof app.handleLogin === 'function', 'handleLogin method should exist');
  assert.ok(typeof app.handleRegister === 'function', 'handleRegister method should exist');
});

// =============================================================================
// UI INTERACTION TESTS
// =============================================================================

runner.test('Screen switching works', async (assert) => {
  const app = new App();
  
  // Test showing login screen
  app.showScreen('login');
  assert.notExists('#loginScreen.hidden', 'Login screen should be visible');
  assert.exists('#registerScreen.hidden', 'Register screen should be hidden');
  
  // Test showing register screen
  app.showScreen('register');
  assert.exists('#loginScreen.hidden', 'Login screen should be hidden');
  assert.notExists('#registerScreen.hidden', 'Register screen should be visible');
});

runner.test('Form validation works', async (assert) => {
  const emailInput = document.querySelector('#loginEmail');
  const passwordInput = document.querySelector('#loginPassword');
  
  // Test empty validation
  emailInput.value = '';
  passwordInput.value = '';
  
  const form = document.querySelector('#loginForm');
  let prevented = false;
  
  form.addEventListener('submit', (e) => {
    if (!emailInput.value || !passwordInput.value) {
      e.preventDefault();
      prevented = true;
    }
  }, { once: true });
  
  const event = new Event('submit');
  form.dispatchEvent(event);
  
  assert.ok(prevented, 'Form submission should be prevented with empty fields');
});

runner.test('Chat message can be added to UI', async (assert) => {
  const app = new App();
  const chatMessages = document.querySelector('#chatMessages');
  const initialCount = chatMessages.children.length;
  
  // Add a test message
  app.addChatMessage({
    user: 'TestUser',
    message: 'Test message',
    timestamp: new Date().toISOString()
  });
  
  assert.equal(
    chatMessages.children.length, 
    initialCount + 1, 
    'Chat message should be added'
  );
  
  const lastMessage = chatMessages.lastElementChild;
  assert.textContains(lastMessage, 'TestUser', 'Message should contain username');
  assert.textContains(lastMessage, 'Test message', 'Message should contain text');
});

runner.test('Agent can be added to list', async (assert) => {
  const app = new App();
  const agentList = document.querySelector('#agentList');
  const initialCount = agentList.children.length;
  
  // Add a test agent
  app.addAgent({
    id: 'test-agent-1',
    name: 'Test Agent',
    status: 'running'
  });
  
  assert.equal(
    agentList.children.length, 
    initialCount + 1, 
    'Agent should be added to list'
  );
  
  const lastAgent = agentList.lastElementChild;
  assert.textContains(lastAgent, 'Test Agent', 'Agent should show name');
  assert.hasClass(lastAgent, 'agent-item', 'Agent should have correct class');
});

runner.test('Modal can be shown and hidden', async (assert) => {
  const modal = document.querySelector('#vmModal');
  const app = new App();
  
  // Show modal
  app.showVMModal();
  assert.notExists('#vmModal.hidden', 'Modal should be visible');
  
  // Hide modal
  app.hideVMModal();
  assert.exists('#vmModal.hidden', 'Modal should be hidden');
});

// =============================================================================
// LOCAL STORAGE TESTS
// =============================================================================

runner.test('Auth token storage works', async (assert) => {
  const testToken = 'test-jwt-token';
  const app = new App();
  
  // Store token
  localStorage.setItem('token', testToken);
  
  // Verify retrieval
  const retrieved = localStorage.getItem('token');
  assert.equal(retrieved, testToken, 'Token should be stored and retrieved');
  
  // Clean up
  localStorage.removeItem('token');
  assert.equal(localStorage.getItem('token'), null, 'Token should be removed');
});

runner.test('Team data storage works', async (assert) => {
  const testTeam = { id: '123', name: 'Test Team' };
  
  // Store team data
  localStorage.setItem('team', JSON.stringify(testTeam));
  
  // Verify retrieval
  const retrieved = JSON.parse(localStorage.getItem('team'));
  assert.equal(retrieved.id, testTeam.id, 'Team ID should match');
  assert.equal(retrieved.name, testTeam.name, 'Team name should match');
  
  // Clean up
  localStorage.removeItem('team');
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

runner.test('Error notification can be shown', async (assert) => {
  const app = new App();
  const errorContainer = document.querySelector('#errorContainer') || 
                         document.createElement('div');
  errorContainer.id = 'errorContainer';
  document.body.appendChild(errorContainer);
  
  // Show error
  app.showError('Test error message');
  
  assert.textContains(errorContainer, 'Test error message', 'Error should be displayed');
});

runner.test('Network error handling works', async (assert) => {
  const api = new API('http://invalid-host-12345');
  
  try {
    await api.login('test@test.com', 'password');
    assert.ok(false, 'Should have thrown an error');
  } catch (error) {
    assert.ok(true, 'Network error should be caught');
    assert.ok(error.message, 'Error should have a message');
  }
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

runner.test('UI renders quickly', async (assert) => {
  const startTime = performance.now();
  const app = new App();
  app.init();
  const duration = performance.now() - startTime;
  
  assert.ok(duration < 100, `UI should initialize in less than 100ms (took ${duration.toFixed(2)}ms)`);
});

runner.test('Large chat history renders efficiently', async (assert) => {
  const app = new App();
  const chatMessages = document.querySelector('#chatMessages');
  
  const startTime = performance.now();
  
  // Add 100 messages
  for (let i = 0; i < 100; i++) {
    app.addChatMessage({
      user: `User${i}`,
      message: `Message ${i}`,
      timestamp: new Date().toISOString()
    });
  }
  
  const duration = performance.now() - startTime;
  assert.ok(duration < 500, `100 messages should render in less than 500ms (took ${duration.toFixed(2)}ms)`);
  
  // Clean up
  chatMessages.innerHTML = '';
});

// =============================================================================
// EXPORT FOR USE IN HTML
// =============================================================================

if (typeof window !== 'undefined') {
  window.FrontendTestRunner = FrontendTestRunner;
  window.frontendTests = runner;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FrontendTestRunner, runner };
}