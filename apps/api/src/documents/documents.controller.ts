import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtPayload) {
    return this.documentsService.upload(file, user);
  }

  @Get()
  list() {
    return this.documentsService.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.documentsService.getOne(id);
  }
}
