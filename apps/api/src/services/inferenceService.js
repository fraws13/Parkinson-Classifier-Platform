import { z } from 'zod';

const resultSchema = z.object({
  prediction: z.union([z.literal(0), z.literal(1)]),
  label: z.enum(['H', 'PD']),
  model_version: z.string().min(1).refine(value => !value.toLowerCase().includes('stub')),
}).refine(value => (value.prediction === 0 ? 'H' : 'PD') === value.label);

export function createInferenceService(url = process.env.ML_API_URL || 'http://127.0.0.1:8000') {
  return {
    async predict(features) {
      try {
        const response = await fetch(`${url}/predict`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ features }), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('ML unavailable');
        return resultSchema.parse(await response.json());
      } catch {
        const error = new Error('Modello ML non disponibile o risposta non valida. Nessuna classe è stata simulata.');
        error.status = 503;
        throw error;
      }
    },
  };
}
