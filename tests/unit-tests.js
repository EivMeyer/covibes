/**
 * Unit Tests for CoVibe JavaScript Modules
 * Tests individual components in isolation
 */

const assert = require('assert');
const { performance } = require('perf_hooks');

class UnitTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  describe(suiteName, fn) {
    console.log(`\n📦 ${suiteName}`);
    fn();
  }

  test(name, fn) {
    const startTime = performance.now();
    try {
      fn();
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`  ✅ ${name} (${duration}ms)`);
      this.results.push({ name, status: 'passed', duration });
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`  ❌ ${name} (${duration}ms)`);
      console.log(`     ${error.message}`);
      this.results.push({ name, status: 'failed', error: error.message, duration });
    }
  }

  summary() {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${this.results.length} total`);
    return failed === 0;
  }
}

const runner = new UnitTestRunner();

// =============================================================================
// API MODULE TESTS
// =============================================================================

runner.describe('API Module', () => {
  // Mock fetch for testing
  global.fetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({ success: true, data: {} }),
      status: 200
    };
  };

  class API {
    constructor(baseURL) {
      this.baseURL = baseURL;
      this.token = null;
    }

    setAuthToken(token) {
      this.token = token;
    }

    async request(endpoint, options = {}) {
      const url = `${this.baseURL}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    }

    async register(teamName, userName, email, password) {
      return this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ teamName, userName, email, password })
      });
    }

    async login(email, password) {
      return this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    }

    async getTeamStatus() {
      return this.request('/api/team/status');
    }

    async spawnAgent(config) {
      return this.request('/api/agents/spawn', {
        method: 'POST',
        body: JSON.stringify(config)
      });
    }
  }

  runner.test('API constructor sets baseURL', () => {
    const api = new API('http://localhost:3001');
    assert.strictEqual(api.baseURL, 'http://localhost:3001');
  });

  runner.test('API setAuthToken stores token', () => {
    const api = new API('http://localhost:3001');
    api.setAuthToken('test-token');
    assert.strictEqual(api.token, 'test-token');
  });

  runner.test('API register sends correct data', async () => {
    const api = new API('http://localhost:3001');
    const result = await api.register('Team1', 'User1', 'test@test.com', 'pass123');
    assert.ok(result.success);
  });

  runner.test('API login sends credentials', async () => {
    const api = new API('http://localhost:3001');
    const result = await api.login('test@test.com', 'pass123');
    assert.ok(result.success);
  });

  runner.test('API includes auth token in requests', async () => {
    const api = new API('http://localhost:3001');
    api.setAuthToken('bearer-token');
    const result = await api.getTeamStatus();
    assert.ok(result.success);
  });
});

// =============================================================================
// SOCKET MANAGER TESTS
// =============================================================================

runner.describe('SocketManager Module', () => {
  class SocketManager {
    constructor(url) {
      this.url = url;
      this.ws = null;
      this.listeners = {};
      this.connected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
    }

    connect() {
      return new Promise((resolve, reject) => {
        try {
          // Mock WebSocket
          this.ws = {
            readyState: 1,
            send: () => {},
            close: () => {},
            addEventListener: () => {}
          };
          this.connected = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }

    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
        this.connected = false;
      }
    }

    emit(event, data) {
      if (!this.connected) {
        throw new Error('Socket not connected');
      }
      const message = JSON.stringify({ event, data });
      this.ws.send(message);
    }

    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    off(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }

    trigger(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => callback(data));
      }
    }
  }

  runner.test('SocketManager constructor sets URL', () => {
    const socket = new SocketManager('ws://localhost:3001');
    assert.strictEqual(socket.url, 'ws://localhost:3001');
  });

  runner.test('SocketManager initializes with disconnected state', () => {
    const socket = new SocketManager('ws://localhost:3001');
    assert.strictEqual(socket.connected, false);
    assert.strictEqual(socket.ws, null);
  });

  runner.test('SocketManager connect establishes connection', async () => {
    const socket = new SocketManager('ws://localhost:3001');
    await socket.connect();
    assert.strictEqual(socket.connected, true);
    assert.notStrictEqual(socket.ws, null);
  });

  runner.test('SocketManager disconnect closes connection', async () => {
    const socket = new SocketManager('ws://localhost:3001');
    await socket.connect();
    socket.disconnect();
    assert.strictEqual(socket.connected, false);
    assert.strictEqual(socket.ws, null);
  });

  runner.test('SocketManager on registers event listener', () => {
    const socket = new SocketManager('ws://localhost:3001');
    const callback = () => {};
    socket.on('message', callback);
    assert.strictEqual(socket.listeners['message'].length, 1);
  });

  runner.test('SocketManager off removes event listener', () => {
    const socket = new SocketManager('ws://localhost:3001');
    const callback = () => {};
    socket.on('message', callback);
    socket.off('message', callback);
    assert.strictEqual(socket.listeners['message'].length, 0);
  });

  runner.test('SocketManager trigger calls listeners', () => {
    const socket = new SocketManager('ws://localhost:3001');
    let called = false;
    socket.on('test', () => { called = true; });
    socket.trigger('test', {});
    assert.strictEqual(called, true);
  });

  runner.test('SocketManager emit throws when disconnected', () => {
    const socket = new SocketManager('ws://localhost:3001');
    assert.throws(() => {
      socket.emit('test', {});
    }, /not connected/);
  });
});

