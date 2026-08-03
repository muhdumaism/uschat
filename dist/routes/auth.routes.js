"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore'),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().min(1).max(50),
    deviceName: zod_1.z.string().optional().default('Mobile Device'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
    deviceName: zod_1.z.string().optional().default('Mobile Device'),
});
async function authRoutes(fastify) {
    // Register
    fastify.post('/register', async (request, reply) => {
        const body = registerSchema.parse(request.body);
        const existingUser = await client_1.prisma.user.findFirst({
            where: {
                OR: [{ email: body.email.toLowerCase() }, { username: body.username.toLowerCase() }],
            },
        });
        if (existingUser) {
            if (existingUser.email === body.email.toLowerCase()) {
                return reply.status(400).send({ error: 'Conflict', message: 'Email is already registered' });
            }
            return reply.status(400).send({ error: 'Conflict', message: 'Username is already taken' });
        }
        const passwordHash = await bcrypt_1.default.hash(body.password, 12);
        const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const user = await client_1.prisma.user.create({
            data: {
                email: body.email.toLowerCase(),
                username: body.username.toLowerCase(),
                passwordHash,
                displayName: body.displayName,
                verificationToken,
            },
        });
        // Create primary device
        const device = await client_1.prisma.device.create({
            data: {
                userId: user.id,
                deviceName: body.deviceName,
                registrationId: Math.floor(Math.random() * 100000),
                identityPublicKey: '',
                signedPreKeyId: 0,
                signedPreKey: '',
                signedPreKeySig: '',
            },
        });
        const token = fastify.jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role, deviceId: device.id }, { expiresIn: '7d' });
        const refreshToken = fastify.jwt.sign({ id: user.id, deviceId: device.id }, { expiresIn: '30d' });
        await client_1.prisma.session.create({
            data: {
                userId: user.id,
                deviceId: device.id,
                token,
                refreshToken,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });
        return reply.status(201).send({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
            },
            deviceId: device.id,
            token,
            refreshToken,
        });
    });
    // Login
    fastify.post('/login', async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const user = await client_1.prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
        });
        if (!user) {
            return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
        }
        const validPassword = await bcrypt_1.default.compare(body.password, user.passwordHash);
        if (!validPassword) {
            return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
        }
        const device = await client_1.prisma.device.create({
            data: {
                userId: user.id,
                deviceName: body.deviceName,
                registrationId: Math.floor(Math.random() * 100000),
                identityPublicKey: '',
                signedPreKeyId: 0,
                signedPreKey: '',
                signedPreKeySig: '',
            },
        });
        const token = fastify.jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role, deviceId: device.id }, { expiresIn: '7d' });
        const refreshToken = fastify.jwt.sign({ id: user.id, deviceId: device.id }, { expiresIn: '30d' });
        await client_1.prisma.session.create({
            data: {
                userId: user.id,
                deviceId: device.id,
                token,
                refreshToken,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });
        return reply.send({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                role: user.role,
            },
            deviceId: device.id,
            token,
            refreshToken,
        });
    });
    // Active Sessions
    fastify.get('/sessions', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const sessions = await client_1.prisma.session.findMany({
            where: { userId: request.user.id },
            include: { device: true },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send(sessions);
    });
    // Revoke Session
    fastify.delete('/sessions/:sessionId', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { sessionId } = request.params;
        await client_1.prisma.session.deleteMany({
            where: { id: sessionId, userId: request.user.id },
        });
        return reply.send({ success: true });
    });
    // Logout current session
    fastify.post('/logout', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            await client_1.prisma.session.deleteMany({ where: { token } });
        }
        return reply.send({ success: true });
    });
}
