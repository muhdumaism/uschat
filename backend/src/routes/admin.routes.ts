import { FastifyInstance } from 'fastify';
import os from 'os';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/stats', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const totalUsers = await prisma.user.count();
    const totalChats = await prisma.chat.count();
    const totalMessages = await prisma.message.count();
    const activeSessions = await prisma.session.count();
    const pendingReports = await prisma.report.count({ where: { status: 'PENDING' } });
    const totalAttachments = await prisma.attachment.count();
    const storageStats = await prisma.attachment.aggregate({
      _sum: { fileSizeBytes: true },
    });

    const systemHealth = {
      cpuCount: os.cpus().length,
      freeMemoryBytes: os.freemem(),
      totalMemoryBytes: os.totalmem(),
      uptimeSeconds: os.uptime(),
      loadAverage: os.loadavg(),
    };

    return reply.send({
      stats: {
        totalUsers,
        totalChats,
        totalMessages,
        activeSessions,
        pendingReports,
        totalAttachments,
        totalStorageBytes: storageStats._sum.fileSizeBytes || 0,
      },
      systemHealth,
    });
  });

  fastify.get('/users', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { page = '1', limit = '20', search } = request.query as { page?: string; limit?: string; search?: string };
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search.toLowerCase() } },
        { email: { contains: search.toLowerCase() } },
        { displayName: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              devices: true,
              sessions: true,
              chatMembers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({ users, total, page: parseInt(page, 10), pages: Math.ceil(total / take) });
  });

  fastify.post('/users/:userId/revoke-sessions', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    await prisma.session.deleteMany({ where: { userId } });
    return reply.send({ success: true, message: 'All user sessions revoked' });
  });

  fastify.get('/reports', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(reports);
  });

  fastify.patch('/reports/:reportId', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { reportId } = request.params as { reportId: string };
    const { status, adminNotes } = request.body as { status: string; adminNotes?: string };

    const report = await prisma.report.update({
      where: { id: reportId },
      data: { status, adminNotes },
    });

    return reply.send(report);
  });
}
