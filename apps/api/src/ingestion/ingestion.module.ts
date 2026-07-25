import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestionProcessor } from './ingestion.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'ingestion' })],
  providers: [IngestionProcessor],
  exports: [BullModule],
})
export class IngestionModule {}
