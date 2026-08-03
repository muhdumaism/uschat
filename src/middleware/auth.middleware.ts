import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthUserPayload } from '../types';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired session token' });
  }
}
