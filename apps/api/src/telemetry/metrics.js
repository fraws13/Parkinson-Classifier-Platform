// In-memory, process-local observations: not a historical SLA certification.
export function createTelemetry() {
  const startedAt = Date.now();
  const samples = [];
  let total = 0;
  let failures = 0;
  return {
    record(durationMs, statusCode) {
      total++;
      if (statusCode >= 500) failures++;
      samples.push({ at: Date.now(), durationMs, statusCode });
      if (samples.length > 10000) samples.shift();
    },
    snapshot() {
      const now = Date.now();
      const recent = samples.filter(s => s.at >= now - 60000);
      const values = recent.map(s => s.durationMs).sort((a, b) => a - b);
      const percentile = p => values.length ? Number(values[Math.ceil(values.length * p) - 1].toFixed(2)) : null;
      return {
        startedAt: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.floor((now - startedAt) / 1000),
        totalRequests: total,
        serverErrors: failures,
        requestsLastMinute: recent.length,
        meanLatencyMs: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null,
        p95LatencyMs: percentile(0.95),
        p99LatencyMs: percentile(0.99),
        successfulServerResponsesPct: total ? Number(((total - failures) / total * 100).toFixed(2)) : null,
        scope: 'Processo Node corrente; latenza API server, esclusi rete, browser e traffico statico. Finestra mobile 60 secondi, massimo 10.000 campioni.',
      };
    },
  };
}
