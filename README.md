# CoVibe

*Embrace exponentials*

[![CI](https://github.com/YOUR_USERNAME/colabvibe/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/colabvibe/actions/workflows/ci.yml)

> Embrace Exponentials - Collaborative AI Development Platform

CoVibe is a revolutionary web-based platform where developers spawn AI agents to work on code collaboratively in real-time. Multiple team members can see and interact with agents as they write code, run tests, and build features together.

## ⚡ Quick Demo

The fastest way to see CoVibe in action:

```bash
./demo.sh
```

This starts the entire system with one command! Open the displayed URL in 3 browser tabs to test multi-user collaboration.

## 🚀 Features

- **Real-time Collaboration**: Multiple developers working together seamlessly
- **AI Agent Integration**: Spawn Claude agents on individual VMs  
- **Docker Live Preview**: Interactive previews of applications in isolated containers
- **Live Code Streaming**: Watch agents code in real-time across your team
- **Team Chat**: Built-in communication while developing
- **VM Management**: Individual development environments for each user
- **Secure Execution**: Isolated agent workspaces with proper security
- **Multi-Branch Support**: Separate previews for main and staging branches
- **Auto-Detection**: Automatically configures React, Vue, Python, Ruby projects

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+ (or use Docker)
- **Redis** 7+ (or use Docker)
- **Docker** & Docker Compose (recommended for local development)

## 🛠️ Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd colabvibe

# Start services
docker-compose up -d

# Install dependencies
cd server
npm install

# Run migrations
npx prisma migrate dev

# Start the application
npm run dev
```

### Option 2: Local Setup

```bash
# Install and start PostgreSQL
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Install and start Redis
sudo apt-get install redis-server
sudo systemctl start redis

# Clone and setup
git clone <your-repo-url>
cd colabvibe/server
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx prisma migrate dev

# Start application
npm run dev
```

## 🌐 Usage

1. **Create a Team**: Visit http://localhost:3001 and create your team
2. **Invite Members**: Share the invite code with team members
3. **Configure VM**: Set up your development VM (or use mock agents for testing)
4. **Spawn Agents**: Click "Spawn Agent" to create your AI coding assistant
5. **Collaborate**: Watch in real-time as agents work and chat with your team

## 🧪 Testing

### Run All Tests
```bash
# Unit tests
cd server && npm test

# E2E tests (requires running server)
node tests/e2e-test.js

# SSH connection tests
node server/test/ssh-test.js localhost
```

### Manual Testing
```bash
# Start demo with 3 browser tabs
./demo.sh

# Test with mock agents (no VM required)
# Set useMockAgent: true when spawning agents
```

## 📁 Project Structure

```
colabvibe/
├── server/                 # Backend Node.js application
│   ├── server.js          # Main server entry point
│   ├── routes/            # API endpoints
│   │   ├── auth.js        # Authentication routes
│   │   ├── agents.js      # Agent management
│   │   └── chat.js        # Team chat functionality
│   ├── services/          # Business logic
│   │   ├── agent-manager.js    # Agent lifecycle management
│   │   ├── ssh-service.js      # VM SSH connections
│   │   └── mock-agent.js       # Development mock agents
│   ├── middleware/        # Express middleware
│   │   ├── auth.js        # JWT authentication
│   │   └── error.js       # Error handling
│   ├── prisma/           # Database schema and migrations
│   │   └── schema.prisma  # Prisma data model
│   ├── public/           # Frontend static files
│   │   ├── index.html    # Single page application
│   │   ├── js/           # JavaScript modules
│   │   │   ├── app.js    # Main application logic
│   │   │   ├── api.js    # API communication layer
│   │   │   └── socket.js # WebSocket handling
│   │   └── css/          # Stylesheets
│   └── test/             # Server-side tests
├── tests/                # Integration and E2E tests
│   └── e2e-test.js      # End-to-end test suite
├── scripts/              # Deployment and utility scripts
│   ├── setup-vm.sh       # VM environment setup
│   └── init-db.sql       # Database initialization
├── config/               # Configuration files
│   └── redis.conf        # Redis configuration
├── docker-compose.yml    # Local development services
├── demo.sh              # Quick demo launcher
└── README.md            # This file
```

## 🔧 Configuration

### Environment Variables

Create `.env` file in the `server/` directory:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/colabvibe_dev
JWT_SECRET=your-secret-key-here
ENCRYPTION_KEY=32-character-encryption-key
REDIS_URL=redis://localhost:6379
PREVIEW_URL=http://localhost:3000
```

### Agent Configuration

Configure VM access for agents:
```javascript
// In the UI or via API
{
  "host": "your-vm-ip-address",
  "username": "developer", 
  "port": 22,
  "privateKey": "path-to-your-ssh-key"
}
```

## 🛡️ Security

- **SSH Key Encryption**: All SSH keys are encrypted before storage
- **JWT Authentication**: Secure user sessions
- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: API endpoints are rate limited
- **VM Isolation**: Each user's agents run in isolated environments

## 🚀 Deployment

### Production Deployment

Production deployment scripts are currently under development. For now, use Docker for local development and testing.

```bash
# Setup user VMs
./scripts/setup-vm.sh full
```

### Docker Production

```bash
# Use production configuration
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

## 📊 Monitoring

### Application Monitoring
```bash
# View application logs
docker-compose logs -f colabvibe

# Monitor system resources
htop

# Database monitoring
docker-compose --profile admin up pgadmin
# Access at http://localhost:8080
```

### Health Checks
- Application: `GET /health`
- Database: `docker-compose exec postgres pg_isready`
- Redis: `docker-compose exec redis redis-cli ping`

## 🐛 Troubleshooting

### Common Issues

**Application won't start**
```bash
# Check logs
tail -f colabvibe.log

# Verify database connection
docker-compose exec postgres psql -U postgres -d colabvibe_dev
```

**WebSocket connection fails**
```bash
# Check if port 3001 is open
netstat -tuln | grep 3001

# Test WebSocket endpoint
wscat -c ws://localhost:3001
```

**Agent spawning fails**
```bash
# Test SSH connection
node server/test/ssh-test.js your-vm-host

# Use mock agents for testing
# Set useMockAgent: true in spawn request
```

**Database migration errors**
```bash
# Reset database (development only)
npx prisma migrate reset

# Push schema without migration
npx prisma db push
```

## 🤝 Development Workflow

### For Contributors

1. **Backend Development** (Agent 1 tasks):
   - Set up database schema with Prisma
   - Create authentication and WebSocket APIs
   - Implement agent management system

2. **Frontend Development** (Agent 2 tasks):
   - Create responsive web UI
   - Implement real-time features with WebSocket
   - Build team collaboration interface

3. **Integration & Testing** (Agent 3 tasks):
   - Set up testing infrastructure
   - Create deployment scripts
   - Ensure everything works together

### Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature
# ... make changes ...
git commit -m "feat: add awesome feature"
git push origin feature/your-feature

# Create pull request
gh pr create --title "Add awesome feature" --body "Description of changes"
```

## 🧪 Testing Strategy

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API endpoints and database interactions
- **E2E Tests**: Test complete user workflows
- **SSH Tests**: Verify VM connectivity and agent execution
- **Load Tests**: Ensure system handles multiple users

## 📈 Performance

### Optimization Tips

- **Agent Output Buffering**: Buffer output to reduce WebSocket message frequency
- **Connection Pooling**: Reuse SSH connections when possible
- **Database Indexing**: Optimize queries with proper indexes
- **Caching**: Use Redis for session data and temporary storage

### Scaling

- **Horizontal Scaling**: Run multiple server instances behind load balancer
- **Database Scaling**: Use read replicas for better performance
- **Agent Distribution**: Distribute agents across multiple VMs

## 🔮 Future Roadmap

See [FUTURE_WORK.md](FUTURE_WORK.md) for upcoming features and improvements.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Claude Code for rapid development
- Powered by Claude AI for intelligent agent capabilities
- Uses modern web technologies for real-time collaboration

---

**Ready to collaborate with AI?** Start your CoVibe journey today! 🚀