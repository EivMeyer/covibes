# CoVibe Agent and Team Management Routes

This document describes the agent and team management API routes implemented in the CoVibe server.

## Overview

The server includes comprehensive agent and team management functionality with:
- JWT-based authentication for all protected routes
- Prisma database integration for data persistence
- SSH service integration for remote agent execution
- Real-time WebSocket updates for collaborative features

## Authentication

All routes except `/api/auth/*` require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

## Agent Management Routes (`/api/agents`)

### POST `/api/agents/spawn`
Spawns a new AI agent with specified type and task.

**Request Body:**
```json
{
  "type": "general" | "code-writer",
  "task": "string (5-1000 characters)",
  "repositoryUrl": "string (optional, must be valid URL)"
}
```

**Response:**
```json
{
  "message": "Agent spawned successfully",
  "agent": {
    "id": "string",
    "type": "string",
    "task": "string", 
    "repositoryUrl": "string|null",
    "status": "spawning",
    "createdAt": "ISO date",
    "userName": "string"
  }
}
```

**Features:**
- Validates agent type and task parameters
- Creates agent record in database
- Initiates SSH connection to assigned VM
- Executes Claude commands asynchronously
- Streams real-time output to database

### GET `/api/agents/list`
Lists user's agents with optional filtering.

**Query Parameters:**
- `status` - Filter by agent status
- `type` - Filter by agent type  
- `limit` - Limit results (default 50, max 100)

**Response:**
```json
{
  "agents": [
    {
      "id": "string",
      "type": "string",
      "task": "string",
      "repositoryUrl": "string|null", 
      "status": "string",
      "output": "string",
      "createdAt": "ISO date",
      "updatedAt": "ISO date",
      "userName": "string"
    }
  ]
}
```

### POST `/api/agents/:id/stop`
Stops a running agent.

**Response:**
```json
{
  "message": "Agent stopped successfully",
  "agent": {
    "id": "string",
    "status": "stopped",
    "updatedAt": "ISO date"
  }
}
```

**Features:**
- Verifies agent ownership
- Terminates SSH process if connected
- Updates database status
- Prevents stopping already stopped agents

### GET `/api/agents/:id`
Gets detailed information about a specific agent.

**Response:**
```json
{
  "agent": {
    "id": "string",
    "type": "string", 
    "task": "string",
    "repositoryUrl": "string|null",
    "status": "string",
    "output": "string",
    "createdAt": "ISO date",
    "updatedAt": "ISO date", 
    "userName": "string",
    "isOwner": "boolean"
  }
}
```

**Features:**
- Team members can view each other's agents
- Shows full agent output and metadata
- Indicates if current user is the agent owner

## Team Management Routes (`/api/team`)

### GET `/api/team/info`
Gets team information and member list.

**Response:**
```json
{
  "team": {
    "id": "string",
    "name": "string",
    "teamCode": "string",
    "createdAt": "ISO date",
    "memberCount": "number",
    "members": [
      {
        "id": "string",
        "userName": "string", 
        "email": "string",
        "vmId": "string|null",
        "joinedAt": "ISO date",
        "isCurrentUser": "boolean",
        "hasVmAssigned": "boolean"
      }
    ]
  }
}
```

### GET `/api/team/agents`
Gets all agents created by team members.

**Query Parameters:**
- `status` - Filter by agent status
- `type` - Filter by agent type
- `userId` - Filter by specific user
- `limit` - Limit results (default 50, max 100)

**Response:**
```json
{
  "agents": [
    {
      "id": "string",
      "type": "string",
      "task": "string",
      "repositoryUrl": "string|null",
      "status": "string", 
      "output": "string (truncated to 500 chars)",
      "createdAt": "ISO date",
      "updatedAt": "ISO date",
      "userName": "string",
      "isOwner": "boolean"
    }
  ]
}
```

### GET `/api/team/stats`
Gets team statistics and activity metrics.

**Response:**
```json
{
  "stats": {
    "totalMembers": "number",
    "membersWithVms": "number", 
    "totalAgents": "number",
    "activeAgents": "number",
    "completedAgents": "number",
    "stoppedAgents": "number",
    "errorAgents": "number",
    "recentActivity": "number (last 7 days)"
  }
}
```

### GET `/api/team/members`
Gets detailed team member information with agent statistics.

**Response:**
```json
{
  "members": [
    {
      "id": "string",
      "userName": "string",
      "email": "string", 
      "vmId": "string|null",
      "joinedAt": "ISO date",
      "isCurrentUser": "boolean",
      "hasVmAssigned": "boolean",
      "agentStats": {
        "total": "number",
        "active": "number", 
        "completed": "number"
      }
    }
  ]
}
```

## VM Management Routes (`/api/vm`)

### GET `/api/vm/status`
Gets user's assigned VM status.

### POST `/api/vm/assign` 
Assigns an available VM to the user.

### POST `/api/vm/release`
Releases user's VM assignment.

### GET `/api/vm/available`
Gets list of all VMs and their assignment status.

## SSH Service Integration

The server includes a comprehensive SSH service (`services/ssh.ts`) that:

- Manages persistent SSH connections to EC2 instances
- Executes Claude agent commands remotely
- Streams real-time output back to the database
- Handles connection errors and timeouts
- Supports repository cloning for code-writer agents
- Integrates with the VM assignment system

## Database Schema

The routes work with these Prisma models:
- `User` - User accounts with team membership and VM assignments
- `Team` - Team information with unique join codes
- `Agent` - Agent instances with status, output, and execution metadata

## Error Handling

All routes include comprehensive error handling for:
- Authentication failures (401/403)
- Validation errors (400) 
- Authorization failures (404 for owned resources)
- Server errors (500)
- SSH connection failures
- Database operation failures

## Real-time Features

The server supports WebSocket connections for:
- Live agent output streaming
- Team member presence updates
- Agent status notifications
- Chat messaging between team members

## Security Features

- JWT token validation with expiration
- Rate limiting on API endpoints
- Team-based access control
- SQL injection protection via Prisma
- Input validation using Zod schemas
- Secure SSH key handling