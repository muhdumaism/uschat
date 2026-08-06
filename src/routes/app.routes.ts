import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';

export async function appRoutes(fastify: FastifyInstance) {
  // Check latest application version & metadata
  fastify.get('/version', async (_request, reply) => {
    return reply.send({
      latestVersion: '1.0.7',
      versionCode: 107,
      downloadUrl: 'https://uschat.ruptyl.space/api/v1/app/download',
      releaseNotes: '⚡ USCHAT v1.0.7 Release:\n- Fixed critical bug where FCM push tokens were never registered with the backend (wrong AsyncStorage key)\n- Fixed token refresh: refreshed FCM tokens now auto-upload to backend\n- Fixed message notification delivery: upgraded to high-priority FCM for reliable background/killed delivery\n- Fixed duplicate notifications by switching to data-only FCM messages\n- Synced Android versionCode/versionName with app version',
      forceUpdate: false,
    });
  });

  // Get application configuration (like upload limits)
  fastify.get('/config', async (_request, reply) => {
    return reply.send({
      uploadLimits: {
        image: parseInt(process.env.LIMIT_IMAGE || String(10 * 1024 * 1024), 10),
        video: parseInt(process.env.LIMIT_VIDEO || String(100 * 1024 * 1024), 10),
        voice: parseInt(process.env.LIMIT_VOICE || String(25 * 1024 * 1024), 10),
        document: parseInt(process.env.LIMIT_DOCUMENT || String(50 * 1024 * 1024), 10),
      }
    });
  });

  // Direct APK download route - SECURED via JWT (Header or Query token)
  fastify.get('/download', async (request, reply) => {
    let token = request.headers.authorization?.split(' ')[1];
    
    // Fallback to query token if browser download
    if (!token && (request.query as any).token) {
      token = (request.query as any).token;
    }

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication token required' });
    }

    try {
      // Validate the token
      fastify.jwt.verify(token);
    } catch (err: any) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }

    // Serve from the backend root folder (safe, not public!)
    const apkPath = path.resolve(path.join(__dirname, '../../uschat.apk'));
    if (!fs.existsSync(apkPath)) {
      return reply.status(404).send({ error: 'Not Found', message: 'USCHAT APK package not found on server' });
    }

    // Serve the file directly using fastify-static sendFile from its absolute folder
    const rootDir = path.dirname(apkPath);
    const fileName = path.basename(apkPath);

    return reply.header('Content-Type', 'application/vnd.android.package-archive')
      .header('Content-Disposition', 'attachment; filename="uschat.apk"')
      .sendFile(fileName, rootDir);
  });
}
