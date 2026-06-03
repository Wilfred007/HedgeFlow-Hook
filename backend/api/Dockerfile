FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/
RUN npm install --workspaces
COPY shared ./shared
COPY api ./api
RUN npm run build --workspace=shared
RUN npm run build --workspace=api

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/package.json .
EXPOSE 3001
CMD ["node", "api/dist/index.js"]
