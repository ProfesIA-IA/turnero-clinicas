import { Router } from 'express';
import { query } from '../db/pool.js';
import { uniqueSlug } from '../lib/slug.js';
import { extraObject } from '../lib/extra.js';
import { mountPhotos } from '../lib/photos.js';

const router = Router();
mountPhotos(router, 'professionals');

async function withServices(professional) {
  const services = await query(
    `
      SELECT s.*
      FROM services s
      JOIN professional_services ps ON ps.service_id = s.id
      WHERE ps.professional_id = $1
      ORDER BY s.name
    `,
    [professional.id]
  );
  const schedules = await query(
    'SELECT * FROM schedules WHERE professional_id = $1 ORDER BY weekday, start_time',
    [professional.id]
  );
  return { ...professional, services: services.rows, schedules: schedules.rows };
}

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM professionals ORDER BY name');
    const rows = await Promise.all(result.rows.map(withServices));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM professionals WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Profesional no encontrado' });
    res.json({ data: await withServices(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, code, email, phone, color, bio, serviceIds = [], shareEnabled = true, active = true, extra } = req.body || {};
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const slug = uniqueSlug(code || name);
    const result = await query(
      `INSERT INTO professionals (name, code, email, phone, color, bio, share_slug, share_enabled, active, extra)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING *`,
      [name, code || null, email || null, phone || null, color || '#1a73e8', bio || null, slug, shareEnabled, active, JSON.stringify(extraObject(extra))]
    );
    await replaceServices(result.rows[0].id, serviceIds);
    res.status(201).json({ data: await withServices(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM professionals WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Profesional no encontrado' });
    const prev = current.rows[0];
    const {
      name = prev.name,
      code = prev.code,
      email = prev.email,
      phone = prev.phone,
      color = prev.color,
      bio = prev.bio,
      shareEnabled = prev.share_enabled,
      active = prev.active,
      serviceIds,
      extra = prev.extra,
    } = req.body || {};
    const result = await query(
      `UPDATE professionals
       SET name = $1, code = $2, email = $3, phone = $4, color = $5, bio = $6,
           share_enabled = $7, active = $8, extra = $9::jsonb, updated_at = now()
       WHERE id = $10
       RETURNING *`,
      [name, code, email, phone, color, bio, shareEnabled, active, JSON.stringify(extraObject(extra)), req.params.id]
    );
    if (Array.isArray(serviceIds)) {
      await replaceServices(result.rows[0].id, serviceIds);
    }
    res.json({ data: await withServices(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM professionals WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Profesional no encontrado' });
    const rotate = Boolean(req.body?.rotate);
    const slug = rotate
      ? uniqueSlug(current.rows[0].code || current.rows[0].name, String(Date.now()).slice(-6))
      : current.rows[0].share_slug || uniqueSlug(current.rows[0].name);
    const result = await query(
      `UPDATE professionals
       SET share_slug = $1, share_enabled = true, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [slug, req.params.id]
    );
    res.json({ data: await withServices(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM professionals WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function replaceServices(professionalId, serviceIds) {
  await query('DELETE FROM professional_services WHERE professional_id = $1', [professionalId]);
  for (const serviceId of serviceIds) {
    await query(
      'INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [professionalId, serviceId]
    );
  }
}

export default router;
