-- Turnero Clínicas — schema idempotente (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinic_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Clínica',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  start_hour INT NOT NULL DEFAULT 8,
  end_hour INT NOT NULL DEFAULT 21,
  slot_interval_min INT NOT NULL DEFAULT 30,
  week_starts_on INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO clinic_settings (id, name)
VALUES (1, 'Clínica')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS professionals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  color TEXT NOT NULL DEFAULT '#1a73e8',
  bio TEXT,
  share_slug TEXT UNIQUE,
  share_enabled BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  duration_min INT NOT NULL DEFAULT 30,
  color TEXT NOT NULL DEFAULT '#0b8043',
  price NUMERIC(12,2),
  share_slug TEXT UNIQUE,
  share_enabled BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_services (
  professional_id INT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT schedules_range CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS schedules_unique_window
  ON schedules (professional_id, weekday, start_time, end_time);

CREATE TABLE IF NOT EXISTS blocks (
  id SERIAL PRIMARY KEY,
  professional_id INT REFERENCES professionals(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Bloqueo',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blocks_range CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS patients_phone_unique
  ON patients (phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE INDEX IF NOT EXISTS patients_name_idx ON patients (name);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(id) ON DELETE SET NULL,
  professional_id INT NOT NULL REFERENCES professionals(id),
  service_id INT NOT NULL REFERENCES services(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVADO',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_range CHECK (ends_at > starts_at),
  CONSTRAINT appointments_status CHECK (
    status IN ('RESERVADO', 'CONFIRMADO', 'CANCELADO', 'COMPLETADO')
  )
);

CREATE INDEX IF NOT EXISTS appointments_range_idx
  ON appointments (professional_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS appointments_starts_idx
  ON appointments (starts_at);

CREATE INDEX IF NOT EXISTS blocks_range_idx
  ON blocks (professional_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token);
CREATE INDEX IF NOT EXISTS professionals_share_idx ON professionals (share_slug);
CREATE INDEX IF NOT EXISTS services_share_idx ON services (share_slug);

CREATE TABLE IF NOT EXISTS clinical_field_defs (
  id SERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('service', 'professional')),
  owner_id INT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (
    field_type IN ('text', 'textarea', 'number', 'date', 'select', 'checkbox')
  ),
  options JSONB NOT NULL DEFAULT '[]',
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_field_defs_owner_idx
  ON clinical_field_defs (owner_type, owner_id, sort_order, id);

CREATE TABLE IF NOT EXISTS clinical_notes (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL,
  professional_id INT REFERENCES professionals(id) ON DELETE SET NULL,
  service_id INT REFERENCES services(id) ON DELETE SET NULL,
  details TEXT NOT NULL DEFAULT '',
  custom_values JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_notes_patient_idx
  ON clinical_notes (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clinical_files (
  id SERIAL PRIMARY KEY,
  note_id INT NOT NULL REFERENCES clinical_notes(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_files_note_idx ON clinical_files (note_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'secretaria';
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_id INT REFERENCES professionals(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS patient_id INT REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS photo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS booking_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS booking_intro TEXT NOT NULL DEFAULT '';
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS form_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS extra_field_defs (
  id SERIAL PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('patient', 'professional', 'service', 'user')),
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (
    field_type IN ('text', 'textarea', 'number', 'date', 'select', 'checkbox')
  ),
  options JSONB NOT NULL DEFAULT '[]',
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extra_field_defs_entity_idx ON extra_field_defs (entity, sort_order, id);

ALTER TABLE patients ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'secretaria', 'profesional', 'paciente'));
