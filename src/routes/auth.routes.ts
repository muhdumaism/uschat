import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1),
  password: z.string().min(6),
  displayName: z.string().min(1),
  deviceName: z.string().optional().default('Mobile Device'),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string(),
  deviceName: z.string().optional().default('Mobile Device'),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const cleanEmail = body.email.trim().toLowerCase();
    let cleanUsername = body.username.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
    if (cleanUsername.length < 3) {
      cleanUsername = `user_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingEmail) {
      return reply.status(400).send({ error: 'Conflict', message: 'Email is already registered. Please log in instead.' });
    }

    // Auto-resolve username collisions if taken
    let finalUsername = cleanUsername;
    const existingUsername = await prisma.user.findUnique({
      where: { username: finalUsername },
    });

    if (existingUsername) {
      finalUsername = `${cleanUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        username: finalUsername,
        passwordHash,
        displayName: body.displayName.trim() || finalUsername,
        verificationToken,
      },
    });

    // Create primary device
    const device = await prisma.device.create({
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

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role, deviceId: device.id },
      { expiresIn: '7d' }
    );
    const refreshToken = fastify.jwt.sign(
      { id: user.id, deviceId: device.id },
      { expiresIn: '30d' }
    );

    await prisma.session.create({
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

  // Login (supports Username or Email)
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const identifier = body.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const device = await prisma.device.create({
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

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role, deviceId: device.id },
      { expiresIn: '7d' }
    );
    const refreshToken = fastify.jwt.sign(
      { id: user.id, deviceId: device.id },
      { expiresIn: '30d' }
    );

    await prisma.session.create({
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
  fastify.get('/sessions', { preHandler: [authenticate] }, async (request, reply) => {
    const sessions = await prisma.session.findMany({
      where: { userId: request.user.id },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(sessions);
  });

  // Revoke Session
  fastify.delete('/sessions/:sessionId', { preHandler: [authenticate] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    await prisma.session.deleteMany({
      where: { id: sessionId, userId: request.user.id },
    });
    return reply.send({ success: true });
  });

  // Logout current session
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await prisma.session.deleteMany({ where: { token } });
    }
    return reply.send({ success: true });
  });
}
