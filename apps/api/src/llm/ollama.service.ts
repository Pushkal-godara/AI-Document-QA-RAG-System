import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';

@Injectable()
export class OllamaService {
  private readonly client: Ollama;
  readonly embedModel: string;
  readonly chatModel: string;

  constructor(config: ConfigService) {
    this.client = new Ollama({ host: config.getOrThrow<string>('OLLAMA_BASE_URL') });
    this.embedModel = config.getOrThrow<string>('OLLAMA_EMBED_MODEL');
    this.chatModel = config.getOrThrow<string>('OLLAMA_CHAT_MODEL');
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { embeddings } = await this.client.embed({ model: this.embedModel, input: texts });
    return embeddings;
  }
}
