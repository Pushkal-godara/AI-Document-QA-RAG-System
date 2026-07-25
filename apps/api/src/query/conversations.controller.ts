import { Body, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { schema } from '@rag/db';
import { RlsDbService } from '../db/rls-db.service';
import { RateMessageDto } from './dto/rate-message.dto';

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

  @Patch(':conversationId/messages/:messageId/feedback')
  async rate(
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: RateMessageDto,
  ) {
    const [updated] = await this.rlsDb.run((tx) =>
      tx
        .update(schema.messages)
        .set({ rating: dto.rating })
        .where(and(eq(schema.messages.id, messageId), eq(schema.messages.conversationId, conversationId)))
        .returning(),
    );
    if (!updated) throw new NotFoundException('Message not found');
    return updated;
  }
}
