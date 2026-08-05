import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';

export async function appRoutes(fastify: FastifyInstance) {
  // Check latest application version & metadata
  fastify.get('/version', async (_request, reply) => {
    return reply.send({
      latestVersion: '1.0.1',
      versionCode: 101,
      downloadUrl: 'https://uschat.ruptyl.space/api/v1/app/download',
      releaseNotes: '⚡ USCHAT v1.0.1 Release:\n- Added Message Reactions\n- Call screen displays caller display name instead of room UUID\n- Default voice call noise suppression',
      forceUpdate: false,
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
