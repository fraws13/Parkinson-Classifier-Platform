import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const featureSchema = JSON.parse(readFileSync(new URL('../../../../contracts/feature_schema.json', import.meta.url), 'utf8'));
const fields = Object.fromEntries(featureSchema.feature_names.map(name => [name,
  (name.endsWith('_pct') ? z.number().finite().min(0).max(1) : z.number().finite()).nullable(),
]));
export const features = z.object(fields).strict().refine(value => Object.values(value).some(v => v !== null), 'Inserisci almeno una misura numerica.');
export const newPatient = z.object({
  name: z.string().trim().min(2).max(100),
}).strict();
export const newAssessment = z.object({ features }).strict();
