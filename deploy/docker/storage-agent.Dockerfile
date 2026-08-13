FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /agent

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends mdadm util-linux \
  && rm -rf /var/lib/apt/lists/*

COPY deploy/docker/storage-agent.mjs ./storage-agent.mjs
COPY deploy/docker/storage-agent-entrypoint.sh /usr/local/bin/storage-agent-entrypoint
RUN chmod 0755 /usr/local/bin/storage-agent-entrypoint

EXPOSE 3010
CMD ["storage-agent-entrypoint"]
