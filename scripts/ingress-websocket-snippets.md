# Kubernetes Ingress WebSocket Snippets

Important: All backend API routes must be prefixed with /api. The FastAPI server binds to 0.0.0.0:8001. Do not change URLs or ports in .env files.

Below are ready-to-apply examples for common Ingress controllers. Pick the one that matches your cluster. If you are not sure which controller you have, check your cluster add-ons or ask your DevOps contact. Apply these in your existing Ingress resource (not creating a new service).

NGINX Ingress (kubernetes/ingress-nginx)
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: coffee-table
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/websocket-services: "backend-service-name"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  rules:
    - host: your-hostname.example.com
      http:
        paths:
          - path: /api/hb/ws/room(/|$)(.*)
            pathType: Prefix
            backend:
              service:
                name: backend-service-name
                port:
                  number: 8001
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service-name
                port:
                  number: 8001

Traefik IngressRoute (CRD)
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: coffee-table
spec:
  entryPoints:
    - web
    - websecure
  routes:
    - match: PathPrefix(`/api/hb/ws/room`)
      kind: Rule
      services:
        - name: backend-service-name
          port: 8001
      middlewares: []
    - match: PathPrefix(`/api`)
      kind: Rule
      services:
        - name: backend-service-name
          port: 8001

HAProxy Ingress (optional)
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: coffee-table
  annotations:
    haproxy.org/server-timeout: "600s"
    haproxy.org/timeout-tunnel: "3600s"
spec:
  rules:
    - host: your-hostname.example.com
      http:
        paths:
          - path: /api/hb/ws/room
            pathType: Prefix
            backend:
              service:
                name: backend-service-name
                port:
                  number: 8001
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service-name
                port:
                  number: 8001

Notes
- Keep HTTP polling fallback enabled in the app for resilience.
- If you use a single Ingress object already, merge the above path blocks into it and adjust backend-service-name and host.
- After applying, verify by attempting a WebSocket connection to wss://&lt;host&gt;/api/hb/ws/room/TEST from the browser console or using the app.