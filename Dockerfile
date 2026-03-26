FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY worker/package.json worker/

# Install all dependencies
RUN npm ci --workspaces --include-workspace-root

# Copy source
COPY src/ src/
COPY worker/src/ worker/src/
COPY tsconfig.json ./
COPY worker/tsconfig.json worker/

# Build TypeScript
RUN npx tsc -p worker/tsconfig.json

# Run the worker
CMD ["node", "dist/worker/src/index.js"]
