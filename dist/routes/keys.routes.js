"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keysRoutes = keysRoutes;
const zod_1 = require("zod");
const client_1 = require("../prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const uploadKeysSchema = zod_1.z.object({
    identityPublicKey: zod_1.z.string(),
    signedPreKeyId: zod_1.z.number(),
    signedPreKey: zod_1.z.string(),
    signedPreKeySig: zod_1.z.string(),
    oneTimePreKeys: zod_1.z.array(zod_1.z.object({
        keyId: zod_1.z.number(),
        publicKey: zod_1.z.string(),
    })),
});
async function keysRoutes(fastify) {
    fastify.post('/upload', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const body = uploadKeysSchema.parse(request.body);
        const deviceId = request.user.deviceId;
        if (!deviceId) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Device ID required' });
        }
        await client_1.prisma.device.update({
            where: { id: deviceId },
            data: {
                identityPublicKey: body.identityPublicKey,
                signedPreKeyId: body.signedPreKeyId,
                signedPreKey: body.signedPreKey,
                signedPreKeySig: body.signedPreKeySig,
            },
        });
        if (body.oneTimePreKeys.length > 0) {
            await client_1.prisma.preKey.createMany({
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
    fastify.get('/bundle/:userId', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        const { userId } = request.params;
        const devices = await client_1.prisma.device.findMany({
            where: { userId },
        });
        if (devices.length === 0) {
            return reply.status(404).send({ error: 'Not Found', message: 'No devices found for user' });
        }
        const bundles = await Promise.all(devices.map(async (device) => {
            const preKey = await client_1.prisma.preKey.findFirst({
                where: { deviceId: device.id },
            });
            if (preKey) {
                await client_1.prisma.preKey.delete({ where: { id: preKey.id } });
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
        }));
        return reply.send(bundles);
    });
}
