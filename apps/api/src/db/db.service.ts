import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppPool, type Db } from '@rag/db';

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly db: Db;
  private readonly close: () => Promise<void>;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL_APP');
    const pool = createAppPool(url);
    this.db = pool.db;
    this.close = pool.close;
  }

  async onModuleDestroy() {
    await this.close();
  }
}
