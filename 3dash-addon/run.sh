#!/usr/bin/with-contenv bashio

CERT_DIR="/ssl/self-signed"
CERT="$CERT_DIR/cert.pem"
KEY="$CERT_DIR/key.pem"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CERT" \
    -subj "/CN=3dash.local" \
    -addext "subjectAltName=DNS:3dash.local,DNS:localhost,IP:127.0.0.1" \
    2>/dev/null
  bashio::log.info "Generated self-signed SSL certificate"
else
  bashio::log.info "Using existing SSL certificate"
fi

exec nginx -g "daemon off;"
