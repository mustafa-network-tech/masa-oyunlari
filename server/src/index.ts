import { ENGINE_VERSION } from '@masa/engine';
import { createGameServer } from './server.ts';

const port = Number(process.env.PORT ?? 2567);
const server = await createGameServer({ port });
console.log(`Masa sunucusu ws://localhost:${server.port} adresinde (motor v${ENGINE_VERSION})`);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
