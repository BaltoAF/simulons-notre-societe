# Simulons notre société : le site compilé et son API, prêts pour un serveur (voir docs/DEPLOIEMENT.md).

# 1. Le site web (React) est compilé une fois, puis seul le résultat est gardé.
FROM node:24-slim AS site
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2. L'API (FastAPI + OpenFisca-France).
FROM python:3.11-slim
# un seul processus de calcul : environ 700 Mo de mémoire (4 processus en local : près de 2 Go) ;
# le moteur et le modèle sont mis à jour chaque nuit sur GitHub, le serveur ne fait que publier et vérifier les liens
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 SOCIETE_WORKERS=1 SOCIETE_MAJ_ARGS=--sans-moteur TZ=Europe/Paris
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY . .
COPY --from=site /app/frontend/dist frontend/dist
RUN useradd --create-home --uid 1000 site && mkdir -p backend/data && chown -R site /app/backend/data /app/model
USER site
EXPOSE 8000
HEALTHCHECK --interval=60s --timeout=10s --start-period=180s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/sante', timeout=8)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
