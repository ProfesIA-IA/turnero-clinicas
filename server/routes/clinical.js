import path from 'path';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { recordScope } from '../lib/permissions.js';
import multer from 'multer';
import { query } from '../db/pool.js';
import { getClinicSettings } from '../lib/availability.js';
import { deleteObject, readObject, saveObject } from '../lib/objectStore.js';
import { buildHistoryPdf } from '../lib/historyPdf.js';

const ALLOWED_TYPES = /^(image\/|application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-excel)/;
const FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'select', 'checkbox']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.test(file.mimetype || '')) return cb(null, true);
    cb(Object.assign(new Error('Tipo de archivo no permitido'), { status: 400 }));
  },
});

const router = Router();

router.get('/fields', async (req, res, next) => {
  try {
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : null;
    const professionalId = req.query.professionalId ? Number(req.query.professionalId) : null;
    const params = [];
    let sql = `
      SELECT f.*,
             CASE
               WHEN f.owner_type = 'service' THEN s.name
               ELSE p.name
             END AS owner_name
      FROM clinical_field_defs f
      LEFT JOIN services s ON f.owner_type = 'service' AND s.id = f.owner_id
      LEFT JOIN professionals p ON f.owner_type = 'professional' AND p.id = f.owner_id
    `;
    if (serviceId || professionalId) {
      const clauses = [];
      if (serviceId) {
        params.push(serviceId);
        clauses.push(`(f.owner_type = 'service' AND f.owner_id = $${params.length})`);
      }
      if (professionalId) {
        params.push(professionalId);
        clauses.push(`(f.owner_type = 'professional' AND f.owner_id = $${params.length})`);
      }
      sql += ` WHERE ${clauses.join(' OR ')}`;
    }
    sql += ' ORDER BY f.owner_type, f.sort_order, f.id';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/fields', async (req, res, next) => {
  try {
    const body = parseFieldBody(req.body);
    const result = await query(
      `INSERT INTO clinical_field_defs (owner_type, owner_id, label, field_type, options, required, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING *`,
      [body.ownerType, body.ownerId, body.label, body.fieldType, JSON.stringify(body.options), body.required, body.sortOrder]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/fields/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM clinical_field_defs WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Campo no encontrado' });
    const prev = current.rows[0];
    const body = parseFieldBody({
      ownerType: prev.owner_type,
      ownerId: prev.owner_id,
      label: req.body?.label ?? prev.label,
      fieldType: req.body?.fieldType ?? prev.field_type,
      options: req.body?.options ?? prev.options,
      required: req.body?.required ?? prev.required,
      sortOrder: req.body?.sortOrder ?? prev.sort_order,
    });
    const result = await query(
      `UPDATE clinical_field_defs
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

router.delete('/fields/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM clinical_field_defs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function denyOtherPatient(req, res) {
  const scope = recordScope(req.user);
  if (scope?.patientId != null && Number(req.params.patientId) !== scope.patientId) {
    res.status(404).json({ error: 'Paciente no encontrado' });
    return true;
  }
  return false;
}

router.get('/patients/:patientId/notes', async (req, res, next) => {
  try {
    if (denyOtherPatient(req, res)) return;
    const patient = await query('SELECT id FROM patients WHERE id = $1', [req.params.patientId]);
    if (!patient.rowCount) return res.status(404).json({ error: 'Paciente no encontrado' });
    const notes = await query(
      `${noteSelect()} WHERE n.patient_id = $1 ORDER BY n.created_at DESC`,
      [req.params.patientId]
    );
    res.json({ data: await attachFiles(notes.rows) });
  } catch (err) {
    next(err);
  }
});

router.get('/patients/:patientId/export', async (req, res, next) => {
  try {
    if (denyOtherPatient(req, res)) return;
    const patient = await query('SELECT * FROM patients WHERE id = $1', [req.params.patientId]);
    if (!patient.rowCount) return res.status(404).json({ error: 'Paciente no encontrado' });
    const notes = await query(
      `${noteSelect()} WHERE n.patient_id = $1 ORDER BY n.created_at DESC`,
      [req.params.patientId]
    );
    const settings = await getClinicSettings();
    const rows = await attachFiles(notes.rows);
    const images = await noteImages(rows);
    const pdf = await buildHistoryPdf({ patient: patient.rows[0], notes: rows, settings, images });
    const slug = slugifyName(patient.rows[0].name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="historia-clinica-${slug}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.post('/patients/:patientId/notes', async (req, res, next) => {
  try {
    if (denyOtherPatient(req, res)) return;
    const patient = await query('SELECT id FROM patients WHERE id = $1', [req.params.patientId]);
    if (!patient.rowCount) return res.status(404).json({ error: 'Paciente no encontrado' });
    const payload = await buildNotePayload(req.body, Number(req.params.patientId));
    const result = await query(
      `INSERT INTO clinical_notes
        (patient_id, appointment_id, professional_id, service_id, details, custom_values)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        payload.patientId,
        payload.appointmentId,
        payload.professionalId,
        payload.serviceId,
        payload.details,
        JSON.stringify(payload.customValues),
      ]
    );
    res.status(201).json({ data: await getNote(result.rows[0].id) });
  } catch (err) {
    next(err);
  }
});

router.put('/notes/:id', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM clinical_notes WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Entrada no encontrada' });
    const payload = await buildNotePayload(
      {
        ...current.rows[0],
        ...req.body,
        appointmentId:
          req.body?.appointmentId !== undefined ? req.body.appointmentId : current.rows[0].appointment_id,
        details: req.body?.details !== undefined ? req.body.details : current.rows[0].details,
        customValues: req.body?.customValues ?? req.body?.custom_values ?? current.rows[0].custom_values,
      },
      current.rows[0].patient_id
    );
    await query(
      `UPDATE clinical_notes
       SET appointment_id = $1, professional_id = $2, service_id = $3, details = $4,
           custom_values = $5::jsonb, updated_at = now()
       WHERE id = $6`,
      [
        payload.appointmentId,
        payload.professionalId,
        payload.serviceId,
        payload.details,
        JSON.stringify(payload.customValues),
        req.params.id,
      ]
    );
    res.json({ data: await getNote(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/notes/:id', async (req, res, next) => {
  try {
    const files = await query('SELECT stored_name FROM clinical_files WHERE note_id = $1', [req.params.id]);
    await query('DELETE FROM clinical_notes WHERE id = $1', [req.params.id]);
    for (const file of files.rows) await deleteObject(file.stored_name);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/notes/:id/files', (req, res, next) => {
  upload.array('files', 8)(req, res, (err) => {
    if (err) return next(err);
    addFiles(req, res, next).catch(next);
  });
});

router.get('/files/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM clinical_files WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Archivo no encontrado' });
    const file = result.rows[0];
    const body = await readObject(file.stored_name);
    if (!body) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    body.pipe(res);
  } catch (err) {
    next(err);
  }
});

