import { buildApp } from './app';
import { config } from './config';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`⚡ USCHAT Backend Server running at http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
