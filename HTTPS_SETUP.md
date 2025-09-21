# HTTPS Configuration for Covibes

## Overview
The Covibes application is configured to run exclusively over HTTPS using a self-signed SSL certificate. All HTTP traffic is automatically redirected to HTTPS.

## SSL Certificate Details
- **Location**: `/etc/nginx/ssl/`
- **Certificate**: `/etc/nginx/ssl/covibes.crt`
- **Private Key**: `/etc/nginx/ssl/covibes.key`
- **Validity**: 365 days from generation
- **Common Name**: `ec2-13-48-135-139.eu-north-1.compute.amazonaws.com`

## Nginx Configuration
- **Config File**: `/etc/nginx/sites-available/covibes-https`
- **Features**:
  - HTTPS on port 443 with TLS 1.2/1.3
  - HTTP to HTTPS redirect on port 80
  - WebSocket support for Socket.io and HMR
  - Proxy configuration for backend, frontend, and preview containers

## Application Configuration

### URLs
All services are accessible via HTTPS without port numbers:
- **Frontend**: https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com
- **Backend API**: https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/api
- **Socket.io**: wss://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/socket.io
- **Preview**: https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/preview/demo-team-001/

### Environment Variables
- Server `.env`: All URLs updated to use `https://`
- Client `.env`: Simplified to use HTTPS URLs without ports

### WebSocket Configuration
- Socket.io client uses relative paths to inherit HTTPS from the page
- Automatic protocol detection (wss:// when page loads over https://)
- Preview container HMR configured for `wss://` on port 443

## Browser Security Warning
Since we're using a self-signed certificate, browsers will show a security warning. Users need to:
1. Click "Advanced" or "Show Details"
2. Click "Proceed to site" or "Accept the risk and continue"

## GitHub OAuth
The OAuth callback URL must be updated on GitHub.com to:
```
https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/api/auth/github/callback
```

## Maintenance Commands

### Regenerate Certificate (when expired)
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/covibes.key \
  -out /etc/nginx/ssl/covibes.crt \
  -subj "/CN=ec2-13-48-135-139.eu-north-1.compute.amazonaws.com"
sudo nginx -s reload
```

### Check Certificate Expiry
```bash
sudo openssl x509 -in /etc/nginx/ssl/covibes.crt -noout -dates
```

### Test HTTPS Connection
```bash
curl -k https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/health
```

## Upgrading to Let's Encrypt (Future)
To get a trusted certificate without browser warnings:
1. Point a domain name to this server
2. Install certbot: `sudo apt install certbot python3-certbot-nginx`
3. Generate certificate: `sudo certbot --nginx -d yourdomain.com`
4. Update nginx configuration to use Let's Encrypt certificates
5. Set up auto-renewal: `sudo systemctl enable certbot.timer`

## Troubleshooting

### Mixed Content Errors
- Ensure all resources are loaded over HTTPS
- Check that Socket.io client uses relative paths
- Verify environment variables don't contain HTTP URLs

### WebSocket Connection Issues
- Check nginx proxy configuration for WebSocket headers
- Verify Socket.io client uses relative path (not absolute URL with port)
- Ensure browser accepts the self-signed certificate

### Certificate Issues
- Check certificate validity: `sudo openssl x509 -in /etc/nginx/ssl/covibes.crt -noout -text`
- Verify nginx configuration: `sudo nginx -t`
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`