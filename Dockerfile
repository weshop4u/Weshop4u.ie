# WeShop4U - Production Backend Deployment
# This Dockerfile is used by Render to build and deploy the backend
# Working directory is explicitly set to /app to avoid any path confusion

FROM node:25-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy entire project
COPY . .

# Build the backend
RUN pnpm run build

# Expose port 3000 (default Express port)
EXPOSE 3000

# Start the server
# NODE_ENV is set by Render automatically for production
CMD ["node", "dist/index.js"]
