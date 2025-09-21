# Covibes Deployment Guide

## Current Architecture (Self-Hosted EC2)
- Nginx reverse proxy handling SSL, WebSockets, and routing
- Node.js servers running with PM2
- PostgreSQL database
- Docker for preview containers

## Production Deployment Options

### 🎯 Option 1: Vercel + Railway/Render (Easiest)

**Frontend (Vercel):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd client
vercel --prod
```

**Backend (Railway/Render):**
```bash
# Railway
railway login
railway init
railway up

# Or Render - just connect GitHub repo
```

**Configuration:**
```javascript
// client/vite.config.js for production
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://api.covibes.com',
        changeOrigin: true
      }
    }
  }
})
```

**Pros:**
- Zero nginx configuration needed
- Automatic SSL, CDN, and scaling
- Preview deployments built-in
- WebSockets handled automatically

**Cons:**
- Less control over infrastructure
- Potential vendor lock-in

### 🚀 Option 2: AWS ECS/Fargate (Scalable)

**Infrastructure as Code:**
```yaml
# aws-ecs-task-definition.json
{
  "family": "covibes",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "covibes/frontend:latest",
      "portMappings": [{"containerPort": 3000}]
    },
    {
      "name": "backend",
      "image": "covibes/backend:latest",
      "portMappings": [{"containerPort": 3001}],
      "environment": [
        {"name": "DATABASE_URL", "value": "postgresql://..."}
      ]
    }
  ]
}
```

**Application Load Balancer replaces nginx:**
- Path-based routing (/api → backend, / → frontend)
- WebSocket support built-in
- Auto-scaling based on load

### 🐳 Option 3: Docker Swarm/Kubernetes (Self-Managed)

**docker-compose.production.yml:**
```yaml
version: '3.8'

services:
  traefik:  # Modern nginx replacement
    image: traefik:v2.10
    command:
      - --api.insecure=true
      - --providers.docker=true
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.le.acme.tlschallenge=true
      - --certificatesresolvers.le.acme.email=admin@covibes.com
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt
    labels:
      - "traefik.http.routers.api.rule=Host(`covibes.com`)"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.routers.api.tls.certresolver=le"

  frontend:
    image: covibes/frontend:${VERSION}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`covibes.com`) && PathPrefix(`/`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
    environment:
      - NODE_ENV=production
      - VITE_BACKEND_URL=https://covibes.com

  backend:
    image: covibes/backend:${VERSION}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`covibes.com`) && PathPrefix(`/api`)"
      - "traefik.http.services.backend.loadbalancer.server.port=3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}

  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

volumes:
  postgres_data:
```

### 🔄 Option 4: Hybrid Approach (Recommended)

**Static Frontend → CDN (Cloudflare Pages/Vercel):**
```bash
# Deploy frontend to Cloudflare Pages
cd client
npm run build
wrangler pages deploy dist/
```

**API Backend → Cloud Run/Fly.io:**
```dockerfile
# Dockerfile for backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

**Database → Managed Service:**
- Neon.tech (PostgreSQL)
- PlanetScale (MySQL)
- Supabase (PostgreSQL + Auth)

## Key Nginx Features Translation

| Nginx Feature | Cloud Equivalent |
|--------------|------------------|
| SSL/HTTPS | Automatic with Vercel/Cloudflare |
| WebSocket Proxy | ALB/CloudFront/Native support |
| Path Routing | Edge Functions/API Routes |
| Rate Limiting | Cloudflare/AWS WAF |
| Caching | CDN (CloudFront/Cloudflare) |
| Load Balancing | ALB/Cloud Load Balancer |

## Environment Variables Setup

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db.example.com/covibes
REDIS_URL=redis://redis.example.com:6379
JWT_SECRET=your-secret-key
GITHUB_CLIENT_ID=your-github-id
GITHUB_CLIENT_SECRET=your-github-secret
EC2_HOST=not-needed-in-cloud
VITE_BACKEND_URL=https://api.covibes.com
VITE_FRONTEND_URL=https://covibes.com
```

## Deployment Commands

### Quick Deploy to Vercel + Railway
```bash
# Frontend
cd client
vercel --prod

# Backend
cd ../server
railway up
```

### Docker Build & Push
```bash
# Build images
docker build -t covibes/frontend:latest ./client
docker build -t covibes/backend:latest ./server

# Push to registry
docker push covibes/frontend:latest
docker push covibes/backend:latest
```

### Kubernetes Deploy
```bash
kubectl apply -f k8s/
kubectl rollout status deployment/covibes
```

## Migration Path from Current Setup

1. **Database First:**
   - Backup PostgreSQL: `pg_dump covibes > backup.sql`
   - Migrate to managed service (Neon/Supabase)
   - Update DATABASE_URL

2. **Backend API:**
   - Remove nginx-specific code
   - Add CORS configuration
   - Deploy to Railway/Render
   - Test API endpoints

3. **Frontend:**
   - Update API URLs to production
   - Remove proxy configuration
   - Deploy to Vercel/Cloudflare
   - Verify WebSocket connections

4. **Preview System:**
   - Use platform preview deployments (Vercel/Netlify)
   - Or containerize with Cloud Run for custom previews

## Cost Comparison

| Platform | Monthly Cost (estimate) |
|----------|------------------------|
| Current EC2 | ~$50-100 |
| Vercel + Railway | ~$20-50 |
| AWS ECS | ~$100-200 |
| Kubernetes (GKE) | ~$150-300 |

## Recommended Architecture for Scale

```
Users → CloudFlare CDN →
  ├── Static Assets (S3/Cloudflare)
  ├── API (AWS Lambda/Cloud Run)
  ├── WebSockets (AWS API Gateway/Pusher)
  └── Database (Aurora Serverless/Neon)
```

## Summary

**For your use case, I recommend:**
1. **Vercel** for frontend (automatic HMR in dev, great DX)
2. **Railway/Render** for backend (easy PostgreSQL integration)
3. **Cloudflare** for DNS/CDN/DDoS protection
4. Keep nginx config in repo for reference/self-hosted option

This gives you modern deployment with minimal configuration while preserving the option to self-host using your nginx config if needed.