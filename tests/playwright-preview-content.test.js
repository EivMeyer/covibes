/**
 * Mock Preview Content Tests for Different File Types
 * Tests various development scenarios and file types in the preview panel
 */

const { test, expect } = require('@playwright/test');

test.describe('Preview Content Scenarios', () => {
  const BASE_URL = 'http://localhost:3001';
  let token;
  
  test.beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: 'PreviewContent',
        userName: 'TestUser',
        email: 'content@preview.com',
        password: 'password123'
      })
    });
    
    const result = await response.json();
    token = result.token;
  });

  // Helper function to set up page
  async function setupPage(page) {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    await page.waitForTimeout(2000);
  }

  test('should handle vanilla HTML/CSS/JS project preview', async ({ page }) => {
    await setupPage(page);
    
    const vanillaProjectTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const vanillaHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vanilla Web App</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container { 
              background: rgba(255,255,255,0.1); 
              padding: 30px; 
              border-radius: 15px; 
              backdrop-filter: blur(10px);
            }
            button {
              background: #ff6b6b;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin: 10px 5px;
            }
            button:hover { background: #ff5252; }
            #counter { font-size: 24px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Vanilla Web App Preview</h1>
            <p>This is a complete web application built with vanilla HTML, CSS, and JavaScript.</p>
            
            <div id="counter">Count: <span id="count">0</span></div>
            <button onclick="increment()">+1</button>
            <button onclick="decrement()">-1</button>
            <button onclick="reset()">Reset</button>
            
            <div>
              <h3>Todo List</h3>
              <input type="text" id="todoInput" placeholder="Add a task...">
              <button onclick="addTodo()">Add</button>
              <ul id="todoList"></ul>
            </div>
          </div>
          
          <script>
            let count = 0;
            let todos = [];
            
            function updateCount() {
              document.getElementById('count').textContent = count;
            }
            
            function increment() { count++; updateCount(); }
            function decrement() { count--; updateCount(); }
            function reset() { count = 0; updateCount(); }
            
            function addTodo() {
              const input = document.getElementById('todoInput');
              const text = input.value.trim();
              if (text) {
                todos.push(text);
                input.value = '';
                renderTodos();
              }
            }
            
            function renderTodos() {
              const list = document.getElementById('todoList');
              list.innerHTML = todos.map((todo, i) => 
                \`<li>\${todo} <button onclick="removeTodo(\${i})">×</button></li>\`
              ).join('');
            }
            
            function removeTodo(index) {
              todos.splice(index, 1);
              renderTodos();
            }
            
            // Auto-demo
            setTimeout(() => { count = 5; updateCount(); }, 1000);
          </script>
        </body>
        </html>
      `;
      
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(vanillaHTML);
      
      return {
        hasInteractiveElements: vanillaHTML.includes('onclick='),
        hasCSS: vanillaHTML.includes('<style>'),
        hasJavaScript: vanillaHTML.includes('<script>'),
        hasTodoList: vanillaHTML.includes('Todo List'),
        contentLoaded: iframe.src.length > 100
      };
    });
    
    expect(vanillaProjectTest.hasInteractiveElements).toBeTruthy();
    expect(vanillaProjectTest.hasCSS).toBeTruthy();
    expect(vanillaProjectTest.hasJavaScript).toBeTruthy();
    expect(vanillaProjectTest.contentLoaded).toBeTruthy();
  });

  test('should handle React application preview', async ({ page }) => {
    await setupPage(page);
    
    const reactTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const reactApp = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>React Todo App</title>
          <script crossorigin src="https://unpkg.com/react@17/umd/react.development.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .todo-app { background: #f5f5f5; padding: 20px; border-radius: 8px; }
            .todo-input { width: 70%; padding: 10px; margin-right: 10px; }
            .todo-item { 
              display: flex; justify-content: space-between; 
              padding: 10px; margin: 5px 0; background: white; border-radius: 4px; 
            }
            .done { text-decoration: line-through; opacity: 0.7; }
            button { padding: 5px 10px; margin: 0 2px; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          
          <script type="text/babel">
            function TodoApp() {
              const [todos, setTodos] = React.useState([
                { id: 1, text: 'Learn React', done: false },
                { id: 2, text: 'Build awesome apps', done: false }
              ]);
              const [inputValue, setInputValue] = React.useState('');
              
              const addTodo = () => {
                if (inputValue.trim()) {
                  setTodos([...todos, {
                    id: Date.now(),
                    text: inputValue,
                    done: false
                  }]);
                  setInputValue('');
                }
              };
              
              const toggleTodo = (id) => {
                setTodos(todos.map(todo => 
                  todo.id === id ? { ...todo, done: !todo.done } : todo
                ));
              };
              
              const deleteTodo = (id) => {
                setTodos(todos.filter(todo => todo.id !== id));
              };
              
              return React.createElement('div', { className: 'todo-app' },
                React.createElement('h1', null, '⚛️ React Todo App'),
                React.createElement('div', null,
                  React.createElement('input', {
                    type: 'text',
                    className: 'todo-input',
                    value: inputValue,
                    onChange: (e) => setInputValue(e.target.value),
                    placeholder: 'Add a new todo...',
                    onKeyPress: (e) => e.key === 'Enter' && addTodo()
                  }),
                  React.createElement('button', { onClick: addTodo }, 'Add Todo')
                ),
                React.createElement('div', null,
                  todos.map(todo =>
                    React.createElement('div', { 
                      key: todo.id, 
                      className: \`todo-item \${todo.done ? 'done' : ''}\`
                    },
                      React.createElement('span', { 
                        onClick: () => toggleTodo(todo.id),
                        style: { cursor: 'pointer', flex: 1 }
                      }, todo.text),
                      React.createElement('button', { 
                        onClick: () => deleteTodo(todo.id) 
                      }, '🗑️')
                    )
                  )
                ),
                React.createElement('p', null, 
                  \`Total: \${todos.length}, Completed: \${todos.filter(t => t.done).length}\`
                )
              );
            }
            
            ReactDOM.render(React.createElement(TodoApp), document.getElementById('root'));
          </script>
        </body>
        </html>
      `;
      
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(reactApp);
      
      return {
        hasReact: reactApp.includes('React.createElement'),
        hasState: reactApp.includes('useState'),
        hasComponents: reactApp.includes('TodoApp'),
        hasBabel: reactApp.includes('babel'),
        contentLoaded: iframe.src.includes('React Todo App')
      };
    });
    
    expect(reactTest.hasReact).toBeTruthy();
    expect(reactTest.hasState).toBeTruthy();
    expect(reactTest.contentLoaded).toBeTruthy();
  });

  test('should handle Vue.js application preview', async ({ page }) => {
    await setupPage(page);
    
    const vueTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const vueApp = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Vue.js App</title>
          <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .vue-app { background: #42b883; color: white; padding: 20px; border-radius: 8px; }
            .form-group { margin: 15px 0; }
            input, button { padding: 10px; margin: 5px; border: none; border-radius: 4px; }
            .user-card { 
              background: rgba(255,255,255,0.2); 
              padding: 15px; margin: 10px 0; border-radius: 4px; 
            }
          </style>
        </head>
        <body>
          <div id="app"></div>
          
          <script>
            const { createApp, ref, computed } = Vue;
            
            createApp({
              setup() {
                const users = ref([
                  { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
                  { id: 2, name: 'Bob', email: 'bob@example.com', active: false }
                ]);
                
                const newUserName = ref('');
                const newUserEmail = ref('');
                const filterActive = ref(false);
                
                const filteredUsers = computed(() => {
                  return filterActive.value 
                    ? users.value.filter(user => user.active)
                    : users.value;
                });
                
                const addUser = () => {
                  if (newUserName.value && newUserEmail.value) {
                    users.value.push({
                      id: Date.now(),
                      name: newUserName.value,
                      email: newUserEmail.value,
                      active: true
                    });
                    newUserName.value = '';
                    newUserEmail.value = '';
                  }
                };
                
                const toggleUser = (user) => {
                  user.active = !user.active;
                };
                
                return {
                  users,
                  newUserName,
                  newUserEmail,
                  filterActive,
                  filteredUsers,
                  addUser,
                  toggleUser
                };
              },
              
              template: \`
                <div class="vue-app">
                  <h1>🌟 Vue.js User Manager</h1>
                  
                  <div class="form-group">
                    <input v-model="newUserName" placeholder="User name" />
                    <input v-model="newUserEmail" placeholder="Email" />
                    <button @click="addUser">Add User</button>
                  </div>
                  
                  <div class="form-group">
                    <label>
                      <input type="checkbox" v-model="filterActive" />
                      Show only active users
                    </label>
                  </div>
                  
                  <div v-for="user in filteredUsers" :key="user.id" class="user-card">
                    <h3>{{ user.name }}</h3>
                    <p>{{ user.email }}</p>
                    <p>Status: {{ user.active ? 'Active' : 'Inactive' }}</p>
                    <button @click="toggleUser(user)">
                      {{ user.active ? 'Deactivate' : 'Activate' }}
                    </button>
                  </div>
                  
                  <p>Total Users: {{ users.length }} | Showing: {{ filteredUsers.length }}</p>
                </div>
              \`
            }).mount('#app');
          </script>
        </body>
        </html>
      `;
      
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(vueApp);
      
      return {
        hasVue: vueApp.includes('Vue'),
        hasReactivity: vueApp.includes('ref('),
        hasComputed: vueApp.includes('computed'),
        hasTemplate: vueApp.includes('template:'),
        contentLoaded: iframe.src.includes('Vue.js User Manager')
      };
    });
    
    expect(vueTest.hasVue).toBeTruthy();
    expect(vueTest.hasReactivity).toBeTruthy();
    expect(vueTest.contentLoaded).toBeTruthy();
  });

  test('should handle static site generator preview', async ({ page }) => {
    await setupPage(page);
    
    const staticSiteTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const staticSite = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>My Blog - Static Site</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Georgia', serif; 
              line-height: 1.6; 
              color: #333; 
              max-width: 800px; 
              margin: 0 auto; 
              background: #fafafa;
            }
            header { 
              background: #2c3e50; 
              color: white; 
              padding: 2rem 1rem; 
              text-align: center; 
            }
            nav { background: #34495e; padding: 1rem; }
            nav a { color: white; text-decoration: none; margin: 0 1rem; }
            nav a:hover { text-decoration: underline; }
            main { padding: 2rem 1rem; background: white; margin: 1rem; border-radius: 8px; }
            article { margin-bottom: 3rem; border-bottom: 1px solid #eee; padding-bottom: 2rem; }
            .meta { color: #666; font-size: 0.9em; margin-bottom: 1rem; }
            h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
            h2 { color: #2c3e50; margin: 1.5rem 0 1rem; }
            .excerpt { font-style: italic; margin: 1rem 0; }
            footer { text-align: center; padding: 2rem; background: #2c3e50; color: white; }
            .tags { margin: 1rem 0; }
            .tag { background: #3498db; color: white; padding: 0.3rem 0.6rem; border-radius: 3px; margin-right: 0.5rem; font-size: 0.8em; }
          </style>
        </head>
        <body>
          <header>
            <h1>📝 My Tech Blog</h1>
            <p>Thoughts on web development and technology</p>
          </header>
          
          <nav>
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#posts">Posts</a>
            <a href="#contact">Contact</a>
          </nav>
          
          <main>
            <article>
              <h2>Getting Started with CoVibe: Real-time Collaboration</h2>
              <div class="meta">Published on March 15, 2024 by Tech Writer</div>
              <p class="excerpt">
                CoVibe is revolutionizing how development teams collaborate in real-time. 
                Here's everything you need to know to get started.
              </p>
              <p>
                In today's fast-paced development environment, real-time collaboration tools 
                have become essential. CoVibe stands out by offering seamless integration 
                between team communication, AI agents, and live code previews.
              </p>
              <h3>Key Features:</h3>
              <ul>
                <li>🤖 AI-powered development agents</li>
                <li>👥 Real-time team collaboration</li>
                <li>🔄 Live code previews</li>
                <li>💬 Integrated team chat</li>
                <li>🚀 Instant deployment previews</li>
              </ul>
              <div class="tags">
                <span class="tag">covibes</span>
                <span class="tag">collaboration</span>
                <span class="tag">ai-agents</span>
                <span class="tag">web-development</span>
              </div>
            </article>
            
            <article>
              <h2>Building Responsive Web Applications in 2024</h2>
              <div class="meta">Published on March 10, 2024 by Tech Writer</div>
              <p class="excerpt">
                Modern web development requires a mobile-first approach. 
                Let's explore the latest techniques for building responsive applications.
              </p>
              <p>
                Responsive design is no longer optional—it's a necessity. With mobile traffic 
                continuing to dominate, developers must prioritize responsive design patterns.
              </p>
              <div class="tags">
                <span class="tag">responsive-design</span>
                <span class="tag">css</span>
                <span class="tag">mobile-first</span>
              </div>
            </article>
          </main>
          
          <footer>
            <p>&copy; 2024 My Tech Blog. Built with love and static site generators.</p>
            <p>Generated with CoVibe Preview System</p>
          </footer>
        </body>
        </html>
      `;
      
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(staticSite);
      
      return {
        hasSemanticHTML: staticSite.includes('<article>') && staticSite.includes('<header>'),
        hasResponsiveDesign: staticSite.includes('viewport') && staticSite.includes('max-width'),
        hasBlogStructure: staticSite.includes('blog') || staticSite.includes('article'),
        hasMetaTags: staticSite.includes('meta'),
        contentLoaded: iframe.src.includes('My Tech Blog')
      };
    });
    
    expect(staticSiteTest.hasSemanticHTML).toBeTruthy();
    expect(staticSiteTest.hasResponsiveDesign).toBeTruthy();
    expect(staticSiteTest.contentLoaded).toBeTruthy();
  });

  test('should handle data visualization dashboard preview', async ({ page }) => {
    await setupPage(page);
    
    const dashboardTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const dashboard = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Analytics Dashboard</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
              margin: 0; background: #f5f7fa; 
            }
            .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .metric { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
            .metric-value { font-size: 2rem; font-weight: bold; color: #2563eb; }
            .chart-container { position: relative; height: 300px; }
            h1 { text-align: center; color: #1f2937; margin-bottom: 30px; }
            .status { padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; color: white; }
            .status.online { background: #10b981; }
            .status.offline { background: #ef4444; }
          </style>
        </head>
        <body>
          <h1>📊 Real-time Analytics Dashboard</h1>
          
          <div class="dashboard">
            <div class="card">
              <h3>Key Metrics</h3>
              <div class="metric">
                <span>Total Users</span>
                <span class="metric-value" id="totalUsers">1,234</span>
              </div>
              <div class="metric">
                <span>Active Sessions</span>
                <span class="metric-value" id="activeSessions">89</span>
              </div>
              <div class="metric">
                <span>Revenue</span>
                <span class="metric-value" id="revenue">$45,678</span>
              </div>
              <div class="metric">
                <span>System Status</span>
                <span class="status online">Online</span>
              </div>
            </div>
            
            <div class="card">
              <h3>Traffic Chart</h3>
              <div class="chart-container">
                <canvas id="trafficChart"></canvas>
              </div>
            </div>
            
            <div class="card">
              <h3>User Growth</h3>
              <div class="chart-container">
                <canvas id="growthChart"></canvas>
              </div>
            </div>
            
            <div class="card">
              <h3>Recent Activity</h3>
              <div id="activityFeed">
                <div style="margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 4px;">
                  <strong>User123</strong> completed onboarding
                  <div style="font-size: 0.8em; color: #666;">2 minutes ago</div>
                </div>
                <div style="margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 4px;">
                  <strong>System</strong> backup completed
                  <div style="font-size: 0.8em; color: #666;">15 minutes ago</div>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            // Simulate real-time data updates
            function updateMetrics() {
              document.getElementById('totalUsers').textContent = Math.floor(Math.random() * 2000 + 1000);
              document.getElementById('activeSessions').textContent = Math.floor(Math.random() * 150 + 50);
              document.getElementById('revenue').textContent = '$' + (Math.random() * 100000 + 10000).toFixed(0);
            }
            
            // Create charts
            const trafficCtx = document.getElementById('trafficChart').getContext('2d');
            new Chart(trafficCtx, {
              type: 'line',
              data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                  label: 'Visitors',
                  data: [12, 19, 3, 5, 2, 3],
                  borderColor: '#3b82f6',
                  tension: 0.4
                }]
              },
              options: { responsive: true, maintainAspectRatio: false }
            });
            
            const growthCtx = document.getElementById('growthChart').getContext('2d');
            new Chart(growthCtx, {
              type: 'bar',
              data: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                datasets: [{
                  label: 'Growth %',
                  data: [25, 35, 45, 55],
                  backgroundColor: '#10b981'
                }]
              },
              options: { responsive: true, maintainAspectRatio: false }
            });
            
            // Update metrics every 3 seconds
            setInterval(updateMetrics, 3000);
          </script>
        </body>
        </html>
      `;
      
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(dashboard);
      
      return {
        hasChartJS: dashboard.includes('Chart.js'),
        hasRealTimeUpdates: dashboard.includes('setInterval'),
        hasDashboardLayout: dashboard.includes('grid-template-columns'),
        hasMetrics: dashboard.includes('metric-value'),
        contentLoaded: iframe.src.includes('Analytics Dashboard')
      };
    });
    
    expect(dashboardTest.hasChartJS).toBeTruthy();
    expect(dashboardTest.hasRealTimeUpdates).toBeTruthy();
    expect(dashboardTest.contentLoaded).toBeTruthy();
  });

  test('should handle progressive web app preview', async ({ page }) => {
    await setupPage(page);
    
    const pwaTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const pwa = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PWA Demo</title>
          <meta name="theme-color" content="#2196f3">
          <link rel="manifest" href="data:application/json,{
            \\"name\\": \\"CoVibe PWA Demo\\",
            \\"short_name\\": \\"PWA Demo\\",
            \\"start_url\\": \\"/\\",
            \\"display\\": \\"standalone\\",
            \\"theme_color\\": \\"#2196f3\\",
            \\"background_color\\": \\"#ffffff\\",
            \\"icons\\": []
          }">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background: linear-gradient(135deg, #2196f3, #21cbf3); 
              min-height: 100vh; color: white; 
            }
            .container { max-width: 400px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .card { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin: 15px 0; }
            .offline-indicator { 
              position: fixed; top: 0; left: 0; right: 0; 
              background: #ff5722; color: white; text-align: center; 
              padding: 10px; display: none; 
            }
            button { 
              width: 100%; padding: 15px; border: none; border-radius: 8px; 
              background: #fff; color: #2196f3; font-weight: bold; cursor: pointer; 
            }
            .sync-status { margin-top: 10px; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="offline-indicator" id="offlineIndicator">
            You're offline. Some features may not be available.
          </div>
          
          <div class="container">
            <div class="header">
              <h1>📱 PWA Demo</h1>
              <p>Progressive Web App built with CoVibe</p>
            </div>
            
            <div class="card">
              <h3>⚡ Features</h3>
              <ul>
                <li>✅ Offline functionality</li>
                <li>✅ Install to home screen</li>
                <li>✅ Push notifications</li>
                <li>✅ Background sync</li>
                <li>✅ Responsive design</li>
              </ul>
            </div>
            
            <div class="card">
              <h3>📝 Quick Note</h3>
              <textarea id="notepad" placeholder="Write something..." 
                style="width: 100%; height: 100px; border: none; border-radius: 4px; padding: 10px;">
              </textarea>
              <button onclick="saveNote()">💾 Save Note</button>
              <div class="sync-status" id="syncStatus">Ready to sync</div>
            </div>
            
            <div class="card">
              <h3>🔔 Notifications</h3>
              <button onclick="requestNotificationPermission()">Enable Notifications</button>
              <button onclick="showNotification()" style="margin-top: 10px;">Test Notification</button>
            </div>
            
            <div class="card">
              <h3>📊 App Info</h3>
              <p>Status: <span id="connectionStatus">Online</span></p>
              <p>Last Sync: <span id="lastSync">Never</span></p>
              <p>Storage Used: <span id="storageUsed">0 KB</span></p>
            </div>
          </div>
          
          <script>
            // Service Worker registration
            if ('serviceWorker' in navigator) {
              console.log('Service Worker support detected');
            }
            
            // Online/Offline detection
            function updateConnectionStatus() {
              const status = navigator.onLine ? 'Online' : 'Offline';
              document.getElementById('connectionStatus').textContent = status;
              document.getElementById('offlineIndicator').style.display = 
                navigator.onLine ? 'none' : 'block';
            }
            
            window.addEventListener('online', updateConnectionStatus);
            window.addEventListener('offline', updateConnectionStatus);
            
            // Local storage for notes
            function saveNote() {
              const note = document.getElementById('notepad').value;
              localStorage.setItem('pwa-note', note);
              document.getElementById('syncStatus').textContent = 'Saved locally';
              document.getElementById('lastSync').textContent = new Date().toLocaleTimeString();
            }
            
            // Load saved note
            window.addEventListener('load', () => {
              const savedNote = localStorage.getItem('pwa-note');
              if (savedNote) {
                document.getElementById('notepad').value = savedNote;
              }
              updateConnectionStatus();
              updateStorageUsage();
            });
            
            function updateStorageUsage() {
              const used = JSON.stringify(localStorage).length;
              document.getElementById('storageUsed').textContent = (used / 1024).toFixed(2) + ' KB';
            }
            
            // Notification API
            async function requestNotificationPermission() {
              if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                console.log('Notification permission:', permission);
              }
            }
            
            function showNotification() {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('PWA Demo', {
                  body: 'This is a test notification from your PWA!',
                  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
                });
              }
            }
            
            // Update storage usage when note changes
            document.getElementById('notepad').addEventListener('input', updateStorageUsage);
          </script>
        </body>
        </html>
      `;
      
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(pwa);
      
      return {
        hasManifest: pwa.includes('manifest'),
        hasServiceWorker: pwa.includes('serviceWorker'),
        hasOfflineDetection: pwa.includes('navigator.onLine'),
        hasLocalStorage: pwa.includes('localStorage'),
        hasNotifications: pwa.includes('Notification'),
        contentLoaded: iframe.src.includes('PWA Demo')
      };
    });
    
    expect(pwaTest.hasManifest).toBeTruthy();
    expect(pwaTest.hasServiceWorker).toBeTruthy();
    expect(pwaTest.hasOfflineDetection).toBeTruthy();
    expect(pwaTest.contentLoaded).toBeTruthy();
  });
});