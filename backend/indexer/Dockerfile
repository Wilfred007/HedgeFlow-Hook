FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY shared/package.json ./shared/
COPY indexer/package.json ./indexer/
RUN npm install --workspaces
COPY shared ./shared
COPY indexer ./indexer
RUN npm run build --workspace=shared
RUN npm run build --workspace=indexer

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/indexer/dist ./indexer/dist
COPY --from=builder /app/package.json .
CMD ["node", "indexer/dist/index.js"]
