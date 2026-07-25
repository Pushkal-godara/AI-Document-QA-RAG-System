import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [IngestionModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
