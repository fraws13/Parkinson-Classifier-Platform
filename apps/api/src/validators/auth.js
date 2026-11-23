import { z } from 'zod';

export const credentials = z.object({
  username: z.string().trim().min(1).max(254).transform(s => s.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();
