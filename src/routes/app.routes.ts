import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

export async function appRoutes(fastify: FastifyInstance) {
  // Check latest application version & metadata
  fastify.get('/version', async (_request, reply) => {
    return reply.send({
      latestVersion: '2.6.0',
      versionCode: 260,
      downloadUrl: 'https://uschat.ruptyl.space/uploads/uschat.apk',
      releaseNotes: '⚡ USCHAT v2.6.0 Release:\n- Native notification system overhaul\n- Full-screen incoming voice & video call overlay\n- Custom ringtone & multi-pulse vibration alerts\n- In-app Auto Update engine\n- Performance & stability improvements',
      forceUpdate: false,
    });
  });

  // Direct APK download route
  fastify.get('/download', async (_request, reply) => {
    const apkPath = path.join(config.localStorageDir, 'uschat.apk');
    if (!fs.existsSync(apkPath)) {
      return reply.status(404).send({ error: 'Not Found', message: 'USCHAT APK package not found on server' });
    }

    return reply.header('Content-Type', 'application/vnd.android.package-archive')
      .header('Content-Disposition', 'attachment; filename="uschat.apk"')
      .sendFile('uschat.apk');
  });
}
