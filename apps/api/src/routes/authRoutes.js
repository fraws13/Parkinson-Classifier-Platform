import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

export function createAuthRoutes(controller, authenticated) {
  const router = Router();
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Troppi tentativi. Riprova più tardi.' } });
  router.post('/login', loginLimiter, controller.login);
  router.get('/me', authenticated, controller.me);
  router.post('/logout', authenticated, controller.logout);
  return router;
}
