import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createDb } from './db/prisma.js';
import { createApp } from './app.js';

const db = createDb();
await db.$queryRaw`PRAGMA journal_mode = WAL`;
await db.$executeRawUnsafe('PRAGMA busy_timeout = 5000');
const app = createApp({ db });
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('/{*path}', (req, res) => res.sendFile(`${webDist}/index.html`));
}
const server = app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => {
  console.log(`Clinical API: http://localhost:${process.env.PORT || 3001}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(async () => { await db.$disconnect(); process.exit(0); }));
}
