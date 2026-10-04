import { useEffect, useState } from 'react';
import { getToken } from '../api';

export function EntityPhoto({ kind, id, hasPhoto, src, fallback, className = 'h-10 w-10' }) {
  const [url, setUrl] = useState('');
  const path = src || (kind && id ? `/api/${kind}/${id}/photo` : '');

  useEffect(() => {
    if (!hasPhoto || !path) return undefined;
    let active = true;
    let objectUrl = '';
    fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, hasPhoto]);

  if (url) {
    return <img src={url} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  return fallback;
}

export function PhotoField({ kind, id, hasPhoto, src, file, onFile, readOnly = false }) {
  const [localUrl, setLocalUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setLocalUrl('');
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setLocalUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <label className="field">
      <span>Foto</span>
      <div className="flex items-center gap-3">
        {localUrl ? (
          <img src={localUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <EntityPhoto
            kind={kind}
            id={id}
            src={src}
            hasPhoto={hasPhoto}
            className="h-16 w-16"
            fallback={<span className="grid h-16 w-16 place-items-center rounded-full bg-[#f1f3f4] text-xs text-[#70757a]">Foto</span>}
          />
        )}
        {!readOnly && <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />}
      </div>
    </label>
  );
}
