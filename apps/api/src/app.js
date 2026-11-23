import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createTelemetry } from './telemetry/metrics.js';
import { observeApi } from './telemetry/middleware.js';
import { createAuthenticated } from './middleware/auth.js';
import { requireTrustedOrigin } from './middleware/security.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { createAuthService } from './services/authService.js';
import { createAdminService } from './services/adminService.js';
import { createDashboardService } from './services/dashboardService.js';
import { createClinicalService } from './services/clinicalService.js';
import { createAuthController } from './controllers/authController.js';
import { createAdminController } from './controllers/adminController.js';
import { createClinicalController } from './controllers/clinicalController.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createClinicalRoutes } from './routes/clinicalRoutes.js';
import { createHealthRoutes } from './routes/healthRoutes.js';
import { createInferenceService } from './services/inferenceService.js';

export function createApp({ db, telemetry = createTelemetry(), inference = createInferenceService(), appOrigin = process.env.APP_ORIGIN || 'http://localhost:5173', production = process.env.NODE_ENV === 'production' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.use('/api', observeApi(telemetry));
  app.use('/api', requireTrustedOrigin(appOrigin));
  app.use(express.json({ limit: '32kb' }));

  // Compose dependencies once, keeping database and telemetry injectable in tests.
  const authService = createAuthService(db);
  const authenticated = createAuthenticated(authService);
  const authController = createAuthController(authService, { production });
  const adminController = createAdminController(createAdminService(db), createDashboardService(db, telemetry));
  const clinicalController = createClinicalController(createClinicalService(db, inference));

  app.use('/api', createHealthRoutes(db));
  app.use('/api/auth', createAuthRoutes(authController, authenticated));
  app.use('/api/admin', createAdminRoutes(adminController, authenticated));
  app.use('/api/clinical', createClinicalRoutes(clinicalController, authenticated));
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}
