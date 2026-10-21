package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// initTelemetry wires traces + metrics to the OTLP endpoint named in
// OTEL_EXPORTER_OTLP_ENDPOINT (service name comes from OTEL_SERVICE_NAME).
// If the endpoint is unset it does nothing, so the gateway still runs without a collector.
// Call the returned function on shutdown to flush.
func initTelemetry(ctx context.Context) func(context.Context) error {
	noop := func(context.Context) error { return nil }
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") == "" {
		log.Println("telemetry: OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled")
		return noop
	}

	res, err := resource.New(ctx, resource.WithFromEnv(), resource.WithTelemetrySDK())
	if err != nil {
		log.Printf("telemetry: resource error: %v", err)
		return noop
	}

	traceExp, err := otlptracegrpc.New(ctx)
	if err != nil {
		log.Printf("telemetry: trace exporter error: %v", err)
		return noop
	}
	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(traceExp), sdktrace.WithResource(res))
	otel.SetTracerProvider(tp)

	metricExp, err := otlpmetricgrpc.New(ctx)
	if err != nil {
		log.Printf("telemetry: metric exporter error: %v", err)
		return tp.Shutdown
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp, sdkmetric.WithInterval(15*time.Second))),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(mp)

	// W3C traceparent: lets the Python services continue the gateway's trace.
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{}))

	return func(c context.Context) error {
		return errors.Join(tp.Shutdown(c), mp.Shutdown(c))
	}
}

// instrumentHandler wraps the gateway's root handler: one server span per request.
func instrumentHandler(h http.Handler) http.Handler {
	return otelhttp.NewHandler(h, "gateway",
		otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
			return r.Method + " " + r.URL.Path
		}))
}

// instrumentedTransport makes outgoing calls create client spans AND send the
// traceparent header to the downstream service.
func instrumentedTransport() http.RoundTripper {
	return otelhttp.NewTransport(http.DefaultTransport)
}