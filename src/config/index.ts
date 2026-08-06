import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'uschat-super-secret-jwt-key-production-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'uschat-super-secret-refresh-key-production',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://uschat:uschatpassword@localhost:5432/uschat_db?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  storageProvider: process.env.STORAGE_PROVIDER || 'local', // 'local' | 's3' | 'r2' | 'minio'
  localStorageDir: path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '../../uploads')),
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
