FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        wget \
        ca-certificates \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

EXPOSE 8002

CMD ["sh", "-c", "if [ \"$RELOAD\" = 'true' ]; then exec uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload --log-level ${LOG_LEVEL:-info}; else exec uvicorn app.main:app --host 0.0.0.0 --port 8002 --workers 4 --log-level ${LOG_LEVEL:-info}; fi"]
