# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────────────────
# Medical AI Assistant System — single-image build
#   nginx :3000  -> static frontend
#   Go gateway :8080 (public API)
#   uvicorn 127.0.0.1:8000 diagnosis | :8001 imaging | :8002 drug | :8003 chatbot
# All processes are supervised by supervisord. Each Python service gets its OWN
# virtualenv so TensorFlow, XGBoost and PyTorch never fight over numpy/protobuf.
# Build context = repo root (the folder containing gateway/, services/, frontend/).
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build the Go gateway ─────────────────────────────────────────────
FROM golang:1.23-bookworm AS gateway-build
WORKDIR /src
COPY gateway/ ./
RUN go mod download \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gateway .

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    HF_HOME=/data/hf \
    NLTK_DATA=/opt/nltk_data

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx-light supervisor libgomp1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# ---- per-service virtualenvs (requirements first => cached unless they change) ----
WORKDIR /app/services

COPY services/disease-diagnosis/requirements.txt /tmp/req-diagnosis.txt
RUN python -m venv /opt/venvs/diagnosis \
 && /opt/venvs/diagnosis/bin/pip install -r /tmp/req-diagnosis.txt \
 && /opt/venvs/diagnosis/bin/pip install xgboost   # the v3 pickle imports xgboost at load time

COPY services/medical-imaging/requirements.txt /tmp/req-imaging.txt
RUN python -m venv /opt/venvs/imaging \
 && /opt/venvs/imaging/bin/pip install -r /tmp/req-imaging.txt

COPY services/drug-recommendation/requirements.txt /tmp/req-drug.txt
RUN python -m venv /opt/venvs/drug \
 && /opt/venvs/drug/bin/pip install -r /tmp/req-drug.txt

# Chatbot: CPU-only torch first (saves ~2 GB vs the default CUDA wheel), then the rest.
COPY services/medical-chatbot/requirements.txt /tmp/req-chatbot.txt
RUN python -m venv /opt/venvs/chatbot \
 && /opt/venvs/chatbot/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && /opt/venvs/chatbot/bin/pip install -r /tmp/req-chatbot.txt \
 && /opt/venvs/chatbot/bin/pip install sentencepiece   # FLAN-T5 tokenizer (generation mode)
RUN /opt/venvs/chatbot/bin/python -c "import nltk; nltk.download('stopwords', download_dir='/opt/nltk_data')"

# ---- application code + model artifacts ----
COPY services/ /app/services/
COPY frontend/ /app/frontend/
COPY --from=gateway-build /out/gateway /app/gateway/gateway
COPY docker/supervisord.conf /etc/supervisor/conf.d/medical-ai.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Service wiring (127.0.0.1, not "localhost", to avoid IPv6 ::1 lookups)
ENV PORT=8080 \
    DIAGNOSIS_SERVICE_URL=http://127.0.0.1:8000 \
    IMAGING_SERVICE_URL=http://127.0.0.1:8001 \
    DRUG_SERVICE_URL=http://127.0.0.1:8002 \
    CHATBOT_SERVICE_URL=http://127.0.0.1:8003 \
    ALLOWED_ORIGINS=* \
    CHATBOT_ENABLE_RERANKING=false \
    CHATBOT_ENABLE_GENERATION=false

RUN mkdir -p /data/hf
VOLUME ["/data/hf"]
EXPOSE 3000 8080

# TCP check on the gateway (no assumptions about a /health route). Generous start period:
# TensorFlow + the chatbot preload take a while on first boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=240s --retries=5 \
  CMD python -c "import socket; socket.create_connection(('127.0.0.1', 8080), 3).close()"

CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
