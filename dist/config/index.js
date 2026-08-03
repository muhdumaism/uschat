"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'uschat-super-secret-jwt-key-production-change-me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'uschat-super-secret-refresh-key-production',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://uschat:uschatpassword@localhost:5432/uschat_db?schema=public',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    storageProvider: process.env.STORAGE_PROVIDER || 'local', // 'local' | 's3' | 'r2' | 'minio'
    localStorageDir: process.env.LOCAL_STORAGE_DIR || path_1.default.join(__dirname, '../../uploads'),
    s3: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || 'uschat-media',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    livekit: {
        apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
        apiSecret: process.env.LIVEKIT_API_SECRET || 'secretsecretsecretsecretsecretsecret',
        wsUrl: process.env.LIVEKIT_WS_URL || 'ws://localhost:7880',
    },
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'USCHAT Security <noreply@uschat.app>',
    },
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
};
