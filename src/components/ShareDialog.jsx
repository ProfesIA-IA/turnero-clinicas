import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { shareUrl } from '../lib/calendar';

export default function ShareDialog({ open, onClose, kind, item, onRotate }) {
  const [copied, setCopied] = useState(false);
  if (!open || !item?.share_slug) return null;
  const url = shareUrl(kind, item.share_slug);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card max-w-lg" onClick={(ev) => ev.stopPropagation()}>
        <div className="border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-lg font-medium">Compartir calendario</h2>
          <p className="mt-1 text-sm text-[#70757a]">
            Quienes tengan el enlace pueden ver disponibilidad y reservar un turno
            {kind === 'servicio' ? ' de este servicio' : ' con este profesional'}.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-[#dadce0] px-3 py-2">
            <input readOnly className="min-w-0 flex-1 border-0 outline-none" value={url} />
            <button type="button" className="icon-btn" onClick={copy} title="Copiar">
              <Copy size={16} />
            </button>
          </div>
          {copied && <div className="text-sm text-[#0b8043]">Enlace copiado</div>}
          <div className="flex flex-wrap gap-2">
            <a className="pill-btn inline-flex items-center gap-2" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Abrir página pública
            </a>
            <button type="button" className="pill-btn inline-flex items-center gap-2" onClick={onRotate}>
              <RefreshCw size={14} /> Regenerar enlace
            </button>
          </div>
        </div>
        <div className="flex justify-end border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
