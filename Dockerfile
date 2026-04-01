# WeShop4U - Production Backend Deployment
# This Dockerfile is used by Render to build and deploy the backend
# Working directory is explicitly set to /app to avoid any path confusion

FROM node:25-alpine

# Accept build arguments for environment variables
ARG EXPO_PUBLIC_API_BASE_URL=https://weshop4uie-production.up.railway.app
ARG DATABASE_URL

# Set working directory
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy entire project
COPY . .

# Set environment variables for build
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}
ENV DATABASE_URL=${DATABASE_URL}

# Build the backend
RUN pnpm run build

# Expose port 3000 (default Express port)
EXPOSE 3000

# Start the server
# NODE_ENV is set by Render automatically for production
CMD ["node", "dist/index.js"]
