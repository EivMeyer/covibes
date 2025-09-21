# Nginx Configuration for Covibes

This directory contains the nginx configuration files for the Covibes platform.

## Files

- `covibes-https` - Current production configuration (copied from `/etc/nginx/sites-enabled/`)
- `covibes-https-clean` - Cleaned up version without duplicate routes

## Key Features

### 1. Hot Module Reload (HMR) Support
- **Critical route**: `/hmr` location block must be placed BEFORE general location blocks
- WebSocket routing for Vite HMR: `wss://domain/hmr`
- Proper proxy headers for container communication

### 2. iframe Embedding Support
```nginx
# Allow iframe embedding for preview
add_header X-Frame-Options "";
proxy_hide_header X-Frame-Options;
```

### 3. Preview System
- Routes for `/preview/demo-team-001/` path
- API proxy stripping base path
- WebSocket support for development features

### 4. SSL/HTTPS Configuration
- Self-signed certificates in `/etc/nginx/ssl/`
- HTTP to HTTPS redirect
- Modern TLS protocols (1.2, 1.3)

## Deployment

To apply the clean configuration:

```bash
# Backup current config
sudo cp /etc/nginx/sites-enabled/covibes-https /etc/nginx/sites-enabled/covibes-https.backup

# Copy clean version
sudo cp /home/ubuntu/covibes/nginx/covibes-https-clean /etc/nginx/sites-enabled/covibes-https

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Critical Notes

1. **Location Priority**: `/hmr` route MUST be before general `/` location block
2. **WebSocket Headers**: `Upgrade` and `Connection` headers are essential for HMR
3. **iframe Support**: X-Frame-Options override is required for preview embedding
4. **Container Routing**: Port 8000 for preview containers, port 3001 for main app

## Troubleshooting

- **HMR not working**: Check WebSocket connection to `/hmr` endpoint
- **iframe blocked**: Verify X-Frame-Options headers are properly overridden
- **API calls failing**: Check preview path stripping for `/preview/demo-team-001/api/` routes