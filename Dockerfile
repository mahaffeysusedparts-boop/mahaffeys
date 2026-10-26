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
WORKDIR /app
COPY --from=build /app/.output ./.output
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        cups \
        cups-bsd \
        cups-client \
        chromium \
        ffmpeg \
    && ffmpeg -version > /dev/null \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R node:node /app \
    && test "$(id -u node)" = 1000 \
    && test "$(id -g node)" = 1000
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
