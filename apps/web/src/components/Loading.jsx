import { RefreshCw } from 'lucide-react';

export default function Loading() {
  return <div className="loading"><RefreshCw size={20} className="spin" /> Caricamento del workspace…</div>;
}
