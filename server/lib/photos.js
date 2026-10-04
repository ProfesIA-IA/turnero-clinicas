import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { query } from '../db/pool.js';
import { deleteObject, readObject, saveObject } from './objectStore.js';

const TABLES = {
  professionals: 'professionals',
  services: 'services',
  users: 'users',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new Error('La foto tiene que ser una imagen'));
  },
});

export function mountPhotos(router, kind) {
  const table = TABLES[kind];
  router.get('/:id/photo', async (req, res, next) => {
    try {
      const result = await query(`SELECT photo FROM ${table} WHERE id = $1`, [req.params.id]);
      if (!result.rowCount || !result.rows[0].photo) return res.status(404).json({ error: 'Sin foto' });
      const body = await readObject(result.rows[0].photo);
      if (!body) return res.status(404).json({ error: 'Sin foto' });
      const ext = path.extname(result.rows[0].photo).toLowerCase();
      const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
      res.setHeader('Content-Type', types[ext] || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      body.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/photo', (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) return next(err);
      savePhoto(table, req, res, next).catch(next);
    });
  });
}

async function savePhoto(table, req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Elegí una imagen' });
    const current = await query(`SELECT photo FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'No encontrado' });
    const key = `${randomUUID()}${path.extname(req.file.originalname || '').slice(0, 8) || '.jpg'}`;
    await saveObject(key, req.file.buffer, req.file.mimetype);
    if (current.rows[0].photo) await deleteObject(current.rows[0].photo);
    await query(`UPDATE ${table} SET photo = $1 WHERE id = $2`, [key, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