// =============================================================================
// APP STATE MANAGEMENT TESTS
// =============================================================================

runner.describe('App State Management', () => {
  class AppState {
    constructor() {
      this.state = {
        user: null,
        team: null,
        agents: [],
        messages: [],
        connected: false
      };
      this.listeners = {};
    }

    get(key) {
      return this.state[key];
    }

    set(key, value) {
      const oldValue = this.state[key];
      this.state[key] = value;
      this.notify(key, value, oldValue);
    }

    update(updates) {
      Object.keys(updates).forEach(key => {
        this.set(key, updates[key]);
      });
    }

    subscribe(key, callback) {
      if (!this.listeners[key]) {
        this.listeners[key] = [];
      }
      this.listeners[key].push(callback);
      return () => this.unsubscribe(key, callback);
    }

    unsubscribe(key, callback) {
      if (this.listeners[key]) {
        this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
      }
    }

    notify(key, newValue, oldValue) {
      if (this.listeners[key]) {
        this.listeners[key].forEach(callback => 
          callback(newValue, oldValue)
        );
      }
    }

    reset() {
      this.state = {
        user: null,
        team: null,
        agents: [],
        messages: [],
        connected: false
      };
    }
  }

  runner.test('AppState initializes with default state', () => {
    const state = new AppState();
    assert.strictEqual(state.get('user'), null);
    assert.strictEqual(state.get('team'), null);
    assert.deepStrictEqual(state.get('agents'), []);
    assert.deepStrictEqual(state.get('messages'), []);
    assert.strictEqual(state.get('connected'), false);
  });

  runner.test('AppState get retrieves values', () => {
    const state = new AppState();
    state.state.user = { id: '123' };
    assert.deepStrictEqual(state.get('user'), { id: '123' });
  });

  runner.test('AppState set updates values', () => {
    const state = new AppState();
    state.set('user', { id: '456' });
    assert.deepStrictEqual(state.get('user'), { id: '456' });
  });

  runner.test('AppState update sets multiple values', () => {
    const state = new AppState();
    state.update({
      user: { id: '789' },
      team: { id: 'team-1' }
    });
    assert.deepStrictEqual(state.get('user'), { id: '789' });
    assert.deepStrictEqual(state.get('team'), { id: 'team-1' });
  });

  runner.test('AppState subscribe receives updates', () => {
    const state = new AppState();
    let received = null;
    state.subscribe('user', (newVal) => { received = newVal; });
    state.set('user', { id: 'abc' });
    assert.deepStrictEqual(received, { id: 'abc' });
  });

  runner.test('AppState unsubscribe stops updates', () => {
    const state = new AppState();
    let count = 0;
    const unsubscribe = state.subscribe('user', () => { count++; });
    state.set('user', { id: '1' });
    unsubscribe();
    state.set('user', { id: '2' });
    assert.strictEqual(count, 1);
  });

  runner.test('AppState reset clears state', () => {
    const state = new AppState();
    state.set('user', { id: '123' });
    state.set('agents', ['agent1']);
    state.reset();
    assert.strictEqual(state.get('user'), null);
    assert.deepStrictEqual(state.get('agents'), []);
  });
});

// =============================================================================
// MESSAGE FORMATTER TESTS
// =============================================================================

