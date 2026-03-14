ARG APP_NAME=poker-gambetta

# Stage 1: build frontend (paramétrable par APP_NAME)
# Optionnel : VITE_BETTING_APP_URL (pour poker) et VITE_POKER_APP_URL (pour betting) en prod
FROM node:20-bookworm-slim AS frontend
WORKDIR /app
ARG APP_NAME
ARG VITE_BETTING_APP_URL
ARG VITE_POKER_APP_URL
ENV VITE_BETTING_APP_URL=$VITE_BETTING_APP_URL
ENV VITE_POKER_APP_URL=$VITE_POKER_APP_URL
COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/package-lock.json ./
RUN npm ci
COPY apps/${APP_NAME}/index.html ./index.html
COPY apps/${APP_NAME}/vite.config.ts ./vite.config.ts
COPY apps/${APP_NAME}/tsconfig.json ./tsconfig.json
COPY apps/${APP_NAME}/tsconfig.app.json ./tsconfig.app.json
COPY apps/${APP_NAME}/tsconfig.node.json ./tsconfig.node.json
COPY apps/${APP_NAME}/src ./src
COPY apps/shared ./shared
COPY apps/${APP_NAME}/public ./public
ENV DOCKER_BUILD=1
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
