import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, and, count } from 'drizzle-orm';
import { schema, withTenant } from '@rag/db';
import { DbService } from '../db/db.service';
import type { DevLoginDto } from './dto/dev-login.dto';
import type { JwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Dev-only convenience: mints a valid JWT without a real password/identity
   * check, so we can build and test tenant isolation before Clerk is wired
   * in. Finds-or-creates the tenant and the user inside it; the first user
   * created for a tenant becomes its admin.
   */
  async devLogin(dto: DevLoginDto) {
    // tenants has no RLS - it's the tenant directory itself, not tenant data.
    const db = this.dbService.db;
    let [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.name, dto.tenantName));
    if (!tenant) {
      [tenant] = await db.insert(schema.tenants).values({ name: dto.tenantName }).returning();
    }

    const user = await withTenant(db, tenant.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.email, dto.email)));
      if (existing) return existing;

      const [{ value: userCount }] = await tx
        .select({ value: count() })
        .from(schema.users)
        .where(eq(schema.users.tenantId, tenant.id));

      const [created] = await tx
        .insert(schema.users)
        .values({
          tenantId: tenant.id,
          email: dto.email,
          passwordHash: 'dev-stub',
          role: userCount === 0 ? 'admin' : 'member',
        })
        .returning();
      return created;
    });

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role as 'admin' | 'member',
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, user: payload, tenant: { id: tenant.id, name: tenant.name, tier: tenant.tier } };
  }
}
