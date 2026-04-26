.PHONY: help dev dev-web dev-engine build push migrate seed lint test deploy logs ps down clean

SHELL := /bin/bash
COMPOSE := docker compose -f deploy/docker-compose.yml --env-file .env

help: ## show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

dev: ## boot full stack via compose (web + engine + postgres)
	$(COMPOSE) -f deploy/docker-compose.dev.yml up --build

dev-web: ## next.js dev server only
	cd reel-web && pnpm dev

dev-engine: ## FastAPI dev server only
	cd reel-engine && uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

build: ## build all images locally
	$(COMPOSE) build

migrate: ## run drizzle migrations
	cd reel-web && pnpm drizzle:migrate

scan: ## scan Radarr + Plex once
	curl -fsS -X POST http://localhost:8002/api/library/scan

lint: ## lint web + engine
	cd reel-web && pnpm lint
	cd reel-engine && ruff check app && mypy app

test: ## run tests (web + engine)
	cd reel-web && pnpm test
	cd reel-engine && pytest -q

deploy: ## push images + trigger Watchtower on iMac
	git push origin main

ps: ## list running containers
	$(COMPOSE) ps

logs: ## tail compose logs
	$(COMPOSE) logs -f --tail 200

down: ## stop the stack
	$(COMPOSE) down

clean: ## stop + remove volumes (careful)
	$(COMPOSE) down -v
