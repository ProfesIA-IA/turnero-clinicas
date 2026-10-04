import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const RESEND_URL = 'https://api.resend.com/emails';
const SANDBOX_FROM = 'Turnero <onboarding@resend.dev>';

export async function sendMail({ to, subject, text }) {
  if (!config.resendApiKey) return { skipped: true };
  const recipient = resolveRecipient(to);
  if (!recipient) return { skipped: true };
  const redirected = recipient !== to;
  const body = redirected
    ? `${text}\n\nEste mensaje se envió a ${recipient} porque el envío está en modo de prueba.${to ? `\nDestinatario original: ${to}` : ''}`
    : text;
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom || SANDBOX_FROM,
      to: [recipient],
      subject,
      text: body,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`No se pudo enviar el email (${res.status})`);
    err.detail = detail;
    throw err;
  }
  return res.json();
}

export async function sendAppointmentEmail(appointment) {
  const patientEmail = appointment?.patient?.email;
  if (!patientEmail) return { skipped: true };
  const when = formatInTimeZone(new Date(appointment.starts_at), config.clinicTimezone, "EEEE d 'de' MMMM, HH:mm", {
    locale: es,
  });
  const clinic = config.clinicName || 'la clínica';
  const subject = `Turno reservado · ${appointment.service?.name || clinic}`;
  const text = [
    `Hola ${appointment.patient?.name || ''},`,
    '',
    `Tu turno en ${clinic} quedó reservado.`,
    `Cuándo: ${when}`,
    `Profesional: ${appointment.professional?.name || '—'}`,
    `Servicio: ${appointment.service?.name || '—'}`,
  ].join('\n');
  return sendMail({ to: patientEmail, subject, text });
}

export async function notifyUsersOfAppointment(appointment) {
  const result = await query(
    `SELECT name, email, role FROM users
     WHERE active = true AND email IS NOT NULL AND email <> ''
       AND (
         (role = 'paciente' AND patient_id = $1)
         OR (role = 'profesional' AND professional_id = $2)
         OR role = 'secretaria'
       )`,
    [appointment.patient_id || null, appointment.professional_id]
  );
  const when = formatInTimeZone(new Date(appointment.starts_at), config.clinicTimezone, "EEEE d 'de' MMMM, HH:mm", {
    locale: es,
  });
  const clinic = config.clinicName || 'la clínica';
  await Promise.all(
    result.rows.map((user) =>
      sendMail({
        to: user.email,
        subject: `Nuevo turno agendado · ${clinic}`,
        text: [
          `Hola ${user.name},`,
          '',
          'Se agendó un turno nuevo.',
          `Paciente: ${appointment.patient?.name || '—'}`,
          `Cuándo: ${when}`,
          `Profesional: ${appointment.professional?.name || '—'}`,
          `Servicio: ${appointment.service?.name || '—'}`,
        ].join('\n'),
      }).catch((err) => {
        console.error('Aviso de turno no enviado:', err.message);
      })
    )
  );
}

export async function sendPasswordCredentials(user, password, loginUrl) {
  const clinic = config.clinicName || 'Turnero';
  return sendMail({
    to: user.email,
    subject: `Tu acceso a ${clinic}`,
    text: [
      `Hola ${user.name},`,
      '',
      `Ya podés entrar a ${clinic}.`,
      loginUrl ? `Ingreso: ${loginUrl}` : null,
      `Usuario: ${user.username}`,
      `Contraseña: ${password}`,
    ]
      .filter((line) => line != null)
      .join('\n'),
  });
}

export async function sendPasswordLink(user, link) {
  const clinic = config.clinicName || 'Turnero';
  return sendMail({
    to: user.email,
    subject: `Definí tu contraseña · ${clinic}`,
    text: [
      `Hola ${user.name},`,
      '',
      `Usá este enlace para definir la contraseña de tu usuario (${user.username}) en ${clinic}:`,
      link,
      '',
      'El enlace vence en 2 horas.',
    ].join('\n'),
  });
}

function resolveRecipient(patientEmail) {
  const sandbox = !config.emailFrom || config.emailFrom.includes('@resend.dev');
  if (sandbox || config.nodeEnv !== 'production') {
    return config.emailDevTo || null;
  }
  return patientEmail || null;
}
