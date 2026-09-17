# Production Dockerfile for Voice AI Patient Registration System
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for SQLite
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/patients.db

# Create non-root user and persistent data folder
RUN mkdir -p /app/data && chown -R node:node /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

USER node

EXPOSE 3000

# Mount persistent volume for SQLite database
VOLUME ["/app/data"]

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
