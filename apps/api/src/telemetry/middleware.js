import { performance } from 'node:perf_hooks';

export function observeApi(telemetry) {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const start = performance.now();
    res.on('finish', () => telemetry.record(performance.now() - start, res.statusCode));
    next();
  };
}