router.delete('/files/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM clinical_files WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Archivo no encontrado' });
    await query('DELETE FROM clinical_files WHERE id = $1', [req.params.id]);
    await deleteObject(result.rows[0].stored_name);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function addFiles(req, res, _next) {
  const note = await query('SELECT id FROM clinical_notes WHERE id = $1', [req.params.id]);
  if (!note.rowCount) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }
  const saved = [];
  for (const file of req.files || []) {
    const key = `${randomUUID()}${path.extname(file.originalname || '').slice(0, 12)}`;
    await saveObject(key, file.buffer, file.mimetype);
    const result = await query(
      `INSERT INTO clinical_files (note_id, original_name, stored_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, original_name, mime_type, size_bytes, created_at`,
      [req.params.id, file.originalname, key, file.mimetype, file.size]
    );
    saved.push(result.rows[0]);
  }
  res.status(201).json({ data: saved });
}

function noteSelect() {
  return `
    SELECT n.*,
           CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object(
             'id', a.id,
             'starts_at', a.starts_at,
             'ends_at', a.ends_at,
             'status', a.status
           ) END AS appointment,
           CASE WHEN pr.id IS NULL THEN NULL ELSE json_build_object(
             'id', pr.id, 'name', pr.name, 'color', pr.color
           ) END AS professional,
           CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object(
             'id', s.id, 'name', s.name
           ) END AS service
    FROM clinical_notes n
    LEFT JOIN appointments a ON a.id = n.appointment_id
    LEFT JOIN professionals pr ON pr.id = n.professional_id
    LEFT JOIN services s ON s.id = n.service_id
  `;
}

