# CoVibe Server

Express.js TypeScript server for the CoVibe collaborative development platform.

## Features

- **Express Server**: RESTful API with JSON parsing and CORS support
- **WebSocket Support**: Real-time collaboration with Socket.io
- **Database Integration**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based authentication system
- **Agent Management**: Spawn and manage AI agents
- **Team Collaboration**: Multi-user team support
- **VM Management**: Virtual machine assignment system
- **TypeScript**: Fully typed codebase with strict type checking

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**
   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   Or use the convenience script:
   ```bash
   ./start.sh
   ```

The server will start on port 3001 by default.

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Create new user and team
- `POST /login` - Login existing user  
- `POST /join` - Join existing team with code

### Agents (`/api/agents`) [Auth required]
- `POST /spawn` - Spawn new AI agent
- `GET /list` - List user's agents
- `GET /:id` - Get agent details
- `POST /:id/stop` - Stop running agent

### Team (`/api/team`) [Auth required]
- `GET /info` - Get team information and members
- `GET /agents` - Get all team agents
- `GET /stats` - Get team statistics

### VM (`/api/vm`) [Auth required] 
- `GET /status` - Get user's VM assignment status
- `POST /assign` - Assign VM to user
- `POST /release` - Release user's VM
- `GET /available` - List available VMs

## WebSocket Events

### Client → Server
- `join-team` - Join team room with JWT token
- `chat-message` - Send chat message to team
- `spawn-agent` - Spawn new agent via WebSocket
- `stop-agent` - Stop running agent

### Server → Client
- `team-joined` - Team join confirmation with data
- `chat-message` - Broadcast chat message
- `agent-spawned` - New agent created notification
- `agent-status` - Agent status updates
- `agent-output` - Agent execution output
- `user-connected/disconnected` - Team member connection status

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run lint` - Type check with TypeScript
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database with demo data
- `npm run prisma:studio` - Open Prisma Studio

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `PORT` - Server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `FRONTEND_URL` - Frontend URL for CORS

## Database Schema

The application uses PostgreSQL with the following main models:
- `Team` - Team information and join codes
- `User` - User accounts linked to teams
- `Agent` - AI agent instances and their status

See `prisma/schema.prisma` for complete schema.

## Development

The server is built with TypeScript and uses ES modules. Key development features:

- Hot reload with `nodemon` and `tsx`
- Strict TypeScript configuration
- Prisma for database management
- Socket.io for real-time features
- Express rate limiting
- Comprehensive error handling

## Production Deployment

1. Build the application: `npm run build`
2. Set production environment variables
3. Run database migrations: `npm run prisma:migrate`
4. Start the server: `npm start`

The built JavaScript files will be in the `dist/` directory.