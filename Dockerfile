# js-doc-store-server Dockerfile
# For local development with Docker

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose the application port
EXPOSE 3000

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=development
ENV PORT=3000
ENV DATA_DIR=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/public/tables || exit 1

# Start the server
CMD ["node", "server.js"]