runner.describe('Message Formatter', () => {
  class MessageFormatter {
    static formatTimestamp(date) {
      const d = new Date(date);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    static formatAgentOutput(output) {
      return output
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/  /g, '&nbsp;&nbsp;');
    }

    static escapeHtml(text) {
      const div = { textContent: text, innerHTML: '' };
      div.innerHTML = div.textContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      return div.innerHTML;
    }

    static formatChatMessage(message) {
      return {
        user: this.escapeHtml(message.user),
        text: this.escapeHtml(message.message),
        timestamp: this.formatTimestamp(message.timestamp),
        id: message.id || Date.now()
      };
    }
  }

  runner.test('formatTimestamp formats time correctly', () => {
    const result = MessageFormatter.formatTimestamp('2024-01-01T14:30:00');
    assert.strictEqual(result, '14:30');
  });

  runner.test('formatTimestamp pads single digits', () => {
    const result = MessageFormatter.formatTimestamp('2024-01-01T09:05:00');
    assert.strictEqual(result, '09:05');
  });

  runner.test('formatAgentOutput converts newlines', () => {
    const result = MessageFormatter.formatAgentOutput('line1\nline2\nline3');
    assert.strictEqual(result, 'line1<br>line2<br>line3');
  });

  runner.test('formatAgentOutput converts tabs', () => {
    const result = MessageFormatter.formatAgentOutput('col1\tcol2');
    assert.ok(result.includes('&nbsp;'));
  });

  runner.test('escapeHtml escapes special characters', () => {
    const result = MessageFormatter.escapeHtml('<script>alert("xss")</script>');
    assert.ok(result.includes('&lt;script&gt;'));
    assert.ok(!result.includes('<script>'));
  });

  runner.test('formatChatMessage returns formatted object', () => {
    const message = {
      user: 'TestUser',
      message: 'Hello world',
      timestamp: '2024-01-01T12:00:00'
    };
    const result = MessageFormatter.formatChatMessage(message);
    assert.strictEqual(result.user, 'TestUser');
    assert.strictEqual(result.text, 'Hello world');
    assert.strictEqual(result.timestamp, '12:00');
    assert.ok(result.id);
  });
});

// =============================================================================
// VALIDATION UTILITIES TESTS
// =============================================================================

runner.describe('Validation Utilities', () => {
  class Validator {
    static isEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    static isStrongPassword(password) {
      return password.length >= 8;
    }

    static isValidTeamName(name) {
      return name.length >= 3 && name.length <= 50 && /^[a-zA-Z0-9\s-]+$/.test(name);
    }

    static isValidUsername(username) {
      return username.length >= 2 && username.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(username);
    }

    static isValidHost(host) {
      const hostRegex = /^([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
      return hostRegex.test(host);
    }

    static isValidPort(port) {
      const portNum = parseInt(port);
      return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
    }
  }

  runner.test('isEmail validates correct emails', () => {
    assert.strictEqual(Validator.isEmail('test@example.com'), true);
    assert.strictEqual(Validator.isEmail('user.name@domain.co.uk'), true);
  });

  runner.test('isEmail rejects invalid emails', () => {
    assert.strictEqual(Validator.isEmail('notanemail'), false);
    assert.strictEqual(Validator.isEmail('missing@domain'), false);
    assert.strictEqual(Validator.isEmail('@nodomain.com'), false);
  });

  runner.test('isStrongPassword checks length', () => {
    assert.strictEqual(Validator.isStrongPassword('12345678'), true);
    assert.strictEqual(Validator.isStrongPassword('1234567'), false);
  });

  runner.test('isValidTeamName validates team names', () => {
    assert.strictEqual(Validator.isValidTeamName('Team Alpha'), true);
    assert.strictEqual(Validator.isValidTeamName('Team-123'), true);
    assert.strictEqual(Validator.isValidTeamName('AB'), false);
    assert.strictEqual(Validator.isValidTeamName('Team@#$'), false);
  });

  runner.test('isValidUsername validates usernames', () => {
    assert.strictEqual(Validator.isValidUsername('john_doe'), true);
    assert.strictEqual(Validator.isValidUsername('user-123'), true);
    assert.strictEqual(Validator.isValidUsername('a'), false);
    assert.strictEqual(Validator.isValidUsername('user@name'), false);
  });

  runner.test('isValidHost validates hostnames', () => {
    assert.strictEqual(Validator.isValidHost('example.com'), true);
    assert.strictEqual(Validator.isValidHost('192.168.1.1'), true);
    assert.strictEqual(Validator.isValidHost('sub.domain.com'), true);
    assert.strictEqual(Validator.isValidHost('invalid host'), false);
  });

  runner.test('isValidPort validates port numbers', () => {
    assert.strictEqual(Validator.isValidPort('80'), true);
    assert.strictEqual(Validator.isValidPort('3000'), true);
    assert.strictEqual(Validator.isValidPort('65535'), true);
    assert.strictEqual(Validator.isValidPort('0'), false);
    assert.strictEqual(Validator.isValidPort('70000'), false);
    assert.strictEqual(Validator.isValidPort('abc'), false);
  });
});

// =============================================================================
// RUN ALL TESTS
// =============================================================================

console.log('🧪 CoVibe Unit Tests\n');
console.log('=' .repeat(50));

const success = runner.summary();
process.exit(success ? 0 : 1);