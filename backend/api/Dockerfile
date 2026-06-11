FROM node:22-alpine AS builder
WORKDIR /app

# Copy root package.json
COPY package.json ./

# Copy workspace package.json files
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install dependencies for all workspaces
RUN npm install --workspaces

# Copy source code
COPY shared ./shared
COPY api ./api

# Build workspaces
RUN npm run build --workspace=shared
RUN npm run build --workspace=api

# Production stage
FROM node:22-alpine
WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/package.json .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "api/dist/index.js"]
