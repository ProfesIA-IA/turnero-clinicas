import { formatCustomValue, noteHeading, noteMetaLine, visibleCustomValues } from '../lib/clinical';
import { StoredImagePreview } from './ClinicalFilePreview';

export default function ClinicalHistorySummary({
  patient,
  notes = [],
  tz,
  onClose,
  onDownload,
  downloading,
}) {
  return (
    <div className="modal-backdrop stacked" onClick={onClose}>
      <div className="modal-card wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="border-b border-[#dadce0] px-5 py-4">
          <div className="text-lg">Historia clínica · {patient?.name}</div>
          <p className="mt-1 text-sm text-[#70757a]">
            {[patient?.phone, patient?.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
        </div>
        <div className="grid max-h-[min(70vh,560px)] gap-3 overflow-auto px-5 py-4">
          {notes.map((note) => (
            <article key={note.id} className="rounded-xl border border-[#dadce0] p-3">
              <div className="font-medium">{noteHeading(note)}</div>
              <div className="text-sm text-[#70757a]">{noteMetaLine(note, tz)}</div>
              {note.details && <p className="mt-2 whitespace-pre-wrap text-sm">{note.details}</p>}
              {visibleCustomValues(note).length > 0 && (
                <dl className="mt-2 grid gap-1 text-sm">
                  {visibleCustomValues(note).map((item) => (
                    <div key={`${note.id}-${item.id}`} className="flex gap-2">
                      <dt className="text-[#70757a]">{item.label}:</dt>
                      <dd>{formatCustomValue(item)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {note.files?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {note.files.map((file) => (
                    <StoredImagePreview key={file.id} file={file} />
                  ))}
                  <span className="text-sm text-[#70757a]">{note.files.map((file) => file.original_name).join(', ')}</span>
                </div>
              )}
            </article>
          ))}
          {!notes.length && (
            <div className="rounded-xl border border-dashed border-[#dadce0] px-4 py-8 text-center text-sm text-[#70757a]">
              Todavía no hay entradas en la historia clínica.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          {onDownload && (
            <button type="button" className="pill-btn" onClick={onDownload} disabled={downloading}>
              {downloading ? 'Descargando…' : 'Descargar PDF'}
            </button>
          )}
          <button type="button" className="pill-btn primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
