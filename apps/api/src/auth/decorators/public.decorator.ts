import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as exempt from JwtAuthGuard (e.g. /auth/dev-login, /health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
