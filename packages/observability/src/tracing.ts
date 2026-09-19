import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// See PRD section 33 (Observability): every request/event should carry a
// traceId alongside its correlationId/eventId. Call this once before the
// Nest app bootstraps.
export function startTracing(serviceName: string): NodeSDK {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    void sdk.shutdown();
  });

  return sdk;
}
