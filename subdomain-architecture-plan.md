# Subdomain Preview Architecture Implementation Plan

## Phase 1: Infrastructure Setup

### 1.1 DNS Configuration (CRITICAL FIRST)
```bash
# Domain: covibes.com (example - use your actual domain)
# Required DNS Records:
*.covibes.com    A     13.48.135.139  # Wildcard subdomain
covibes.com      A     13.48.135.139  # Root domain  
www.covibes.com  CNAME covibes.com    # WWW redirect
```

**Why Wildcard**: Any subdomain (demo-team-001.covibes.com, team-xyz.covibes.com) automatically resolves to the EC2 server.

### 1.2 SSL Certificate (Let's Encrypt Wildcard)
```bash
# Install certbot if not already installed
sudo apt install certbot python3-certbot-nginx

# Generate wildcard certificate (requires DNS verification)
sudo certbot certonly --manual --preferred-challenges=dns \
  -d "*.covibes.com" -d "covibes.com"

# Certificate files will be at:
# /etc/letsencrypt/live/covibes.com/fullchain.pem
# /etc/letsencrypt/live/covibes.com/privkey.pem
```

### 1.3 Base Nginx Configuration
```nginx
# /etc/nginx/sites-available/main-site
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name covibes.com www.covibes.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name covibes.com www.covibes.com;
    
    ssl_certificate /etc/letsencrypt/live/covibes.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/covibes.com/privkey.pem;
    
    # Main application (Express on port 3001)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Phase 2: Dynamic Subdomain System

### 2.1 Database Schema Update
```sql
-- Add subdomain field to preview_deployments
ALTER TABLE preview_deployments ADD COLUMN subdomain VARCHAR(255) UNIQUE;
ALTER TABLE preview_deployments ADD COLUMN nginx_config_path VARCHAR(500);

-- Example record:
-- teamId: 'demo-team-001'
-- subdomain: 'demo-team-001.covibes.com'  
-- port: 8000
-- nginx_config_path: '/etc/nginx/sites-enabled/demo-team-001.conf'
```

### 2.2 Nginx Config Template
```nginx
# Template: /etc/nginx/templates/team-preview.conf.template
server {
    listen 80;
    server_name {{SUBDOMAIN}};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name {{SUBDOMAIN}};
    
    ssl_certificate /etc/letsencrypt/live/covibes.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/covibes.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy to container
    location / {
        proxy_pass http://localhost:{{CONTAINER_PORT}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS for dev tools
        add_header Access-Control-Allow-Origin *;
    }
}
```

### 2.3 Nginx Management Service
```typescript
// nginx-manager.ts
class NginxManager {
  
  async createTeamConfig(teamId: string, containerPort: number): Promise<string> {
    const subdomain = `${teamId}.covibes.com`;
    const configPath = `/etc/nginx/sites-enabled/${teamId}.conf`;
    
    // Read template
    const template = await fs.readFile('/etc/nginx/templates/team-preview.conf.template', 'utf8');
    
    // Replace placeholders
    const config = template
      .replace(/{{SUBDOMAIN}}/g, subdomain)
      .replace(/{{CONTAINER_PORT}}/g, containerPort.toString());
    
    // Write config
    await fs.writeFile(configPath, config);
    
    // Test nginx config
    const { stdout } = await execAsync('sudo nginx -t');
    if (!stdout.includes('syntax is ok')) {
      throw new Error('Nginx config test failed');
    }
    
    // Reload nginx
    await execAsync('sudo systemctl reload nginx');
    
    console.log(`✅ Created nginx config for ${subdomain} -> localhost:${containerPort}`);
    return subdomain;
  }
  
  async removeTeamConfig(teamId: string): Promise<void> {
    const configPath = `/etc/nginx/sites-enabled/${teamId}.conf`;
    
    try {
      await fs.unlink(configPath);
      await execAsync('sudo systemctl reload nginx');
      console.log(`✅ Removed nginx config for ${teamId}`);
    } catch (error) {
      console.log(`⚠️ Config removal failed (may not exist): ${error.message}`);
    }
  }
}
```

## Phase 3: Service Integration

### 3.1 Updated Universal Preview Service
```typescript
// Modify universal-preview-service.ts
class UniversalPreviewService {
  private nginxManager = new NginxManager();
  
  async startPreview(teamId: string): Promise<{subdomain: string, port: number}> {
    // 1. Start container (existing logic)
    const port = await this.allocatePort();
    const containerId = await this.startContainer(teamId, port);
    
    // 2. Create nginx config
    const subdomain = await this.nginxManager.createTeamConfig(teamId, port);
    
    // 3. Save to database
    await this.prisma.preview_deployments.upsert({
      where: { teamId },
      create: {
        id: randomUUID(),
        teamId,
        containerId,
        containerName: `preview-${teamId}`,
        port,
        subdomain,  // NEW FIELD
        nginx_config_path: `/etc/nginx/sites-enabled/${teamId}.conf`,
        status: 'running',
        projectType: 'vite-react',
      },
      update: {
        subdomain,
        port,
        status: 'running',
        updatedAt: new Date()
      }
    });
    
    return { subdomain, port };
  }
  
  async stopPreview(teamId: string): Promise<void> {
    // 1. Remove nginx config
    await this.nginxManager.removeTeamConfig(teamId);
    
    // 2. Stop container (existing logic)
    await this.stopContainer(teamId);
    
    // 3. Clean database
    await this.prisma.preview_deployments.deleteMany({
      where: { teamId }
    });
  }
}
```

### 3.2 API Response Updates
```typescript
// preview routes return subdomain URLs
{
  "message": "Preview created successfully",
  "subdomain": "demo-team-001.covibes.com",
  "url": "https://demo-team-001.covibes.com/",
  "port": 8000,
  "mode": "subdomain"
}
```

## Phase 4: Development Testing

### 4.1 Local Development (Without DNS)
```bash
# Add to /etc/hosts for local testing
127.0.0.1 demo-team-001.covibes.com
127.0.0.1 test-team-002.covibes.com

# Or use .local domains
127.0.0.1 demo-team-001.covibes.local
```

### 4.2 Production Deployment Checklist
- [ ] Domain configured with wildcard DNS
- [ ] SSL certificate generated and installed  
- [ ] Nginx base configuration deployed
- [ ] Template files in place
- [ ] Service permissions for nginx reload
- [ ] Database schema updated
- [ ] Services redeployed with new code

## Phase 5: Migration Strategy

### 5.1 Backward Compatibility
Keep existing Express proxy routes working during transition:
```typescript
// Redirect old URLs to new subdomains
router.get('/api/preview/proxy/:teamId/:branch/*', async (req, res) => {
  const { teamId } = req.params;
  const subdomain = `${teamId}.covibes.com`;
  const newUrl = `https://${subdomain}/`;
  
  return res.redirect(301, newUrl);
});
```

### 5.2 Gradual Rollout
1. Deploy subdomain system alongside existing system
2. Test with specific teams first
3. Update frontend to use subdomain URLs
4. Remove old Express proxy routes

## Benefits Achieved

✅ **No Path Conflicts**: Each team has clean root URL
✅ **No MIME Issues**: Direct container access, no proxy path rewriting  
✅ **Better Performance**: Nginx direct proxy, no Express overhead
✅ **Scalable**: Unlimited teams, automatic subdomain creation
✅ **Industry Standard**: Same approach as Vercel, Netlify, etc.
✅ **Clean URLs**: https://demo-team-001.covibes.com/ vs /api/preview/proxy/demo-team-001/main/