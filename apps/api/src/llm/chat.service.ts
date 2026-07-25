import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type * as Ai from 'ai';
import type * as OpenAICompatible from '@ai-sdk/openai-compatible';
import type { ModelMessage } from 'ai';
import { dynamicImport } from '../common/dynamic-import';

/**
 * `@ai-sdk/openai-compatible` + `ai` ship as ESM-only, so a CommonJS NestJS
 * build must load them via dynamic import() rather than require() - see the
 * write-up in ingestion/parsing.ts for the equivalent officeparser situation.
 * (We also tried `ollama-ai-provider-v2`, the "native" Ollama provider, but
 * it targets a Responses-style endpoint Ollama doesn't serve and 404s on
 * every call. Ollama's own OpenAI-compatible /v1 endpoint works fine.)
 */
@Injectable()
export class ChatService {
  readonly chatModel: string;
  private readonly baseURL: string;

  constructor(config: ConfigService) {
    this.chatModel = config.getOrThrow<string>('OLLAMA_CHAT_MODEL');
    this.baseURL = `${config.getOrThrow<string>('OLLAMA_BASE_URL')}/v1`;
  }

  async streamAnswer(system: string, messages: ModelMessage[]) {
    const { createOpenAICompatible } = await dynamicImport<typeof OpenAICompatible>('@ai-sdk/openai-compatible');
    const { streamText } = await dynamicImport<typeof Ai>('ai');

    const provider = createOpenAICompatible({ name: 'ollama', baseURL: this.baseURL });
    return streamText({ model: provider(this.chatModel), system, messages });
  }
}
