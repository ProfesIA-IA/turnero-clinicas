import { Router } from 'express';
import { query } from '../db/pool.js';
import { uniqueSlug } from '../lib/slug.js';
import { extraObject } from '../lib/extra.js';
import { mountPhotos } from '../lib/photos.js';

const router = Router();
mountPhotos(router, 'services');

async function withProfessionals(service) {
  const pros = await query(
    `
      SELECT p.*
      FROM professionals p
      JOIN professional_services ps ON ps.professional_id = p.id
      WHERE ps.service_id = $1
      ORDER BY p.name
    `,
    [service.id]
  );
  return { ...service, professionals: pros.rows };
}

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM services ORDER BY name');
    const rows = await Promise.all(result.rows.map(withProfessionals));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ data: await withProfessionals(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      code,
      durationMin = 30,
      color,
      price,
      professionalIds = [],
      shareEnabled = true,
      active = true,
      extra,
    } = req.body || {};
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await query(
      `INSERT INTO services (name, code, duration_min, color, price, share_slug, share_enabled, active, extra)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        name,
        code || null,
        durationMin,
        color || '#0b8043',
        price ?? null,
        uniqueSlug(code || name),
        shareEnabled,
        active,
        JSON.stringify(extraObject(extra)),
      ]
    );
    await replaceProfessionals(result.rows[0].id, professionalIds);
    res.status(201).json({ data: await withProfessionals(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Servicio no encontrado' });
    const prev = current.rows[0];
    const {
      name = prev.name,
      code = prev.code,
      durationMin = prev.duration_min,
      color = prev.color,
      price = prev.price,
      shareEnabled = prev.share_enabled,
      active = prev.active,
      professionalIds,
      extra = prev.extra,
    } = req.body || {};
    const result = await query(
      `UPDATE services
       SET name = $1, code = $2, duration_min = $3, color = $4, price = $5,
           share_enabled = $6, active = $7, extra = $8::jsonb, updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [name, code, durationMin, color, price, shareEnabled, active, JSON.stringify(extraObject(extra)), req.params.id]
    );
    if (Array.isArray(professionalIds)) {
      await replaceProfessionals(result.rows[0].id, professionalIds);
    }
    res.json({ data: await withProfessionals(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Servicio no encontrado' });
    const rotate = Boolean(req.body?.rotate);
    const slug = rotate
      ? uniqueSlug(current.rows[0].code || current.rows[0].name, String(Date.now()).slice(-6))
      : current.rows[0].share_slug || uniqueSlug(current.rows[0].name);
    const result = await query(
      `UPDATE services SET share_slug = $1, share_enabled = true, updated_at = now() WHERE id = $2 RETURNING *`,
      [slug, req.params.id]
    );
    res.json({ data: await withProfessionals(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM services WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function replaceProfessionals(serviceId, professionalIds) {
  await query('DELETE FROM professional_services WHERE service_id = $1', [serviceId]);
  for (const professionalId of professionalIds) {
    await query(
      'INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [professionalId, serviceId]
    );
  }
}

export default router;
