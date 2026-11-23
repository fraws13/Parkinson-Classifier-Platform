import { useCallback, useEffect, useState } from 'react';

export function useLive(load, interval = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setData(await load()); setError(''); }
    catch (err) { setError(err.message); }
  }, [load]);

  useEffect(() => {
    let active = true;
    let timer;
    // Schedule after completion to avoid overlapping requests or stale polling.
    async function tick() {
      try {
        const result = await load();
        if (active) { setData(result); setError(''); }
      } catch (err) { if (active) setError(err.message); }
      if (active) timer = setTimeout(tick, interval);
    }
    tick();
    return () => { active = false; clearTimeout(timer); };
  }, [load, interval]);

  return { data, error, refresh };
}
