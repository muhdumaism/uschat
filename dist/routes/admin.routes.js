"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = adminRoutes;
const os_1 = __importDefault(require("os"));
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const admin_middleware_1 = require("../middleware/admin.middleware");
async function adminRoutes(fastify) {
    fastify.get('/stats', { preHandler: [auth_middleware_1.authenticate, admin_middleware_1.requireAdmin] }, async (request, reply) => {
        const totalUsers = await client_1.prisma.user.count();
        const totalChats = await client_1.prisma.chat.count();
        const totalMessages = await client_1.prisma.message.count();
        const activeSessions = await client_1.prisma.session.count();
        const pendingReports = await client_1.prisma.report.count({ where: { status: 'PENDING' } });
        const totalAttachments = await client_1.prisma.attachment.count();
        const storageStats = await client_1.prisma.attachment.aggregate({
            _sum: { fileSizeBytes: true },
        });
        const systemHealth = {
            cpuCount: os_1.default.cpus().length,
            freeMemoryBytes: os_1.default.freemem(),
            totalMemoryBytes: os_1.default.totalmem(),
            uptimeSeconds: os_1.default.uptime(),
            loadAverage: os_1.default.loadavg(),
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
    fastify.get('/users', { preHandler: [auth_middleware_1.authenticate, admin_middleware_1.requireAdmin] }, async (request, reply) => {
        const { page = '1', limit = '20', search } = request.query;
        const take = parseInt(limit, 10);
        const skip = (parseInt(page, 10) - 1) * take;
        const where = {};
        if (search) {
            where.OR = [
                { username: { contains: search.toLowerCase() } },
                { email: { contains: search.toLowerCase() } },
                { displayName: { contains: search } },
            ];
        }
        const [users, total] = await Promise.all([
            client_1.prisma.user.findMany({
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
            client_1.prisma.user.count({ where }),
        ]);
        return reply.send({ users, total, page: parseInt(page, 10), pages: Math.ceil(total / take) });
    });
    fastify.post('/users/:userId/revoke-sessions', { preHandler: [auth_middleware_1.authenticate, admin_middleware_1.requireAdmin] }, async (request, reply) => {
        const { userId } = request.params;
        await client_1.prisma.session.deleteMany({ where: { userId } });
        return reply.send({ success: true, message: 'All user sessions revoked' });
    });
    fastify.get('/reports', { preHandler: [auth_middleware_1.authenticate, admin_middleware_1.requireAdmin] }, async (request, reply) => {
        const reports = await client_1.prisma.report.findMany({
            include: {
                reporter: { select: { id: true, username: true } },
                reportedUser: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send(reports);
    });
    fastify.patch('/reports/:reportId', { preHandler: [auth_middleware_1.authenticate, admin_middleware_1.requireAdmin] }, async (request, reply) => {
        const { reportId } = request.params;
        const { status, adminNotes } = request.body;
        const report = await client_1.prisma.report.update({
            where: { id: reportId },
            data: { status, adminNotes },
        });
        return reply.send(report);
    });
}
