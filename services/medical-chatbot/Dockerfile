FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 HOME=/home/app \
    HF_HOME=/data/hf NLTK_DATA=/opt/nltk_data
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 1000 --create-home --home-dir /home/app app \
 && mkdir -p /data/hf /opt/nltk_data && chown -R app:app /data /opt/nltk_data
WORKDIR /app
COPY requirements.txt .
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install -r requirements.txt \
 && pip install sentencepiece \
 && python -c "import nltk; nltk.download('stopwords', download_dir='/opt/nltk_data')" \
 && chown -R app:app /opt/nltk_data
RUN pip install opentelemetry-distro opentelemetry-exporter-otlp \
 && opentelemetry-bootstrap -a install
COPY --chown=app:app . .
USER app
VOLUME ["/data/hf"]
EXPOSE 8003
CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
