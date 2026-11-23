import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const focusable = () => [...dialog.querySelectorAll('button, input, select, [tabindex="0"]')].filter(e => !e.disabled);
    focusable()[0]?.focus();
    function key(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = focusable();
        if (event.shiftKey && document.activeElement === elements[0]) {
          event.preventDefault(); elements.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
          event.preventDefault(); elements[0]?.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button close" aria-label="Chiudi" onClick={onClose}><X size={20} /></button>
        <div className="eyebrow">CLINICAL WORKSPACE</div>
        <h2 id="modal-title">{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
