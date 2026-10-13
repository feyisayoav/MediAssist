CLUSTER ?= mediassist
IMAGES  := gateway frontend diagnosis imaging drug chatbot
dir_gateway   = gateway
dir_frontend  = frontend
dir_diagnosis = services/disease-diagnosis
dir_imaging   = services/medical-imaging
dir_drug      = services/drug-recommendation
dir_chatbot   = services/medical-chatbot

.PHONY: cluster ingress build load deploy up status logs down hosts
cluster:   ## create the local kind cluster
	kind create cluster --name $(CLUSTER) --config k8s/kind-config.yaml
ingress:   ## install ingress-nginx for kind
	kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
	kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s
build:     ## build all six images
	$(foreach i,$(IMAGES),docker build -t mediassist-$(i):latest $(dir_$(i)) &&) true
load:      ## copy the images into the kind cluster
	$(foreach i,$(IMAGES),kind load docker-image mediassist-$(i):latest --name $(CLUSTER) &&) true
deploy:    ## apply the local overlay
	kubectl apply -k k8s/overlays/local
up: build load deploy
status:
	kubectl -n mediassist get pods,svc,ingress,pvc
logs:      ## make logs S=chatbot
	kubectl -n mediassist logs -f deploy/$(S)
hosts:     ## one-time: map the hostname to localhost
	@echo "Add this line to your hosts file:  127.0.0.1 mediassist.local"
down:
	kubectl delete -k k8s/overlays/local --ignore-not-found
