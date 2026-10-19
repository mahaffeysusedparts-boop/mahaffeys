FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends cups cups-client cups-bsd \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -aG lp,lpadmin root
COPY deploy/docker/cupsd.conf /etc/cups/cupsd.conf
COPY deploy/docker/cups-entrypoint.sh /usr/local/bin/cups-entrypoint.sh
RUN chmod 0755 /usr/local/bin/cups-entrypoint.sh
EXPOSE 631
ENTRYPOINT ["/usr/local/bin/cups-entrypoint.sh"]
