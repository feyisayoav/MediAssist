FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
# nginx:alpine runs every script in /docker-entrypoint.d/ before starting.
COPY docker/40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh \
 && rm -rf /usr/share/nginx/html/docker /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/node_modules
# GATEWAY_URL="" => browser calls /api on the same origin (Ingress routes it to the gateway)
ENV GATEWAY_URL=""
EXPOSE 80
