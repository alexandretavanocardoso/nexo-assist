# Imagem para deploy (Fly.io, Railway, Render...). O SQLite fica num volume em /data.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/nexo.db
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/next.config.ts ./
EXPOSE 3000
CMD ["npx", "next", "start"]
