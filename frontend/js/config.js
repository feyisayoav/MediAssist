/* Runtime config. Loaded before every other script.
 * Local dev (python -m http.server / opening the files): the gateway runs on :8080.
 * In Docker/Kubernetes the frontend image REPLACES this file at startup from the
 * GATEWAY_URL env var ("" = same origin, i.e. the Ingress routes /api to the gateway). */
window.APP_CONFIG = { gatewayUrl: "http://localhost:8080" };
