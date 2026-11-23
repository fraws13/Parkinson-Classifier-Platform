import { Router } from 'express';

export function createHealthRoutes(db) {
  const router = Router();
  router.get('/health', async (req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'sqlite', inference: 'external_service_not_probed' });
  });
  return router;
}
