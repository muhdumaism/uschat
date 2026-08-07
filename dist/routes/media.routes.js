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
const media_service_1 = require("../services/media.service");
const pump = (0, util_1.promisify)(stream_1.pipeline);
async function mediaRoutes(fastify) {
    fastify.post('/upload', { preHandler: [auth_middleware_1.authenticate] }, async (request, reply) => {
        try {
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
            }
            const mime = data.mimetype.toLowerCase();
            let limit = config_1.config.uploadLimits.document;
            if (mime.startsWith('image/')) {
                limit = config_1.config.uploadLimits.image;
            }
            else if (mime.startsWith('video/')) {
                limit = config_1.config.uploadLimits.video;
            }
            else if (mime.startsWith('audio/')) {
                limit = config_1.config.uploadLimits.voice;
            }
            const ext = path_1.default.extname(data.filename) || '.jpg';
            const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
            const filepath = path_1.default.join(config_1.config.localStorageDir, filename);
            const fileStream = fs_1.default.createWriteStream(filepath);
            await pump(data.file, fileStream);
            const stats = fs_1.default.statSync(filepath);
            if (stats.size > limit) {
                fs_1.default.unlinkSync(filepath); // delete the oversized file
                return reply.status(400).send({
                    error: 'Bad Request',
                    message: `File size exceeds the limit of ${limit / (1024 * 1024)} MB for this media type.`
                });
            }
            // Process, compress, generate thumbnails and upload to destination storage provider
            const mediaResult = await media_service_1.MediaService.processAndStoreMedia(filepath, data.filename, mime);
            return reply.status(201).send(mediaResult);
        }
        catch (err) {
            request.log.error('Media upload error:', err);
            return reply.status(500).send({ error: 'Upload Failed', message: err.message });
        }
    });
}
