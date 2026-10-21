FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 TF_CPP_MIN_LOG_LEVEL=2 HOME=/home/app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 1000 --create-home --home-dir /home/app app
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN pip install opentelemetry-distro opentelemetry-exporter-otlp \
 && opentelemetry-bootstrap -a install
COPY --chown=app:app . .
USER app
EXPOSE 8002
CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]