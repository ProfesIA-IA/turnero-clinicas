import { Router } from 'express';
import { query } from '../db/pool.js';

const ENTITIES = new Set(['patient', 'professional', 'service', 'user']);
const TYPES = new Set(['text', 'textarea', 'number', 'date', 'select', 'checkbox']);
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let sql = 'SELECT * FROM extra_field_defs';
    if (req.query.entity) {
      if (!ENTITIES.has(req.query.entity)) return res.status(400).json({ error: 'Entidad inválida' });
      params.push(req.query.entity);
      sql += ' WHERE entity = $1';
    }
    sql += ' ORDER BY entity, sort_order, id';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = parseBody(req.body);
    const result = await query(
      `INSERT INTO extra_field_defs (entity, label, field_type, options, required, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [body.entity, body.label, body.fieldType, JSON.stringify(body.options), body.required, body.sortOrder]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM extra_field_defs WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Campo no encontrado' });
    const prev = current.rows[0];
    const body = parseBody({
      entity: prev.entity,
      label: req.body?.label ?? prev.label,
      fieldType: req.body?.fieldType ?? prev.field_type,
      options: req.body?.options ?? prev.options,
      required: req.body?.required ?? prev.required,
      sortOrder: req.body?.sortOrder ?? prev.sort_order,
    });
    const result = await query(
      `UPDATE extra_field_defs
       SET label = $1, field_type = $2, options = $3::jsonb, required = $4, sort_order = $5
       WHERE id = $6
       RETURNING *`,
      [body.label, body.fieldType, JSON.stringify(body.options), body.required, body.sortOrder, req.params.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM extra_field_defs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function parseBody(body) {
  const entity = String(body?.entity || '');
  const label = String(body?.label || '').trim();
  const fieldType = String(body?.fieldType || 'text');
  if (!ENTITIES.has(entity)) {
    const err = new Error('Entidad inválida');
    err.status = 400;
    throw err;
  }
  if (!label) {
    const err = new Error('El nombre del campo es obligatorio');
    err.status = 400;
    throw err;
  }
  if (!TYPES.has(fieldType)) {
    const err = new Error('Tipo de campo inválido');
    err.status = 400;
    throw err;
  }
  const options = Array.isArray(body?.options)
    ? body.options.map((item) => String(item).trim()).filter(Boolean)
    : String(body?.options || '').split(',').map((item) => item.trim()).filter(Boolean);
  return {
    entity,
    label,
    fieldType,
    options,
    required: Boolean(body?.required),
    sortOrder: Number(body?.sortOrder) || 0,
  };
}

export default router;
