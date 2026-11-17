# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
# Use latest LTS Node on Alpine for minimal image size and attack surface
FROM node:22-alpine AS deps

# Set working directory
WORKDIR /app

# Copy package files (wildcard handles both package.json and optional package-lock.json)
COPY package*.json ./

# Install dependencies deterministically if lockfile exists, otherwise install fresh
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ─── Stage 2: Builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Build the production bundle (TypeScript check + Vite build)
RUN npm run build

# ─── Stage 3: Production (Nginx) ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom hardened nginx configuration with CSP and security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check: verify nginx is serving the health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# ─── Development stage ───────────────────────────────────────────────────────
FROM node:22-alpine AS development

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Source is mounted as a volume in docker-compose.override.yml
# This stage is used for hot-reload development with Vite HMR
EXPOSE 5173

CMD ["npm", "run", "dev"]
