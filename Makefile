.PHONY: dev backend frontend install

# Lance le backend avec hot-reload limité au dossier app (exclut .venv, node_modules, etc.)
backend:
	cd backend && uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000

# Lance le frontend Next.js
frontend:
	cd frontend && npm run dev

# Installation des dépendances
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
