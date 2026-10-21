package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ashthecoder05/medical-ai-gateway/internal/config"
	"github.com/ashthecoder05/medical-ai-gateway/internal/router"
)

func main() {
	cfg := config.Load()

	// OpenTelemetry (no-op if OTEL_EXPORTER_OTLP_ENDPOINT is unset)
	shutdownTelemetry := initTelemetry(context.Background())

	// One server span per incoming request
	handler := instrumentHandler(router.New(cfg))

	// No Read/WriteTimeout on purpose: the chatbot call can legitimately run up to 120s.
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: handler}

	log.Printf("API Gateway listening on :%s", cfg.Port)
	log.Printf("Diagnosis service -> %s", cfg.DiagnosisServiceURL)
	log.Printf("Imaging service   -> %s", cfg.ImagingServiceURL)
	log.Printf("Drug service      -> %s", cfg.DrugServiceURL)
	log.Printf("Chatbot service   -> %s", cfg.ChatbotServiceURL)

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server failed: %v", err)
		}
	}()

	// Flush buffered traces/metrics when the container is stopped
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	_ = shutdownTelemetry(ctx)
}