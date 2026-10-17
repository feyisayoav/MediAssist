# MediAssist on Kubernetes

```
gateway/Dockerfile                      Go, multi-stage -> distroless
frontend/Dockerfile + docker/40-config.sh   nginx; writes js/config.js from $GATEWAY_URL
services/*/Dockerfile                   one per Python service (own deps, non-root)
k8s/base/                               namespace, configmap, 6 deployments+services, ingress
k8s/overlays/local/                     kind/minikube (local images)
k8s/overlays/prod/                      registry images, 2 replicas, HPAs, real hostname
k8s/kind-config.yaml  Makefile
```

## Run locally (kind)
```
make cluster      # kind cluster with ports 80/443 mapped
make ingress      # ingress-nginx
make up           # build 6 images, load into kind, apply k8s/overlays/local
make status       # wait until all pods are Ready (chatbot: first boot downloads ~1 GB)
echo "127.0.0.1 mediassist.local" | sudo tee -a /etc/hosts     # Windows: hosts file
open http://mediassist.local
```
Logs: `make logs S=chatbot`. Tear down: `make down`.

## Notes
- Gateway env (`*_SERVICE_URL`) comes from the ConfigMap and uses Service DNS names (`http://chatbot:8003`).
- Model files are baked into each image (`COPY . .`) -- they must exist in the service folders at build time.
- Chatbot HuggingFace models are cached on a 5 Gi PVC, so restarts don't re-download.
- Ingress allows 20 MB uploads and 180 s timeouts (imaging uploads, slow chatbot cold starts).
- Probes are TCP-based for the Python services (no /health route needed); the chatbot only listens
  after its model preload finishes, so readiness waits for it.
- prod overlay: replace `ghcr.io/REPLACE_ME` and the hostname, then `kubectl apply -k k8s/overlays/prod`.
