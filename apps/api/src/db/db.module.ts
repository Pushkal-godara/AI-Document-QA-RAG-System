import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { RlsDbService } from './rls-db.service';

@Global()
@Module({
  providers: [DbService, RlsDbService],
  exports: [DbService, RlsDbService],
})
export class DbModule {}
