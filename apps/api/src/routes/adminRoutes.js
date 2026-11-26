import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';

export function createAdminRoutes(controller, authenticated) {
  const router = Router();
  router.use(authenticated, requireAdmin);
  router.get('/dashboard', controller.dashboard);
  router.get('/doctors', controller.listDoctors);
  router.post('/doctors', controller.registerDoctor);
  router.delete('/doctors/:id', controller.deleteDoctor);
  router.get('/patients', controller.listPatients);
  router.post('/patients/:id/transfer', controller.transferPatient);
  return router;
}
