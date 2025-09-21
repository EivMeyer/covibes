# Nginx Configuration for HMR and iframe Support

## Critical nginx changes made to `/etc/nginx/sites-enabled/covibes-https`:

### 1. HMR WebSocket Route (CRITICAL for HMR)
```nginx
# Vite HMR WebSocket on /hmr path
location /hmr {
    proxy_pass http://127.0.0.1:8000/hmr;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host localhost:5173;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_buffering off;
}
```

### 2. iframe Support for Preview (CRITICAL for iframe embedding)
```nginx
# Allow iframe embedding for preview
add_header X-Frame-Options "";
proxy_hide_header X-Frame-Options;
```

Added to the `/preview/demo-team-001/` location block.

### 3. Location Priority
The `/hmr` route MUST be placed BEFORE the general `location /` block to avoid conflicts.

## Why These Changes Are Critical:
1. **HMR WebSocket Route**: Without this, WebSocket requests go to port 3001 (main server) instead of 8000 (container), causing page reloads instead of true HMR.
2. **iframe Support**: Without this, preview pages can't be embedded in iframes due to X-Frame-Options: SAMEORIGIN.
3. **Route Order**: nginx location matching priority requires specific ordering.

## Template Changes Made:
- ✅ Updated `/templates/fullstack-react-postgres/vite.config.js` with working HMR configuration
- ✅ Fixed allowedHosts, HMR path, and WebSocket settings

## Manual Steps for New Deployments:
If deploying to a new server, ensure these nginx routes are added to the HTTPS configuration.

## Version Control Integration ✅
- ✅ Nginx configuration now version controlled in `/nginx/` directory
- ✅ Clean configuration available: `nginx/covibes-https-clean`
- ✅ Deployment instructions in `nginx/README.md`
- ✅ Backup of working configuration: `nginx/covibes-https`

### Deployment from Version Control:
```bash
# Deploy clean nginx config
sudo cp /home/ubuntu/covibes/nginx/covibes-https-clean /etc/nginx/sites-enabled/covibes-https
sudo nginx -t && sudo systemctl reload nginx
```