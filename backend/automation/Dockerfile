FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY shared/package.json ./shared/
COPY automation/package.json ./automation/
RUN npm install --workspaces
COPY shared ./shared
COPY automation ./automation
RUN npm run build --workspace=shared
RUN npm run build --workspace=automation

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/automation/dist ./automation/dist
COPY --from=builder /app/package.json .
CMD ["node", "automation/dist/index.js"]
