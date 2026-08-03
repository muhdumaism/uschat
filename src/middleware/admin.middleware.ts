import { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
  }
}
