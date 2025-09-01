# ColabVibe Production Deployment Checklist

## 🚨 **This Prevents the Deployment Hell We Experienced**

Based on our earlier issues with manual configuration, IP address conflicts, missing environment variables, Docker conflicts, and JavaScript errors, this checklist ensures smooth deployments.

---

## ⚡ **Quick Start (Recommended)**

```bash
# 1. Set ALL environment variables (CRITICAL!)
export EC2_HOST=ec2-13-48-135-139.eu-north-1.compute.amazonaws.com
export BASE_HOST=ec2-13-48-135-139.eu-north-1.compute.amazonaws.com  
export EC2_USERNAME=ubuntu
export DATABASE_URL="postgresql://postgres:password@localhost:5433/colabvibe_prod"
export JWT_SECRET="prod_jwt_2024_colabvibe_secure_random_key_123456789"
export ENCRYPTION_KEY="abcdef1234567890abcdef1234567890"

# 2. Validate environment (catches issues BEFORE deployment)
chmod +x /home/ubuntu/covibes/scripts/validate-environment.sh
/home/ubuntu/covibes/scripts/validate-environment.sh

# 3. Deploy (if validation passes)
chmod +x /home/ubuntu/covibes/scripts/deploy-production.sh
/home/ubuntu/covibes/scripts/deploy-production.sh
```

**That's it!** The scripts handle everything automatically.

---

## 📋 **Manual Deployment Checklist (If Scripts Fail)**

### Pre-Deployment Validation ✅

- [ ] **Environment Variables Set**:
  - [ ] `EC2_HOST` = `ec2-13-48-135-139.eu-north-1.compute.amazonaws.com`
  - [ ] `BASE_HOST` = `ec2-13-48-135-139.eu-north-1.compute.amazonaws.com`
  - [ ] `EC2_USERNAME` = `ubuntu`
  - [ ] `DATABASE_URL` points to correct database
  - [ ] `JWT_SECRET` is set (32+ characters)
  - [ ] `ENCRYPTION_KEY` is exactly 32 characters

- [ ] **System Dependencies**:
  - [ ] Node.js 18+ installed
  - [ ] Docker running
  - [ ] PostgreSQL accessible
  - [ ] Ports 3001, 5432 available

- [ ] **IP Address Consistency**:
  - [ ] All hardcoded IPs match current EC2 instance
  - [ ] No references to old IP `ec2-13-60-242-174`
  - [ ] `BASE_HOST` matches `EC2_HOST`

### Deployment Steps 🚀

1. **Clean Previous Deployments**:
   ```bash
   pkill -f nodemon || true
   pkill -f "vite.*dev" || true
   pm2 delete all || true
   docker rm -f preview-demo-team-001 || true
   ```

2. **Build Applications**:
   ```bash
   cd /home/ubuntu/covibes/server && npm run build
   cd /home/ubuntu/covibes/client && npm run build
   ```

3. **Database Setup**:
   ```bash
   cd /home/ubuntu/covibes/server
   npm run prisma:migrate
   npm run prisma:seed
   ```

4. **Validate Dependencies**:
   ```bash
   cd /home/ubuntu/.covibes/workspaces/demo-team-001
   npm install three  # Ensure Three.js is available
   ```

5. **Start Production Server**:
   ```bash
   cd /home/ubuntu/covibes
   NODE_ENV=production PORT=3001 BASE_HOST=$BASE_HOST EC2_HOST=$EC2_HOST EC2_USERNAME=$EC2_USERNAME DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" node server/dist/src/server.js &
   ```

### Post-Deployment Validation ✅

- [ ] **Health Checks**:
  - [ ] Server responds: `curl http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/health`
  - [ ] Main site loads: `curl http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/`
  - [ ] Preview works: `curl http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main/`

- [ ] **Mobile Testing**:
  - [ ] Mobile users get redirected to preview
  - [ ] 3D Earth app shows mobile fallback (🌍 emoji)
  - [ ] No JavaScript errors in mobile browser

- [ ] **Authentication**:
  - [ ] Can login with `bob@demo.com`
  - [ ] JWT tokens working
  - [ ] Socket.io connections successful

---

## 🚨 **Common Issues & Quick Fixes**

| Issue | Quick Fix |
|-------|-----------|
| `BASE_HOST environment variable is required` | `export BASE_HOST=ec2-13-48-135-139.eu-north-1.compute.amazonaws.com` |
| `login EADDRINUSE: address already in use :::3001` | `lsof -ti:3001 \| xargs kill -9` |
| Docker container conflicts | `docker rm -f preview-demo-team-001` |
| Client build missing | `cd client && npm run build` |
| Database connection failed | Check PostgreSQL running: `docker-compose up -d postgres` |
| Vite compilation errors | Check syntax in workspace App.jsx |
| Mobile "unexpected error" | Use preview URL: `/api/preview/proxy/demo-team-001/main/` |

---

## 🎯 **What This Prevents**

✅ **No more IP address hell** - Automated validation  
✅ **No more missing env vars** - Pre-flight checks  
✅ **No more Docker conflicts** - Automatic cleanup  
✅ **No more syntax errors** - Build validation  
✅ **No more missing deps** - Dependency validation  
✅ **No more mobile issues** - Mobile-specific handling  
✅ **No more manual mistakes** - Automated deployment  

---

## 📱 **Mobile Users**

Mobile users should use the **direct preview URL**:
```
http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/demo-team-001/main/
```

This bypasses the complex workspace and shows the mobile-optimized 3D Earth app.

---

## 🔍 **Troubleshooting**

**If deployment fails**:
1. Run validation script: `/home/ubuntu/covibes/scripts/validate-environment.sh`
2. Fix all reported issues
3. Re-run deployment script

**If site has errors**:
1. Check logs: `tail -f /tmp/colabvibe-production.log`
2. Verify all environment variables are set
3. Test each component individually

**Emergency restart**:
```bash
pkill -f server.js
/home/ubuntu/covibes/scripts/deploy-production.sh
```

---

*This checklist prevents the 2+ hours of debugging we experienced earlier. One script, zero hassle.* 🎉