import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { ConversationsController } from './conversations.controller';
import { QueryService } from './query.service';

@Module({
  controllers: [QueryController, ConversationsController],
  providers: [QueryService],
})
export class QueryModule {}
