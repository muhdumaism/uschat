export interface AuthUserPayload {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  deviceId?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUserPayload;
  }
}
