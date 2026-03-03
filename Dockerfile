# Stage 1: build frontend
FROM node:20-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# Stage 2: build backend + runtime
FROM node:20-bookworm-slim AS server
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
COPY server/prisma ./server/prisma
RUN cd server && npm ci && npx prisma generate
COPY server/tsconfig.json ./server/
COPY server/src ./server/src/
RUN cd server && npm run build

# Stage 3: run
FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=server /app/server/package.json /app/server/package-lock.json ./server/
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=server /app/server/dist ./server/dist
COPY --from=server /app/server/prisma ./server/prisma
COPY --from=frontend /app/dist ./dist
COPY scripts/entrypoint.sh ./scripts/
RUN chmod +x scripts/entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
CMD ["./scripts/entrypoint.sh"]
