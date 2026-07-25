import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { DevLoginDto } from './dto/dev-login.dto';
import { AuthService } from './auth.service';
import type { JwtPayload } from './types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('dev-login')
  async devLogin(@Body() dto: DevLoginDto) {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('dev-login is disabled in production');
    }
    return this.authService.devLogin(dto);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
