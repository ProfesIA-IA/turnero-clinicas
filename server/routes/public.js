import { Router } from 'express';
import { query } from '../db/pool.js';
import { availabilityForDay, getClinicSettings } from '../lib/availability.js';
import { createAppointment } from './appointments.js';
import { bookingFields, patientFromBooking } from '../lib/bookingFields.js';
import { integrationFlags } from '../config.js';

const router = Router();

router.get('/features', (_req, res) => {
  res.json({ data: integrationFlags() });
});

async function publicProfessional(slug) {
  const result = await query(
    `SELECT id, name, color, bio, share_slug, share_enabled, active
     FROM professionals WHERE share_slug = $1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row || !row.share_enabled || !row.active) return null;
  const services = await query(
    `
      SELECT s.id, s.name, s.duration_min, s.color
      FROM services s
      JOIN professional_services ps ON ps.service_id = s.id
      WHERE ps.professional_id = $1 AND s.active = true
      ORDER BY s.name
    `,
    [row.id]
  );
  return { ...row, kind: 'profesional', services: services.rows };
}

async function publicService(slug) {
  const result = await query(
    `SELECT id, name, color, duration_min, share_slug, share_enabled, active
     FROM services WHERE share_slug = $1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row || !row.share_enabled || !row.active) return null;
  const professionals = await query(
    `
      SELECT p.id, p.name, p.color
      FROM professionals p
      JOIN professional_services ps ON ps.professional_id = p.id
      WHERE ps.service_id = $1 AND p.active = true
      ORDER BY p.name
    `,
    [row.id]
  );
  return { ...row, kind: 'servicio', durationMin: row.duration_min, professionals: professionals.rows };
}

router.get('/profesional/:slug', async (req, res, next) => {
  try {
    const data = await publicProfessional(req.params.slug);
    if (!data) return res.status(404).json({ error: 'Calendario no disponible' });
    const settings = await getClinicSettings();
    res.json({
      data: {
        ...data,
        clinicName: settings.name,
        timezone: settings.timezone,
        bookingFields: bookingFields(settings.booking_fields),
        bookingIntro: settings.booking_intro || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/servicio/:slug', async (req, res, next) => {
  try {
    const data = await publicService(req.params.slug);
    if (!data) return res.status(404).json({ error: 'Calendario no disponible' });
    const settings = await getClinicSettings();
    res.json({
      data: {
        ...data,
        clinicName: settings.name,
        timezone: settings.timezone,
        bookingFields: bookingFields(settings.booking_fields),
        bookingIntro: settings.booking_intro || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/profesional/:slug/slots', async (req, res, next) => {
  try {
    const calendar = await publicProfessional(req.params.slug);
    if (!calendar) return res.status(404).json({ error: 'Calendario no disponible' });
    const serviceId = req.query.serviceId || calendar.services[0]?.id;
    const service = calendar.services.find((item) => String(item.id) === String(serviceId)) || calendar.services[0];
    if (!service) return res.status(400).json({ error: 'Este profesional no tiene servicios' });
    const settings = await getClinicSettings();
    const result = await availabilityForDay({
      dateYmd: req.query.date,
      professionalId: calendar.id,
      serviceId: service.id,
      tz: settings.timezone,
      durationMin: service.duration_min,
      intervalMin: settings.slot_interval_min,
    });
    res.json({ data: { ...result, service } });
  } catch (err) {
    next(err);
  }
});

router.get('/servicio/:slug/slots', async (req, res, next) => {
  try {
    const calendar = await publicService(req.params.slug);
    if (!calendar) return res.status(404).json({ error: 'Calendario no disponible' });
    const settings = await getClinicSettings();
    const result = await availabilityForDay({
      dateYmd: req.query.date,
      serviceId: calendar.id,
      tz: settings.timezone,
      durationMin: calendar.duration_min,
      intervalMin: settings.slot_interval_min,
    });
    res.json({ data: { ...result, service: calendar } });
  } catch (err) {
    next(err);
  }
});

router.post('/profesional/:slug/book', async (req, res, next) => {
  try {
    const calendar = await publicProfessional(req.params.slug);
    if (!calendar) return res.status(404).json({ error: 'Calendario no disponible' });
    const { serviceId, startsAt } = req.body || {};
    const service = calendar.services.find((item) => String(item.id) === String(serviceId)) || calendar.services[0];
    if (!service) return res.status(400).json({ error: 'Servicio inválido' });
    const settings = await getClinicSettings();
    const patient = patientFromBooking(req.body, bookingFields(settings.booking_fields));
    const created = await createAppointment(
      {
        professionalId: calendar.id,
        serviceId: service.id,
        startsAt,
        patient,
        notes: patient.notes,
        status: 'RESERVADO',
      },
      'public'
    );
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.post('/servicio/:slug/book', async (req, res, next) => {
  try {
    const calendar = await publicService(req.params.slug);
    if (!calendar) return res.status(404).json({ error: 'Calendario no disponible' });
    const { professionalId, startsAt } = req.body || {};
    const settings = await getClinicSettings();
    const patient = patientFromBooking(req.body, bookingFields(settings.booking_fields));
    const created = await createAppointment(
      {
        professionalId: professionalId || calendar.professionals[0]?.id,
        serviceId: calendar.id,
        startsAt,
        patient,
        notes: patient.notes,
        status: 'RESERVADO',
      },
      'public'
    );
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

export default router;
