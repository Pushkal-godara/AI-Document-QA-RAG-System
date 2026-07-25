import { Global, Module } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { ChatService } from './chat.service';

@Global()
@Module({
  providers: [OllamaService, ChatService],
  exports: [OllamaService, ChatService],
})
export class OllamaModule {}
