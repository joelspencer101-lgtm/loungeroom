# Coffee Table Dev Proxy Makefile
# One-liners to run the local NGINX reverse proxies

SHELL := /bin/bash
DOCKER_DIR := docker
COMPOSE_DEV := $(DOCKER_DIR)/docker-compose.yml
COMPOSE_WS  := $(DOCKER_DIR)/docker-compose.ws.yml

.PHONY: help up-dev-proxy down-dev-proxy logs-dev-proxy restart-dev-proxy certs-dev-proxy \
        up-ws-proxy down-ws-proxy logs-ws-proxy restart-ws-proxy

help:
	@echo "Available targets:"
	@echo "  make up-dev-proxy      # generate TLS certs (mkcert/openssl) and start NGINX on 8080/8443"
	@echo "  make down-dev-proxy    # stop TLS proxy"
	@echo "  make logs-dev-proxy    # tail TLS proxy logs"
	@echo "  make restart-dev-proxy # restart TLS proxy"
	@echo "  make certs-dev-proxy   # (re)generate self-signed localhost certs"
	@echo "  make up-ws-proxy       # start minimal HTTP proxy for WS/API on port 8081"
	@echo "  make down-ws-proxy     # stop minimal WS proxy"
	@echo "  make logs-ws-proxy     # tail minimal WS proxy logs"
	@echo "  make restart-ws-proxy  # restart minimal WS proxy"

up-dev-proxy:
	bash ./scripts/dev_nginx_tls_setup.sh

down-dev-proxy:
	docker compose -f $(COMPOSE_DEV) down || true

logs-dev-proxy:
	docker compose -f $(COMPOSE_DEV) logs -f || true

restart-dev-proxy: down-dev-proxy up-dev-proxy

certs-dev-proxy:
	bash ./scripts/dev_nginx_tls_setup.sh || true

up-ws-proxy:
	docker compose -f $(COMPOSE_WS) up -d

down-ws-proxy:
	docker compose -f $(COMPOSE_WS) down || true

logs-ws-proxy:
	docker compose -f $(COMPOSE_WS) logs -f || true

restart-ws-proxy: down-ws-proxy up-ws-proxy