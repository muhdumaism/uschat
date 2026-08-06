"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const zod_1 = require("zod");
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const updateProfileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(1).max(50).optional(),
    bio: zod_1.z.string().max(250).optional(),
    avatarUrl: zod_1.z.string().optional().nullable(),
    disappearingDefault: zod_1.z.number().int().min(0).optional(),
});
const updateUsernameSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
});
async function userRoutes(fastify) {
    // Get Me
    fastify.get('/me', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const user = await client_1.prisma.user.findUnique({
            where: { id: request.user.id },
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                disappearingDefault: true,
                usernameLastChangedAt: true,
                createdAt: true,
            },
        });
        return reply.send(user);
    });
    // Update Profile
    fastify.patch('/profile', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const body = updateProfileSchema.parse(request.body);
        const updated = await client_1.prisma.user.update({
            where: { id: request.user.id },
            data: body,
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                disappearingDefault: true,
            },
        });
        return reply.send(updated);
    });
    // Update Username (30-day throttle enforce)
    fastify.patch('/username', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const body = updateUsernameSchema.parse(request.body);
        const currentUser = await client_1.prisma.user.findUnique({
            where: { id: request.user.id },
        });
        if (!currentUser)
            return reply.status(404).send({ error: 'Not Found' });
        if (currentUser.usernameLastChangedAt) {
            const daysSinceChange = (Date.now() - currentUser.usernameLastChangedAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceChange < 30) {
                const daysRemaining = Math.ceil(30 - daysSinceChange);
                return reply.status(400).send({
                    error: 'Rate Limited',
                    message: `Username can only be changed once every 30 days. Please wait ${daysRemaining} day(s).`,
                });
            }
        }
        const existing = await client_1.prisma.user.findUnique({
            where: { username: body.username.toLowerCase() },
        });
        if (existing && existing.id !== request.user.id) {
            return reply.status(400).send({ error: 'Conflict', message: 'Username is already taken' });
        }
        const updated = await client_1.prisma.user.update({
            where: { id: request.user.id },
            data: {
                username: body.username.toLowerCase(),
                usernameLastChangedAt: new Date(),
            },
            select: {
                id: true,
                username: true,
                usernameLastChangedAt: true,
            },
        });
        return reply.send(updated);
    });
    // Search User by Username (@handle search ONLY - Emails are never returned)
    fastify.get('/search', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { q } = request.query;
        if (!q || q.length < 2) {
            return reply.send([]);
        }
        const queryClean = q.replace(/^@/, '').toLowerCase();
        const users = await client_1.prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: queryClean } },
                    { displayName: { contains: queryClean } },
                ],
                id: { not: request.user.id },
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                bio: true,
            },
            take: 20,
        });
        return reply.send(users);
    });
    // User details by username
    fastify.get('/by-username/:username', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { username } = request.params;
        const user = await client_1.prisma.user.findUnique({
            where: { username: username.toLowerCase() },
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
            },
        });
        if (!user) {
            return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
        }
        return reply.send(user);
    });
}
