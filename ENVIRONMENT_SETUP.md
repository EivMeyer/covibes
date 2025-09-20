# Covibes Environment Configuration

This document describes the environment configuration setup for Covibes, including development and production configurations.

## 🎯 Overview

Covibes now supports proper environment-specific configuration for both development and production deployments. The environment system includes:

- ✅ **Separate environment files** for development and production
- ✅ **Environment-specific npm scripts**
- ✅ **Proper CORS configuration** for EC2 domains
- ✅ **WebSocket URL configuration**
- ✅ **Automated deployment scripts**

## 📁 Environment Files Structure

```
covibes/
├── client/
│   ├── .env                    # Default (development) config
│   ├── .env.development       # Development-specific config
│   ├── .env.production        # Production-specific config
│   └── .env.example           # Template file
├── server/
│   ├── .env                   # Default (development) config
│   ├── .env.development       # Development-specific config
│   ├── .env.production        # Production-specific config
│   └── .env.example           # Template file
└── package.json               # Root scripts for both environments
```

## 🔧 Client Environment Variables

### Development Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API URL |
| `VITE_BACKEND_URL` | `http://localhost:3001` | Backend server URL |
| `VITE_FRONTEND_URL` | `http://localhost:3000` | Frontend URL for CORS |
| `VITE_WS_URL` | `http://localhost:3001` | WebSocket server URL |
| `VITE_BASE_PATH` | `/` | Base path for routing |
| `VITE_NODE_ENV` | `development` | Environment flag |

### Production Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001` | Production API URL |
| `VITE_BACKEND_URL` | `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001` | Production backend URL |
| `VITE_FRONTEND_URL` | `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000` | Production frontend URL |
| `VITE_WS_URL` | `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001` | Production WebSocket URL |
| `VITE_BASE_PATH` | `/` | Base path for routing |
| `VITE_NODE_ENV` | `production` | Environment flag |

## 🗄️ Server Environment Variables

### Development Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `development` | Node.js environment |
| `PORT` | `3001` | Server port |
| `BASE_HOST` | `localhost` | Base hostname |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3001,...` | CORS origins |
| `USE_MOCK_AGENTS` | `true` | Enable mock agents for development |

### Production Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `3001` | Server port |
| `BASE_HOST` | `ec2-13-48-135-139.eu-north-1.compute.amazonaws.com` | Production hostname |
| `ALLOWED_ORIGINS` | `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000,...` | Production CORS origins |
| `USE_MOCK_AGENTS` | `false` | Disable mock agents in production |

## 📜 Available Scripts

### Root Level Scripts

```bash
# Install all dependencies
npm run install:all

# Build for specific environments
npm run build:development
npm run build:production

# Start development servers (both frontend and backend)
npm run dev:development
npm run dev:production

# Start production servers
npm run start:development
npm run start:production

# Run tests and linting
npm run test
npm run lint
npm run type-check
```

### Client Scripts

```bash
cd client

# Development
npm run dev:development
npm run build:development
npm run preview:development

# Production
npm run dev:production
npm run build:production
npm run preview:production
```

### Server Scripts

```bash
cd server

# Development
npm run dev:development
npm run build:development
npm run start:development

# Production
npm run dev:production
npm run build:production
npm run start:production
```

## 🚀 Deployment Scripts

### Quick Deployment

```bash
# Deploy for development
./deploy.sh development

# Deploy for production
./deploy.sh production
```

### Manual Startup Scripts

```bash
# Start development environment
./start-dev.sh

# Start production environment
./start-prod.sh
```

## 🔒 CORS Configuration

The backend server automatically configures CORS based on the `BASE_HOST` environment variable:

**Development CORS Origins:**
- `http://localhost:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:3001`

**Production CORS Origins:**
- `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000`
- `http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001`

## 🌐 WebSocket Configuration

WebSocket connections are now properly configured with environment-specific URLs:

- **Development**: `ws://localhost:3001`
- **Production**: `ws://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001`

## 🔍 Environment Detection

The applications automatically detect the environment using:

1. **Vite Mode**: `--mode development` or `--mode production`
2. **Node.js Environment**: `NODE_ENV` variable
3. **Environment Files**: `.env.development` or `.env.production`

## 🛠️ Development Workflow

### 1. Clone and Setup

```bash
git clone <repository>
cd covibes
npm run install:all
```

### 2. Environment Configuration

```bash
# Copy and customize environment files if needed
cp client/.env.example client/.env.development
cp server/.env.example server/.env.development

# Edit with your specific settings
```

### 3. Start Development

```bash
# Option 1: Use convenience script
./start-dev.sh

# Option 2: Start manually
npm run dev:development

# Option 3: Start individually
cd server && npm run dev:development &
cd client && npm run dev:development &
```

## 🏭 Production Deployment

### 1. Configure Environment

```bash
# Ensure production environment files are configured
vim client/.env.production
vim server/.env.production
```

### 2. Deploy

```bash
# Option 1: Use deployment script
./deploy.sh production

# Option 2: Manual deployment
npm run build:production
./start-prod.sh
```

### 3. Verify

- Frontend: http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000
- Backend API: http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/health
- WebSocket: Should connect automatically via frontend

## 🐛 Troubleshooting

### Environment Variables Not Loading

1. **Check file naming**: Ensure `.env.development` and `.env.production` exist
2. **Check Vite mode**: Use `--mode development` or `--mode production`
3. **Check variable prefix**: Client variables must start with `VITE_`
4. **Restart servers**: Environment changes require server restart

### CORS Issues

1. **Check BASE_HOST**: Ensure it matches your domain
2. **Check ALLOWED_ORIGINS**: Verify all origins are listed
3. **Check protocol**: Ensure HTTP/HTTPS consistency

### WebSocket Connection Issues

1. **Check VITE_WS_URL**: Ensure it points to correct backend
2. **Check server logs**: Look for WebSocket connection errors
3. **Check network**: Verify ports are accessible

### Build Issues

1. **Clean builds**: Delete `dist/` directories and rebuild
2. **Check TypeScript**: Run `npm run type-check`
3. **Check dependencies**: Run `npm install` in both client and server

## 📝 Notes

- **Environment files**: `.env` files are not committed to git (in .gitignore)
- **Development default**: The main `.env` files default to development settings
- **Production override**: Production deployment copies `.env.production` to `.env`
- **Hot reload**: Development servers auto-restart when `.env` files change
- **Build optimization**: Production builds are optimized and minified
- **Static serving**: Production backend serves frontend static files

## 🔄 Migration from Previous Setup

If migrating from the previous configuration:

1. **Backup**: Save your current `.env` files
2. **Update**: Use new environment-specific files
3. **Scripts**: Update npm scripts to use environment-specific versions
4. **Test**: Verify both development and production configurations work
5. **Deploy**: Use new deployment scripts for consistent environment setup

This environment configuration ensures consistent, reliable deployments across different environments while maintaining proper separation of concerns and security practices.