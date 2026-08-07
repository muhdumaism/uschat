"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const envPath = path_1.default.join(__dirname, '../../.env');
const result = dotenv_1.default.config({ path: envPath });
console.log(`[Dotenv] Attempting to load .env from: ${envPath}`);
if (result.error) {
    console.error('[Dotenv] ❌ Error loading .env file:', result.error.message);
}
else {
    console.log('[Dotenv] ✅ Loaded .env file successfully. Keys found:', Object.keys(result.parsed || {}));
}
console.log('[Dotenv] DATABASE_URL in process.env:', process.env.DATABASE_URL ? 'DEFINED (starts with: ' + process.env.DATABASE_URL.substring(0, 8) + '...)' : 'UNDEFINED ❌');
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'uschat-super-secret-jwt-key-production-change-me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'uschat-super-secret-refresh-key-production',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://uschat:uschatpassword@localhost:5432/uschat_db?schema=public',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    storageProvider: process.env.STORAGE_PROVIDER || 'local', // 'local' | 's3' | 'r2' | 'minio'
    localStorageDir: path_1.default.resolve(process.env.LOCAL_STORAGE_DIR || path_1.default.join(__dirname, '../../uploads')),
    s3: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || 'uschat-media',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    lavalink: {
        host: process.env.LAVALINK_HOST || 'localhost',
        port: parseInt(process.env.LAVALINK_PORT || '2333', 10),
        password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
    },
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || '',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    },
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'USCHAT Security <noreply@uschat.app>',
    },
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
    apkDownloadUrl: process.env.APK_DOWNLOAD_URL || 'https://uschat.ruptyl.space/api/v1/app/download',
    firebase: {
        serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json',
    },
    uploadLimits: {
        image: parseInt(process.env.LIMIT_IMAGE || String(10 * 1024 * 1024), 10),
        video: parseInt(process.env.LIMIT_VIDEO || String(100 * 1024 * 1024), 10),
        voice: parseInt(process.env.LIMIT_VOICE || String(25 * 1024 * 1024), 10),
        document: parseInt(process.env.LIMIT_DOCUMENT || String(50 * 1024 * 1024), 10),
    },
};
