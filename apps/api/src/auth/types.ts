export interface JwtPayload {
  sub: string; // user id
  tenantId: string;
  email: string;
  role: 'admin' | 'member';
}

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}
