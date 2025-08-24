# Coffee Table - Local NGINX Reverse Proxy (TLS)

This Dockerized NGINX proxies your local dev services with TLS:
- https://localhost:8443 → frontend http://localhost:3000
- https://localhost:8443/api and wss://localhost:8443/api/hb/ws/room → backend http://localhost:8001

Quick start
1. Ensure your local services are running:
   - Backend: http://localhost:8001
   - Frontend: http://localhost:3000
2. Generate certs and start NGINX:
   - bash ./scripts/dev_nginx_tls_setup.sh
3. Open https://localhost:8443
4. In your React app, set REACT_APP_BACKEND_URL to https://localhost:8443 (e.g. in frontend/.env.local) and restart the dev server.

Notes
- On macOS, add this folder to Docker Desktop → Settings → Resources → File Sharing.
- The WebSocket route is explicitly configured at /api/hb/ws/room with Upgrade/Connection headers.
- Ports: 8080 (optional HTTP redirect), 8443 (HTTPS).