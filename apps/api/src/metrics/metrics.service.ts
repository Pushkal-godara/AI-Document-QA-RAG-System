import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [this.registry],
  });

  readonly queryDuration = new Histogram({
    name: 'rag_query_duration_seconds',
    help: 'End-to-end /query request duration in seconds',
    labelNames: ['cache_hit'] as const,
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 3, 5, 8, 15, 30],
    registers: [this.registry],
  });

  readonly queryTotal = new Counter({
    name: 'rag_query_total',
    help: 'Total number of /query requests',
    labelNames: ['cache_hit'] as const,
    registers: [this.registry],
  });

  readonly ingestionDuration = new Histogram({
    name: 'rag_ingestion_duration_seconds',
    help: 'Document ingestion job duration in seconds',
    labelNames: ['status'] as const,
    buckets: [1, 2, 5, 10, 20, 30, 60, 120, 300],
    registers: [this.registry],
  });

  readonly documentsIngestedTotal = new Counter({
    name: 'rag_documents_ingested_total',
    help: 'Total number of documents processed by the ingestion pipeline',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordQuery(cacheHit: boolean, durationMs: number): void {
    const label = { cache_hit: String(cacheHit) };
    this.queryDuration.observe(label, durationMs / 1000);
    this.queryTotal.inc(label);
  }

  recordIngestion(status: 'ready' | 'failed', durationMs: number): void {
    const label = { status };
    this.ingestionDuration.observe(label, durationMs / 1000);
    this.documentsIngestedTotal.inc(label);
  }
}
