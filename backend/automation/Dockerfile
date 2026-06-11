FROM node:22-alpine AS builder
WORKDIR /app

# Copy root package.json
COPY package.json ./

# Copy workspace package.json files
COPY shared/package.json ./shared/
COPY automation/package.json ./automation/

# Install dependencies for all workspaces
RUN npm install --workspaces

# Copy source code
COPY shared ./shared
COPY automation ./automation

# Build workspaces
RUN npm run build --workspace=shared
RUN npm run build --workspace=automation

# Production stage
FROM node:22-alpine
WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/automation/dist ./automation/dist
COPY --from=builder /app/package.json .

ENV NODE_ENV=production

CMD ["node", "automation/dist/index.js"]
