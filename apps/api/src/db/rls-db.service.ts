import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { withTenant, type Db } from '@rag/db';
import { DbService } from './db.service';

/**
 * Request-scoped so `this.req` is always the current HTTP request. Every
 * tenant-scoped query in a controller/service should go through `.run()` -
 * it pulls tenantId off the authenticated JWT (never a client-supplied
 * header/param) and runs the query inside withTenant's transaction, which is
 * what makes the RLS policies in packages/db/src/schema.ts take effect.
 */
@Injectable({ scope: Scope.REQUEST })
export class RlsDbService {
  constructor(
    @Inject(REQUEST) private readonly req: Request,
    private readonly dbService: DbService,
  ) {}

  run<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const tenantId = this.req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('No tenant context on request');
    }
    return withTenant(this.dbService.db, tenantId, fn);
  }
}
