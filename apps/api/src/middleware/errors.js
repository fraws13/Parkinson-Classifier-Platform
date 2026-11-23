import { z } from 'zod';

export function apiNotFound(req, res) {
  res.status(404).json({ error: 'Endpoint non trovato.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.status === 503) return res.status(503).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Dati non validi.', fields: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  if (error.code === 'P2002') return res.status(409).json({ error: 'Esiste già un account con questa email o il vincolo di unicità non è rispettato.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Richiesta troppo grande.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON non valido.' });
  console.error('API error:', error.code || error.name);
  res.status(500).json({ error: 'Errore interno. Riprova più tardi.' });
}
