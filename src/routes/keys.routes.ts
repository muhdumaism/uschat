import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const uploadKeysSchema = z.object({
  identityPublicKey: z.string(),
  signedPreKeyId: z.number(),
  signedPreKey: z.string(),
  signedPreKeySig: z.string(),
  oneTimePreKeys: z.array(
    z.object({
      keyId: z.number(),
      publicKey: z.string(),
    })
  ),
});

export async function keysRoutes(fastify: FastifyInstance) {
  fastify.post('/upload', { preHandler: [authenticate] }, async (request, reply) => {
    const body = uploadKeysSchema.parse(request.body);
    const deviceId = request.user.deviceId;

    if (!deviceId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Device ID required' });
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: {
        identityPublicKey: body.identityPublicKey,
        signedPreKeyId: body.signedPreKeyId,
        signedPreKey: body.signedPreKey,
        signedPreKeySig: body.signedPreKeySig,
      },
    });

    if (body.oneTimePreKeys.length > 0) {
      await prisma.preKey.createMany({
        data: body.oneTimePreKeys.map((pk) => ({
          userId: request.user.id,
          deviceId,
          keyId: pk.keyId,
          publicKey: pk.publicKey,
        })),
      });
    }

    return reply.send({ success: true, keysCount: body.oneTimePreKeys.length });
  });

  fastify.get('/bundle/:userId', { preHandler: [authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const devices = await prisma.device.findMany({
      where: { userId },
    });

    if (devices.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'No devices found for user' });
    }

    const bundles = await Promise.all(
      devices.map(async (device) => {
        const preKey = await prisma.preKey.findFirst({
          where: { deviceId: device.id },
        });

        if (preKey) {
          await prisma.preKey.delete({ where: { id: preKey.id } });
        }

        return {
          userId,
          deviceId: device.id,
          registrationId: device.registrationId,
          identityPublicKey: device.identityPublicKey,
          signedPreKeyId: device.signedPreKeyId,
          signedPreKey: device.signedPreKey,
          signedPreKeySig: device.signedPreKeySig,
          oneTimePreKey: preKey
            ? {
                keyId: preKey.keyId,
                publicKey: preKey.publicKey,
              }
            : null,
        };
      })
    );

    return reply.send(bundles);
  });
}
