import { Controller, Get, Header } from '@nestjs/common';
import { contentType } from 'prom-client';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', contentType)
  async getMetrics(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
