# WeShop4U - PostgreSQL Production Build
# Railway will use this Dockerfile instead of auto-detection
# This ensures a clean build with the latest PostgreSQL code

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Force rebuild with timestamp
ARG BUILD_TIMESTAMP=unknown
RUN echo "Build timestamp: $BUILD_TIMESTAMP"

# Build the project - force no cache
RUN --mount=type=cache,target=/app/node_modules/.cache \
    pnpm run build

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
