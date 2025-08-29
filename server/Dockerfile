# Multi-stage Docker build for ColabVibe Server
# Development and Production stages

# --- Development Stage ---
FROM node:20-alpine AS development

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    libc6-compat \
    bash \
    curl

# Create wait-for-it script for database readiness
RUN curl -o /usr/local/bin/wait-for-it.sh https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh && \
    chmod +x /usr/local/bin/wait-for-it.sh

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma/ ./prisma/

# Install all dependencies (including dev dependencies)
RUN npm ci --include=dev

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S colabvibe -u 1001

# Change ownership of app directory
RUN chown -R colabvibe:nodejs /app

# Switch to non-root user
USER colabvibe

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Development command - wait for database then start
CMD ["sh", "-c", "wait-for-it.sh postgres:5432 --timeout=60 --strict -- npm run dev"]

# --- Production Build Stage ---
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine AS production

# Install only runtime dependencies
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    curl \
    dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S colabvibe -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=colabvibe:nodejs /app/dist ./dist
COPY --from=builder --chown=colabvibe:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=colabvibe:nodejs /app/prisma ./prisma
COPY --from=builder --chown=colabvibe:nodejs /app/package*.json ./

# Switch to non-root user
USER colabvibe

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Production command with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]