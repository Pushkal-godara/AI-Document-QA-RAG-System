import { Controller, Get, Param } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { schema } from '@rag/db';
import { RlsDbService } from '../db/rls-db.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly rlsDb: RlsDbService) {}

  @Get()
  list() {
    return this.rlsDb.run((tx) =>
      tx.select().from(schema.conversations).orderBy(desc(schema.conversations.createdAt)),
    );
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.rlsDb.run((tx) =>
      tx
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, id))
        .orderBy(asc(schema.messages.createdAt)),
    );
  }
}
