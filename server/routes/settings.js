import { Router } from 'express';
import { query } from '../db/pool.js';
import { getClinicSettings } from '../lib/availability.js';
import { bookingFields as normalizeBookingFields } from '../lib/bookingFields.js';
import { formFields as normalizeFormFields } from '../lib/formFields.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await getClinicSettings();
    res.json({
      data: {
        ...data,
        booking_fields: normalizeBookingFields(data.booking_fields),
        form_fields: normalizeFormFields(data.form_fields),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const current = await getClinicSettings();
    const {
      name = current.name,
      timezone = current.timezone,
      startHour = current.start_hour,
      endHour = current.end_hour,
      slotIntervalMin = current.slot_interval_min,
      weekStartsOn = current.week_starts_on,
      bookingFields: incomingFields,
      bookingIntro = current.booking_intro || '',
      formFields: incomingFormFields,
    } = req.body || {};
    const fields = normalizeBookingFields(incomingFields ?? current.booking_fields);
    const forms = normalizeFormFields(incomingFormFields ?? current.form_fields);
    const result = await query(
      `UPDATE clinic_settings
       SET name = $1, timezone = $2, start_hour = $3, end_hour = $4,
           slot_interval_min = $5, week_starts_on = $6, booking_fields = $7::jsonb,
           booking_intro = $8, form_fields = $9::jsonb, updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [name, timezone, startHour, endHour, slotIntervalMin, weekStartsOn, JSON.stringify(fields), String(bookingIntro || '').slice(0, 500), JSON.stringify(forms)]
    );
    res.json({ data: { ...result.rows[0], booking_fields: fields, form_fields: forms } });
  } catch (err) {
    next(err);
  }
});

export default router;
