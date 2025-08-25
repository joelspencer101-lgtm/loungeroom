# Coffee Table - Local NGINX Reverse Proxies

Two options are provided:

1) TLS Dev Proxy (recommended for full app testing)
- HTTPS: https://localhost:8443
- HTTP redirect: http://localhost:8080 -> HTTPS
- /api and wss://.../api/hb/ws/room proxied to backend http://localhost:8001
- / proxied to frontend http://localhost:3000

Run:
- make up-dev-proxy
- make logs-dev-proxy
- make down-dev-proxy

2) Minimal WS Proxy (HTTP only, simple WebSocket focus)
- HTTP: http://localhost:8081
- /api and ws://.../api/hb/ws/room -> backend http://localhost:8001
- / -> frontend http://localhost:3000

Run:
- make up-ws-proxy
- make logs-ws-proxy
- make down-ws-proxy

Notes
- Ensure Docker Desktop file sharing includes this folder.
- For React frontend to call backend via the proxy:
  - TLS dev proxy: set REACT_APP_BACKEND_URL=https://localhost:8443
  - Minimal WS proxy: set REACT_APP_BACKEND_URL=http://localhost:8081
- WebSocket indicator appears in the session view (top-right) to confirm WS vs Poll.