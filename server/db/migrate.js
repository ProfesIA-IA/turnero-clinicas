import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getPool, query } from './pool.js';
import { uniqueSlug } from '../lib/slug.js';
import { addYmd, ymdInTz, zonedDateTime } from '../lib/time.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = getPool();
  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function ensureAdmin() {
  const existing = await query('SELECT id FROM users WHERE username = $1', [config.defaultAdminUser]);
  if (existing.rowCount) {
    console.log(`OK: admin listo (${config.defaultAdminUser})`);
    return;
  }
  const hash = await bcrypt.hash(config.defaultAdminPassword, 10);
  await query(
    'INSERT INTO users (username, password_hash, name) VALUES ($1, $2, $3)',
    [config.defaultAdminUser, hash, 'Administrador']
  );
  console.log(`OK: admin creado (${config.defaultAdminUser})`);
}

async function ensureSettings() {
  await query(
    `UPDATE clinic_settings
     SET name = COALESCE(NULLIF(name, 'Clínica'), $1),
         timezone = $2,
         updated_at = now()
     WHERE id = 1 AND name IN ('Clínica', $1)`,
    [config.clinicName, config.clinicTimezone]
  );
  await query('UPDATE clinic_settings SET timezone = $1 WHERE id = 1', [config.clinicTimezone]);
  if (config.clinicName) {
    const current = await query('SELECT name FROM clinic_settings WHERE id = 1');
    if (current.rows[0]?.name === 'Clínica') {
      await query('UPDATE clinic_settings SET name = $1 WHERE id = 1', [config.clinicName]);
    }
  }
}

async function seedDemo() {
  if (!config.seedDemo) return;
  const count = await query('SELECT COUNT(*)::int AS n FROM professionals');
  if (count.rows[0].n > 0) {
    console.log('OK: datos demo ya existen');
    return;
  }

  const tz = config.clinicTimezone;
  const today = ymdInTz(new Date(), tz);

  const professionals = [
    { name: 'Dra. Laura Ager', code: 'AGER', color: '#0b8043', email: 'ager@clinica.test', phone: '2664123001' },
    { name: 'Lic. Nicolás Pérez', code: 'NICO', color: '#1a73e8', email: 'nico@clinica.test', phone: '2664123002' },
    { name: 'Dra. Camila Soto', code: 'CAMI', color: '#e37400', email: 'camila@clinica.test', phone: '2664123003' },
  ];

  const professionalIds = [];
  for (const pro of professionals) {
    const result = await query(
      `INSERT INTO professionals (name, code, email, phone, color, share_slug, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        pro.name,
        pro.code,
        pro.email,
        pro.phone,
        pro.color,
        uniqueSlug(pro.code.toLowerCase()),
        'Agenda de atención clínica.',
      ]
    );
    professionalIds.push(result.rows[0].id);
  }

  const services = [
    { name: 'Consulta', code: 'CONS', duration: 30, color: '#0b8043', price: 25000 },
    { name: 'Control', code: 'CTRL', duration: 20, color: '#1a73e8', price: 18000 },
    { name: 'Primera consulta', code: 'PRIM', duration: 45, color: '#e37400', price: 35000 },
    { name: 'Práctica', code: 'PRAC', duration: 60, color: '#9334e6', price: 40000 },
  ];
  const serviceIds = [];
  for (const service of services) {
    const result = await query(
      `INSERT INTO services (name, code, duration_min, color, price, share_slug)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [service.name, service.code, service.duration, service.color, service.price, uniqueSlug(service.name)]
    );
    serviceIds.push(result.rows[0].id);
  }

  for (const professionalId of professionalIds) {
    for (const serviceId of serviceIds) {
      await query(
        'INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)',
        [professionalId, serviceId]
      );
    }
    for (const weekday of [1, 2, 3, 4, 5]) {
      await query(
        'INSERT INTO schedules (professional_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [professionalId, weekday, '09:00', '13:00']
      );
      await query(
        'INSERT INTO schedules (professional_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [professionalId, weekday, '16:00', '20:00']
      );
    }
    await query(
      'INSERT INTO schedules (professional_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)',
      [professionalId, 6, '09:00', '13:00']
    );
  }

  const patients = [
    { name: 'María Torres', phone: '2664001001', email: 'maria@test.com' },
    { name: 'Juan Gómez', phone: '2664001002', email: 'juan@test.com' },
    { name: 'Sofía Díaz', phone: '2664001003', email: 'sofia@test.com' },
    { name: 'Pablo Ruiz', phone: '2664001004', email: 'pablo@test.com' },
  ];
  const patientIds = [];
  for (const patient of patients) {
    const result = await query(
      'INSERT INTO patients (name, phone, email) VALUES ($1, $2, $3) RETURNING id',
      [patient.name, patient.phone, patient.email]
    );
    patientIds.push(result.rows[0].id);
  }

  const demoTurnos = [
    { dayOffset: 0, start: 10 * 60, pro: 0, service: 0, patient: 0, status: 'CONFIRMADO' },
    { dayOffset: 0, start: 16 * 60 + 30, pro: 1, service: 1, patient: 1, status: 'RESERVADO' },
    { dayOffset: 1, start: 11 * 60, pro: 0, service: 2, patient: 2, status: 'RESERVADO' },
    { dayOffset: 2, start: 17 * 60, pro: 2, service: 0, patient: 3, status: 'CONFIRMADO' },
    { dayOffset: 3, start: 9 * 60 + 30, pro: 1, service: 3, patient: 0, status: 'RESERVADO' },
  ];

  for (const item of demoTurnos) {
    const date = addYmd(today, item.dayOffset);
    const duration = services[item.service].duration;
    await query(
      `INSERT INTO appointments
        (patient_id, professional_id, service_id, starts_at, ends_at, status, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'staff', $7)`,
      [
        patientIds[item.patient],
        professionalIds[item.pro],
        serviceIds[item.service],
        zonedDateTime(date, item.start, tz),
        zonedDateTime(date, item.start + duration, tz),
        item.status,
        'Turno de demostración',
      ]
    );
  }

  await query(
    `INSERT INTO blocks (professional_id, title, starts_at, ends_at, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      professionalIds[2],
      'Reunión de equipo',
      zonedDateTime(addYmd(today, 1), 13 * 60, tz),
      zonedDateTime(addYmd(today, 1), 16 * 60, tz),
      'No atender',
    ]
  );

  console.log('OK: datos demo cargados');
}

async function migrate() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runSchema();
  console.log('OK: schema aplicado');
  await ensureSettings();
  await ensureAdmin();
  await seedDemo();
  console.log('Migrations completed successfully.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  migrate()
    .then(async () => {
      await getPool().end();
    })
    .catch(async (err) => {
      console.error('Migration failed:', err.message);
      try {
        await getPool().end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

export { migrate };
