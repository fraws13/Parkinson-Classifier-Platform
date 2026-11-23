import { z } from 'zod';

export const newDoctor = z.object({
  email: z.email().max(254).transform(s => s.toLowerCase()),
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/).transform(s => s.toLowerCase()).optional(),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(100),
}).strict();

export const patientTransfer = z.object({
  toDoctorId: z.string().min(1),
  expectedDoctorId: z.string().min(1),
}).strict();
