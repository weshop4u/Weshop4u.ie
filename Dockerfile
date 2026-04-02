# WeShop4U - Production Backend Deployment
# Multi-stage build to handle environment variables properly

FROM node:18-alpine AS builder

WORKDIR /app

# Copy all source files
COPY . .

# Install all dependencies (including dev dependencies for build)
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Set production environment variables to prevent expo export issues
ENV NODE_ENV=production
ENV EXPO_PUBLIC_API_BASE_URL=""

# Build the application
# Skip web build if web-dist already exists, otherwise build it
RUN if [ ! -d web-dist ]; then pnpm build:web; fi && pnpm build:server

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# Copy built dist folder from builder (includes web-dist inside it)
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the server
CMD ["node", "dist/index.js"]
