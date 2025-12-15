FROM python:3.12.12-slim-bookworm as base

ENV PYTHONPATH=/app
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY server/requirements/ /app/requirements/

RUN pip install --no-cache-dir -r requirements/requirements_core.txt

FROM base as backend

RUN pip install --no-cache-dir -r requirements/requirements_backend.txt

COPY server/core/ /app/core
COPY server/backend/ /app/backend

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base as worker_model_image

RUN pip install --no-cache-dir -r requirements/requirements_model.txt

COPY server/core/ /app/core
COPY server/workers/worker_1 /app/worker

WORKDIR /app/worker

CMD ["celery", "-A", "model_service", "worker", "-P", "solo", "--loglevel=info"]

FROM base as worker_postprocess_image

RUN pip install --no-cache-dir -r requirements/requirements_postprocess.txt

COPY server/core/ /app/core
COPY server/workers/worker_2 /app/worker

WORKDIR /app/worker

CMD ["celery", "-A", "postprocessing_worker", "worker", "--loglevel=info"]

FROM node:20-alpine as frontend_image

WORKDIR /app

COPY frontend/package*.json ./

RUN npm install

COPY frontend/ .

CMD ["npm", "run", "dev"]