import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = process.hrtime.bigint();
    const http = context.switchToHttp();
    const req = http.getRequest();
    // Controller.method as the route label - low cardinality, no path params leaking in.
    const route = `${context.getClass().name}.${context.getHandler().name}`;

    const record = () => {
      const res = http.getResponse<Response>();
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.httpRequestDuration.observe(
        { method: req.method, route, status: String(res.statusCode) },
        seconds,
      );
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