async function getNote(id) {
  const result = await query(`${noteSelect()} WHERE n.id = $1`, [id]);
  if (!result.rowCount) return null;
  const [note] = await attachFiles(result.rows);
  return note;
}

async function attachFiles(notes) {
  if (!notes.length) return notes;
  const ids = notes.map((row) => row.id);
  const files = await query(
    `SELECT id, note_id, original_name, mime_type, size_bytes, created_at
     FROM clinical_files
     WHERE note_id = ANY($1::int[])
     ORDER BY id`,
    [ids]
  );
  const byNote = new Map(notes.map((note) => [note.id, []]));
  for (const file of files.rows) byNote.get(file.note_id)?.push(file);
  return notes.map((note) => ({ ...note, files: byNote.get(note.id) || [] }));
}

async function buildNotePayload(body, patientId) {
  let appointmentId = body.appointmentId ?? body.appointment_id ?? null;
  let professionalId = body.professionalId ?? body.professional_id ?? null;
  let serviceId = body.serviceId ?? body.service_id ?? null;
  if (appointmentId) {
    const appointment = await query(
      'SELECT id, patient_id, professional_id, service_id FROM appointments WHERE id = $1',
      [appointmentId]
    );
    if (!appointment.rowCount) {
      const err = new Error('Turno no encontrado');
      err.status = 404;
      throw err;
    }
    const row = appointment.rows[0];
    if (Number(row.patient_id) !== Number(patientId)) {
      const err = new Error('Ese turno no pertenece a este paciente');
      err.status = 400;
      throw err;
    }
    professionalId = row.professional_id;
    serviceId = row.service_id;
  }
  professionalId = professionalId ? Number(professionalId) : null;
  serviceId = serviceId ? Number(serviceId) : null;
  appointmentId = appointmentId ? Number(appointmentId) : null;
  const details = String(body.details || '').trim();
  const customValues = await snapshotCustom(professionalId, serviceId, body.customValues || body.custom_values || []);
  return { patientId, appointmentId, professionalId, serviceId, details, customValues };
}

async function snapshotCustom(professionalId, serviceId, incoming) {
  const fields = await loadFields(professionalId, serviceId);
  const incomingMap = new Map();
  if (Array.isArray(incoming)) {
    for (const item of incoming) incomingMap.set(String(item.id), item.value);
  } else if (incoming && typeof incoming === 'object') {
    for (const [key, value] of Object.entries(incoming)) incomingMap.set(String(key), value);
  }
  const snapshot = [];
  for (const field of fields) {
    const raw = incomingMap.has(String(field.id)) ? incomingMap.get(String(field.id)) : '';
    const value = field.field_type === 'checkbox' ? Boolean(raw) : String(raw ?? '').trim();
    if (field.required && (value === '' || value === false)) {
      const err = new Error(`${field.label} es obligatorio`);
      err.status = 400;
      throw err;
    }
    snapshot.push({
      id: field.id,
      label: field.label,
      field_type: field.field_type,
      owner_type: field.owner_type,
      value,
    });
  }
  return snapshot;
}

async function loadFields(professionalId, serviceId) {
  const clauses = [];
  const params = [];
  if (serviceId) {
    params.push(serviceId);
    clauses.push(`(owner_type = 'service' AND owner_id = $${params.length})`);
  }
  if (professionalId) {
    params.push(professionalId);
    clauses.push(`(owner_type = 'professional' AND owner_id = $${params.length})`);
  }
  if (!clauses.length) return [];
  const result = await query(
    `SELECT * FROM clinical_field_defs WHERE ${clauses.join(' OR ')} ORDER BY owner_type, sort_order, id`,
    params
  );
  return result.rows;
}

