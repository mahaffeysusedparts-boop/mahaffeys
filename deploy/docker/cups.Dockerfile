FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends cups cups-client cups-bsd \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -aG lp,lpadmin root \
    && groupadd --gid 1000 node \
    && useradd --uid 1000 --gid 1000 --groups lpadmin --no-create-home --shell /usr/sbin/nologin node
COPY deploy/docker/cupsd.conf /etc/cups/cupsd.conf
COPY deploy/docker/cups-entrypoint.sh /usr/local/bin/cups-entrypoint.sh
COPY deploy/docker/cups-auth-check.sh /tmp/cups-auth-check.sh
RUN chmod 0755 /usr/local/bin/cups-entrypoint.sh /tmp/cups-auth-check.sh \
    && /tmp/cups-auth-check.sh image-build \
    && rm /tmp/cups-auth-check.sh
EXPOSE 631
ENTRYPOINT ["/usr/local/bin/cups-entrypoint.sh"]
