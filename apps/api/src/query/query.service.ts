import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { schema } from '@rag/db';
import type { ChunkCitationDto } from '@rag/shared';
import type * as Ai from 'ai';
import type { ModelMessage, UIMessage } from 'ai';
import { dynamicImport } from '../common/dynamic-import';
import { RlsDbService } from '../db/rls-db.service';
import { OllamaService } from '../llm/ollama.service';
import { ChatService } from '../llm/chat.service';
import { RedisService } from '../cache/redis.service';
import { MetricsService } from '../metrics/metrics.service';
import type { JwtPayload } from '../auth/types';
import { retrieveRelevantChunks } from './retrieval';
import { buildPromptMessages } from './prompt';
import { extractCitations } from './citations';

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const HISTORY_MESSAGES = 6;

export interface QueryRequestBody {
  conversationId?: string;
  messages: UIMessage[];
}

interface CachedAnswer {
  answer: string;
  citations: ChunkCitationDto[];
}

function textOf(message: UIMessage | undefined): string {
  if (!message) return '';
  return message.parts
    .filter((p): p is Extract<UIMessage['parts'][number], { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private readonly rlsDb: RlsDbService,
    private readonly ollama: OllamaService,
    private readonly chat: ChatService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  async handle(body: QueryRequestBody, user: JwtPayload, res: Response): Promise<void> {
    const start = Date.now();
    const lastMessage = body.messages[body.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new BadRequestException('Last message must be from the user');
    }
    const question = textOf(lastMessage).trim();
    if (!question) throw new BadRequestException('Message has no text content');

    const conversationId = await this.resolveConversation(body.conversationId, user, question);
    res.setHeader('X-Conversation-Id', conversationId);

    const cacheKey = this.cacheKey(user.tenantId, question);
    const cachedRaw = await this.redis.get(cacheKey);
    if (cachedRaw) {
      const cached: CachedAnswer = JSON.parse(cachedRaw);
      await this.persistTurn(user, conversationId, question, cached.answer, cached.citations);
      await this.logQuery(user, question, true, Date.now() - start);
      await this.streamPlainAnswer(cached.answer, res);
      return;
    }

    const { chunks, prompt } = await this.rlsDb.run(async (tx) => {
      const [embedding] = await this.ollama.embed([question]);
      const chunks = await retrieveRelevantChunks(tx, user.sub, embedding, 5);

      const priorRows = await tx
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(HISTORY_MESSAGES);
      const history: ModelMessage[] = priorRows
        .reverse()
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      return { chunks, prompt: buildPromptMessages(question, chunks, history) };
    });

    const result = await this.chat.streamAnswer(prompt.system, prompt.messages);

    await result.pipeUIMessageStreamToResponse(res, {
      onFinish: async ({ messages }) => {
        const assistantText = textOf(messages[messages.length - 1]);
        if (!assistantText.trim()) {
          // Ollama occasionally returns an empty completion for no apparent
          // reason (observed in testing). Don't cache or persist a blank
          // answer - let the next attempt retry the LLM call for real.
          this.logger.warn(`Empty completion for question: ${question}`);
          await this.logQuery(user, question, false, Date.now() - start);
          return;
        }
        const citations = extractCitations(assistantText, chunks);
        await this.persistTurn(user, conversationId, question, assistantText, citations);
        await this.redis.setEx(
          cacheKey,
          CACHE_TTL_SECONDS,
          JSON.stringify({ answer: assistantText, citations } satisfies CachedAnswer),
        );
        await this.logQuery(user, question, false, Date.now() - start);
      },
    });
  }

  private async resolveConversation(
    conversationId: string | undefined,
    user: JwtPayload,
    question: string,
  ): Promise<string> {
    return this.rlsDb.run(async (tx) => {
      if (conversationId) {
        const [existing] = await tx
          .select({ id: schema.conversations.id })
          .from(schema.conversations)
          .where(eq(schema.conversations.id, conversationId));
        if (existing) return existing.id;
      }
      const [created] = await tx
        .insert(schema.conversations)
        .values({ tenantId: user.tenantId, userId: user.sub, title: question.slice(0, 80) })
        .returning();
      return created.id;
    });
  }

  private async persistTurn(
    user: JwtPayload,
    conversationId: string,
    question: string,
    answer: string,
    citations: ChunkCitationDto[],
  ): Promise<void> {
    await this.rlsDb.run((tx) =>
      tx.insert(schema.messages).values([
        { tenantId: user.tenantId, conversationId, role: 'user', content: question },
        { tenantId: user.tenantId, conversationId, role: 'assistant', content: answer, citations },
      ]),
    );
  }

  private async logQuery(
    user: JwtPayload,
    question: string,
    cacheHit: boolean,
    latencyMs: number,
  ): Promise<void> {
    this.metrics.recordQuery(cacheHit, latencyMs);
    await this.rlsDb
      .run((tx) =>
        tx.insert(schema.queryLogs).values({
          tenantId: user.tenantId,
          userId: user.sub,
          question,
          model: cacheHit ? 'cache' : this.chat.chatModel,
          cacheHit,
          latencyMs,
        }),
      )
      .catch((err) => this.logger.warn(`Failed to write query log: ${err}`));
  }

  private cacheKey(tenantId: string, question: string): string {
    const hash = createHash('sha256').update(question.trim().toLowerCase()).digest('hex');
    return `qcache:${tenantId}:${hash}`;
  }

  private async streamPlainAnswer(text: string, res: Response): Promise<void> {
    const { createUIMessageStream, pipeUIMessageStreamToResponse } = await dynamicImport<typeof Ai>('ai');
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: 'txt-0' });
        writer.write({ type: 'text-delta', id: 'txt-0', delta: text });
        writer.write({ type: 'text-end', id: 'txt-0' });
      },
    });
    await pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