function parseFieldBody(body = {}) {
  const ownerType = body.ownerType || body.owner_type;
  const ownerId = Number(body.ownerId ?? body.owner_id);
  const label = String(body.label || '').trim();
  const fieldType = String(body.fieldType || body.field_type || 'text');
  if (!['service', 'professional'].includes(ownerType) || !ownerId) {
    const err = new Error('Indicá si el campo es de un servicio o un profesional');
    err.status = 400;
    throw err;
  }
  if (!label) {
    const err = new Error('El nombre del campo es obligatorio');
    err.status = 400;
    throw err;
  }
  if (!FIELD_TYPES.has(fieldType)) {
    const err = new Error('Tipo de campo inválido');
    err.status = 400;
    throw err;
  }
  let options = body.options || [];
  if (typeof options === 'string') {
    options = options.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(options)) options = [];
  return {
    ownerType,
    ownerId,
    label,
    fieldType,
    options,
    required: Boolean(body.required),
    sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0) || 0,
  };
}


async function noteImages(notes) {
  const images = new Map();
  const ids = notes.flatMap((note) => (note.files || []).map((file) => file.id));
  if (!ids.length) return images;
  const files = await query(
    `SELECT id, stored_name, mime_type FROM clinical_files WHERE id = ANY($1::int[])`,
    [ids]
  );
  for (const file of files.rows) {
    if (!String(file.mime_type || '').startsWith('image/')) continue;
    if (!/jpeg|jpg|png/.test(file.mime_type)) continue;
    const body = await readObject(file.stored_name);
    if (!body) continue;
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    images.set(file.id, Buffer.concat(chunks));
  }
  return images;
}

function renderHistoryHtml(patient, notes, settings) {
  const tz = settings?.timezone || 'America/Argentina/Buenos_Aires';
  const clinic = escapeHtml(settings?.name || 'Clínica');
  const entries = notes
    .map((note) => {
      const custom = (note.custom_values || [])
        .filter((item) => item.value !== '' && item.value !== false)
        .map(
          (item) =>
            `<div><span>${escapeHtml(item.label)}:</span> ${escapeHtml(
              item.field_type === 'checkbox' ? 'Sí' : String(item.value ?? '')
            )}</div>`
        )
        .join('');
      const files = (note.files || []).map((file) => escapeHtml(file.original_name)).join(', ');
      const heading = [note.service?.name || 'Atención', note.professional?.name].filter(Boolean).join(' · ');
      const turno = note.appointment?.starts_at ? `Turno ${formatWhen(note.appointment.starts_at, tz)} · ` : '';
      return `<article>
        <h2>${escapeHtml(heading)}</h2>
        <p class="meta">${escapeHtml(`${turno}Cargada ${formatWhen(note.created_at, tz)}`)}</p>
        ${note.details ? `<p>${escapeHtml(note.details).replace(/\n/g, '<br>')}</p>` : ''}
        ${custom ? `<div class="fields">${custom}</div>` : ''}
        ${files ? `<p class="meta">Archivos: ${files}</p>` : ''}
      </article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Historia clínica · ${escapeHtml(patient.name)}</title>
  <style>
    body { font-family: Georgia, serif; color: #222; max-width: 780px; margin: 32px auto; padding: 0 20px; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 13px; }
    article { border-top: 1px solid #ddd; padding: 16px 0; }
    .fields { margin-top: 8px; font-size: 14px; }
  </style>
</head>
<body>
  <p class="meta">${clinic}</p>
  <h1>Historia clínica</h1>
  <p>${escapeHtml(patient.name)}</p>
  <p class="meta">${escapeHtml([patient.phone, patient.email].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</p>
  ${entries || '<p class="meta">Sin entradas.</p>'}
</body>
</html>`;
}

function formatWhen(value, tz) {
  try {
    return new Date(value).toLocaleString('es-AR', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifyName(value) {
  return (
    String(value || 'paciente')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'paciente'
  );
}

export default router;
