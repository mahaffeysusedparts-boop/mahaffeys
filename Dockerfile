FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV NITRO_DATABASE_PATH=/data/scrapflow.db
WORKDIR /app
COPY --from=build /app/.output ./.output
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", ".output/server/index.mjs"]
