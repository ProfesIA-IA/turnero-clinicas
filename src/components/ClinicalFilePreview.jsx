import { useEffect, useState } from 'react';
import { getToken } from '../api';

export function LocalImagePreview({ file }) {
  const [url, setUrl] = useState('');
  const isImage = String(file.type || '').startsWith('image/');

  useEffect(() => {
    if (!isImage) return undefined;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file, isImage]);

  if (!isImage) {
    return <div className="max-w-40 truncate rounded-lg border border-[#dadce0] px-3 py-2 text-xs">{file.name}</div>;
  }
  if (!url) return null;
  return <img src={url} alt={file.name} className="h-24 w-24 rounded-lg border border-[#dadce0] object-cover" />;
}

export function StoredImagePreview({ file }) {
  const isImage = String(file.mime_type || file.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.original_name || '');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!isImage) return undefined;
    let active = true;
    let objectUrl = '';
    fetch(`/api/clinical/files/${file.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo abrir la imagen');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, isImage]);

  if (!isImage) return null;
  return (
    <a href={url || undefined} target="_blank" rel="noreferrer" className="block">
      {url ? (
        <img src={url} alt={file.original_name} className="h-24 w-24 rounded-lg border border-[#dadce0] object-cover" />
      ) : (
        <div className="h-24 w-24 rounded-lg bg-[#f1f3f4]" />
      )}
    </a>
  );
}
