"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRoutes = mediaRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const util_1 = require("util");
const config_1 = require("../config");
const auth_middleware_1 = require("../middleware/auth.middleware");
const pump = (0, util_1.promisify)(stream_1.pipeline);
async function mediaRoutes(fastify) {
    fastify.post('/upload', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        try {
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
            }
            const ext = path_1.default.extname(data.filename) || '.jpg';
            const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
            const filepath = path_1.default.join(config_1.config.localStorageDir, filename);
            await pump(data.file, fs_1.default.createWriteStream(filepath));
            const fileUrl = `http://192.168.1.83:4000/uploads/${filename}`;
            return reply.status(201).send({ fileUrl });
        }
        catch (err) {
            request.log.error('Media upload error:', err);
            return reply.status(500).send({ error: 'Upload Failed', message: err.message });
        }
    });
}
