"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const static_1 = __importDefault(require("@fastify/static"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const config_1 = require("./config");
const client_1 = require("./prisma/client");
const auth_routes_1 = require("./routes/auth.routes");
const user_routes_1 = require("./routes/user.routes");
const keys_routes_1 = require("./routes/keys.routes");
const chat_routes_1 = require("./routes/chat.routes");
const message_routes_1 = require("./routes/message.routes");
const media_routes_1 = require("./routes/media.routes");
const call_routes_1 = require("./routes/call.routes");
const admin_routes_1 = require("./routes/admin.routes");
const notification_routes_1 = require("./routes/notification.routes");
const app_routes_1 = require("./routes/app.routes");
const ws_handler_1 = require("./websocket/ws.handler");
function buildApp() {
    const app = (0, fastify_1.default)({ logger: true });
    if (!fs_1.default.existsSync(config_1.config.localStorageDir)) {
        fs_1.default.mkdirSync(config_1.config.localStorageDir, { recursive: true });
    }
    app.setErrorHandler((error, request, reply) => {
        if (error instanceof zod_1.ZodError) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Validation failed',
                details: error.issues,
            });
        }
        reply.status(error.statusCode || 500).send({
            error: error.name || 'Internal Server Error',
            message: error.message,
        });
    });
    app.register(cors_1.default, { origin: config_1.config.corsOrigins });
    app.register(jwt_1.default, { secret: config_1.config.jwtSecret });
    app.register(websocket_1.default);
    app.register(multipart_1.default, { limits: { fileSize: 100 * 1024 * 1024 } });
    app.register(rate_limit_1.default, { max: 200, timeWindow: '1 minute' });
    app.register(static_1.default, {
        root: path_1.default.resolve(config_1.config.localStorageDir),
        prefix: '/uploads/',
    });
    app.register(auth_routes_1.authRoutes, { prefix: '/api/v1/auth' });
    app.register(user_routes_1.userRoutes, { prefix: '/api/v1/users' });
    app.register(keys_routes_1.keysRoutes, { prefix: '/api/v1/keys' });
    app.register(chat_routes_1.chatRoutes, { prefix: '/api/v1/chats' });
    app.register(message_routes_1.messageRoutes, { prefix: '/api/v1/messages' });
    app.register(media_routes_1.mediaRoutes, { prefix: '/api/v1/media' });
    app.register(call_routes_1.callRoutes, { prefix: '/api/v1/calls' });
    app.register(admin_routes_1.adminRoutes, { prefix: '/api/v1/admin' });
    app.register(notification_routes_1.notificationRoutes, { prefix: '/api/v1/notifications' });
    app.register(app_routes_1.appRoutes, { prefix: '/api/v1/app' });
    app.after(async () => {
        (0, ws_handler_1.registerWebSocketRoutes)(app);
        // Seed @uschat_bot system user
        try {
            const existingBot = await client_1.prisma.user.findUnique({ where: { username: 'uschat_bot' } });
            if (!existingBot) {
                const hash = await bcryptjs_1.default.hash('uschat_bot_password_123', 10);
                await client_1.prisma.user.create({
                    data: {
                        email: 'bot@uschat.app',
                        username: 'uschat_bot',
                        displayName: 'USCHAT Encrypted Bot',
                        passwordHash: hash,
                        bio: '🤖 Automated Signal E2EE Bot for local testing.',
                        role: 'USER',
                    },
                });
                console.log('🤖 USCHAT System Bot User (@uschat_bot) created.');
            }
        }
        catch (err) {
            console.error('Bot Seeding Error:', err);
        }
    });
    app.get('/health', async () => {
        return { status: 'healthy', timestamp: new Date(), version: '1.0.0' };
    });
    return app;
}
