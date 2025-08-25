#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DOCKER_DIR="$ROOT_DIR/docker"
CERT_DIR="$DOCKER_DIR/nginx/certs"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"

mkdir -p "$CERT_DIR"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

echo "[+] Generating self-signed cert for localhost (valid 365 days)"
if have_cmd mkcert; then
  echo "[+] Using mkcert (recommended)"
  mkcert -install || true
  mkcert -key-file "$CERT_DIR/localhost.key" -cert-file "$CERT_DIR/localhost.crt" localhost 127.0.0.1 ::1
else
  echo "[!] mkcert not found, falling back to openssl"
  OPENSSL_CNF="$CERT_DIR/san.cnf"
  cat > "$OPENSSL_CNF" << 'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1  = 127.0.0.1
EOF
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERT_DIR/localhost.key" \
    -out "$CERT_DIR/localhost.crt" \
    -days 365 \
    -config "$OPENSSL_CNF"
fi

echo "[+] Starting NGINX reverse proxy (ports 8080/8443)"
# Ensure Docker Desktop can read the mounted directories on macOS
if [ "${OSTYPE:-}" = "darwin" ]; then
  echo "[i] On macOS, ensure Docker Desktop File Sharing includes: $DOCKER_DIR"
fi

docker compose -f "$COMPOSE_FILE" up -d

echo "[✓] NGINX is starting. Visit: https://localhost:8443 (HTTP redirects to HTTPS)"
echo "[i] If your browser warns about the cert, trust $CERT_DIR/localhost.crt in Keychain Access (Always Trust)."