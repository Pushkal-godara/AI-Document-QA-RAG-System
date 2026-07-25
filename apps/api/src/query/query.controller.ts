import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types';
import { QueryService, type QueryRequestBody } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post()
  async query(
    @Body() body: QueryRequestBody,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    await this.queryService.handle(body, user, res);
  }
}
