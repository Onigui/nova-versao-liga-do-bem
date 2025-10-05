# Use Node.js 18 Alpine
FROM node:18-alpine

# Install OpenSSL and other dependencies for Prisma
RUN apk add --no-cache openssl openssl-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client and install remaining dependencies
RUN npm run prisma:generate

# Remove dev dependencies to reduce image size (keep TypeScript for runtime)
RUN npm prune --production --ignore-scripts

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npx", "ts-node", "src/server.ts"]
