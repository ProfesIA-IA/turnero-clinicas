import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const RESEND_URL = 'https://api.resend.com/emails';
const SANDBOX_FROM = 'Turnero <onboarding@resend.dev>';

export async function sendMail({ to, subject, text, html }) {
  if (!config.resendApiKey) return { skipped: true };
  const recipient = resolveRecipient(to);
  if (!recipient) return { skipped: true };
  const redirected = recipient !== to;
  const notice = redirected
    ? `Este mensaje se envió a ${recipient} porque el envío está en modo de prueba.${to ? ` Destinatario original: ${to}.` : ''}`
    : '';
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
      text: notice ? `${text}\n\n${notice}` : text,
      html: notice ? `${html || ''}${noticeBlock(notice)}` : html,
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
  const rows = [
    ['Cuándo', when],
    ['Profesional', appointment.professional?.name || '—'],
    ['Servicio', appointment.service?.name || '—'],
  ];
  const intro = `Hola ${appointment.patient?.name || ''}, tu turno en ${clinic} quedó reservado.`;
  return sendMail({
    to: patientEmail,
    subject,
    text: [intro, ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'),
    html: layout({ clinic, title: 'Turno reservado', intro, rows }),
  });
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
          'Se agendó un turno nuevo.',
          `Paciente: ${appointment.patient?.name || '—'}`,
          `Cuándo: ${when}`,
          `Profesional: ${appointment.professional?.name || '—'}`,
          `Servicio: ${appointment.service?.name || '—'}`,
        ].join('\n'),
        html: layout({
          clinic,
          title: 'Nuevo turno',
          intro: `Hola ${user.name}, se agendó un turno nuevo.`,
          rows: [
            ['Paciente', appointment.patient?.name || '—'],
            ['Cuándo', when],
            ['Profesional', appointment.professional?.name || '—'],
            ['Servicio', appointment.service?.name || '—'],
          ],
        }),
      }).catch((err) => {
        console.error('Aviso de turno no enviado:', err.message);
      })
    )
  );
}

export async function notifyAppointmentUpdated(appointment) {
  const when = formatInTimeZone(new Date(appointment.starts_at), config.clinicTimezone, "EEEE d 'de' MMMM, HH:mm", {
    locale: es,
  });
  const clinic = config.clinicName || 'la clínica';
  const rows = [
    ['Paciente', appointment.patient?.name || '—'],
    ['Cuándo', when],
    ['Profesional', appointment.professional?.name || '—'],
    ['Servicio', appointment.service?.name || '—'],
    ['Estado', appointment.status || '—'],
  ];
  const sends = [];
  if (appointment.patient?.email) {
    sends.push(sendMail({
      to: appointment.patient.email,
      subject: `Turno modificado · ${clinic}`,
      text: [`Hola ${appointment.patient.name || ''},`, 'Tu turno fue modificado.', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'),
      html: layout({
        clinic,
        title: 'Turno modificado',
        intro: `Hola ${appointment.patient.name || ''}, tu turno fue modificado.`,
        rows,
      }),
    }));
  }
  const staff = await query(
    `SELECT name, email FROM users
     WHERE active = true AND email IS NOT NULL AND email <> ''
       AND (
         (role = 'profesional' AND professional_id = $1)
         OR role = 'secretaria'
       )`,
    [appointment.professional_id]
  );
  for (const user of staff.rows) {
    sends.push(sendMail({
      to: user.email,
      subject: `Turno modificado · ${clinic}`,
      text: [`Hola ${user.name},`, 'Se modificó un turno.', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'),
      html: layout({
        clinic,
        title: 'Turno modificado',
        intro: `Hola ${user.name}, se modificó un turno.`,
        rows,
      }),
    }));
  }
  await Promise.all(sends.map((job) => job.catch((err) => console.error('Aviso de turno no enviado:', err.message))));
}

export async function sendPasswordCredentials(user, password, loginUrl) {
  const clinic = config.clinicName || 'Turnero';
  const text = [
    `Hola ${user.name},`,
    `Ya podés entrar a ${clinic}.`,
    loginUrl ? `Ingreso: ${loginUrl}` : null,
    `Usuario: ${user.username}`,
    `Contraseña: ${password}`,
  ]
    .filter((line) => line != null)
    .join('\n');
  return sendMail({
    to: user.email,
    subject: `Tu acceso a ${clinic}`,
    text,
    html: layout({
      clinic,
      title: 'Tu acceso',
      intro: `Hola ${user.name}, ya podés entrar a ${clinic}.`,
      rows: [
        ['Usuario', user.username],
        ['Contraseña', password],
      ],
      action: loginUrl ? { href: loginUrl, label: 'Ingresar' } : null,
    }),
  });
}

export async function sendPasswordLink(user, link) {
  const clinic = config.clinicName || 'Turnero';
  const text = [
    `Hola ${user.name},`,
    `Usá este enlace para definir la contraseña de tu usuario (${user.username}) en ${clinic}:`,
    link,
    'El enlace vence en 2 horas.',
  ].join('\n');
  return sendMail({
    to: user.email,
    subject: `Definí tu contraseña · ${clinic}`,
    text,
    html: layout({
      clinic,
      title: 'Definí tu contraseña',
      intro: `Hola ${user.name}, este enlace es para el usuario ${user.username}. Vence en 2 horas.`,
      action: { href: link, label: 'Definir contraseña' },
    }),
  });
}

function layout({ clinic, title, intro, rows = [], action }) {
  const day = formatInTimeZone(new Date(), config.clinicTimezone, 'd');
  const details = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#70757a;font-size:13px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#3c4043;font-size:15px;font-weight:500;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');
  const button = action
    ? `<a href="${escapeHtml(action.href)}" style="display:inline-block;margin-top:20px;background:#1a73e8;color:#ffffff;text-decoration:none;font-weight:500;font-size:14px;padding:12px 22px;border-radius:999px;">${escapeHtml(action.label)}</a>`
    : '';
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #dadce0;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 24px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:40px;height:40px;background:#1a73e8;border-radius:8px;color:#ffffff;font-size:18px;font-weight:600;text-align:center;vertical-align:middle;">${escapeHtml(day)}</td>
            <td style="padding-left:12px;">
              <div style="font-size:20px;color:#5f6368;">Calendar</div>
              <div style="font-size:12px;color:#70757a;">${escapeHtml(clinic)}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;">
          <h1 style="margin:12px 0 8px;font-size:22px;font-weight:500;color:#3c4043;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#3c4043;">${escapeHtml(intro)}</p>
          ${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table>` : ''}
          ${button}
        </td></tr>
        <tr><td style="background:#111111;padding:14px 16px;text-align:center;">
          <a href="https://www.instagram.com/profesia.ia/" style="color:rgba(255,255,255,0.72);font-size:12px;text-decoration:none;">Powered by ProfesIA</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function noticeBlock(notice) {
  return `<p style="max-width:480px;margin:12px auto 0;font-family:Inter,Arial,sans-serif;font-size:12px;color:#70757a;text-align:center;">${escapeHtml(notice)}</p>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveRecipient(patientEmail) {
  const sandbox = !config.emailFrom || config.emailFrom.includes('@resend.dev');
  if (sandbox || config.nodeEnv !== 'production') {
    return config.emailDevTo || null;
  }
  return patientEmail || null;
}
