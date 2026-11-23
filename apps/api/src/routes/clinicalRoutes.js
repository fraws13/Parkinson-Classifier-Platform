import { Router } from 'express';
import { requireDoctor } from '../middleware/auth.js';

export function createClinicalRoutes(controller, authenticated) {
  const router = Router();
  router.use(authenticated, requireDoctor);
  router.get('/patients', controller.listPatients);
  router.post('/patients', controller.createPatient);
  router.get('/patients/:id', controller.getPatient);
  router.post('/patients/:id/assessments', controller.createAssessment);
  router.post('/patients/:id/assessments/:assessmentId/predict', controller.predict);
  return router;
}
