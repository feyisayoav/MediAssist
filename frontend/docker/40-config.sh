#!/bin/sh
# Writes js/config.js from the GATEWAY_URL env var at container start.
set -eu
cat > /usr/share/nginx/html/js/config.js <<JS
window.APP_CONFIG = { gatewayUrl: "${GATEWAY_URL:-}" };
JS
echo "frontend config: gatewayUrl='${GATEWAY_URL:-}'"
