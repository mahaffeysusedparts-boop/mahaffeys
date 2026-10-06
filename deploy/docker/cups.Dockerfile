FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends cups cups-client cups-bsd \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -aG lp,lpadmin root
COPY deploy/docker/cupsd.conf /etc/cups/cupsd.conf
EXPOSE 631
CMD ["cupsd", "-f"]
