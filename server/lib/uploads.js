import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const uploadDir = resolveUploadDir();

function resolveUploadDir() {
  if (config.uploadDir) return config.uploadDir;
  if (fs.existsSync('/data')) return '/data/uploads';
  return path.join(rootDir, 'uploads');
}

export function ensureUploadDir() {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export function filePath(storedName) {
  const safe = path.basename(String(storedName || ''));
  if (!safe || safe !== storedName) {
    const err = new Error('Archivo inválido');
    err.status = 400;
    throw err;
  }
  return path.join(uploadDir, safe);
}
