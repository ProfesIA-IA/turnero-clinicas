import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { assertRuntimeConfig, config } from './config.js';
import { requireAuth, userFromToken, readToken } from './middleware/auth.js';
import { requirePermission } from './lib/permissions.js';
import authRouter from './routes/auth.js';
import professionalsRouter from './routes/professionals.js';
import servicesRouter from './routes/services.js';
import schedulesRouter from './routes/schedules.js';
import blocksRouter from './routes/blocks.js';
import appointmentsRouter from './routes/appointments.js';
import publicRouter from './routes/public.js';
import settingsRouter from './routes/settings.js';
import agendaRouter from './routes/agenda.js';
import patientsRouter from './routes/patients.js';
import clinicalRouter from './routes/clinical.js';
import usersRouter from './routes/users.js';

assertRuntimeConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const hasFrontendBuild = fs.existsSync(path.join(publicDir, 'index.html'));

const app = express();
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()),
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'turnero-clinicas',
    frontend: hasFrontendBuild,
  });
});

app.use('/api/public', publicRouter);
app.use('/api/auth', async (req, res, next) => {
  if (req.path === '/login') return next();
  const user = await userFromToken(readToken(req));
  if (user) req.user = user;
  next();
}, authRouter);
const catalogReads = ['agenda', 'turnos', 'usuarios'];
app.use('/api/professionals', requireAuth, requirePermission('profesionales', { readsAlso: catalogReads }), professionalsRouter);
app.use('/api/services', requireAuth, requirePermission('servicios', { readsAlso: catalogReads }), servicesRouter);
app.use('/api/schedules', requireAuth, requirePermission('profesionales', { readsAlso: ['agenda', 'turnos'] }), schedulesRouter);
app.use('/api/blocks', requireAuth, requirePermission('agenda'), blocksRouter);
app.use('/api/appointments', requireAuth, requirePermission('turnos', { readsAlso: ['agenda'] }), appointmentsRouter);
app.use('/api/patients', requireAuth, requirePermission('pacientes', { readsAlso: ['agenda', 'turnos', 'usuarios'] }), patientsRouter);
app.use('/api/clinical', requireAuth, requirePermission('pacientes'), clinicalRouter);
app.use('/api/settings', requireAuth, requirePermission('configuracion', { readsAlso: ['agenda', 'turnos', 'usuarios'] }), settingsRouter);
app.use('/api/agenda', requireAuth, requirePermission('agenda'), agendaRouter);
app.use('/api/users', requireAuth, requirePermission('usuarios'), usersRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (hasFrontendBuild) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api(?:\/|$)|\/health(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  let status = err.status || 500;
  let message = err.message || 'Error interno';
  if (err.code === '23505') {
    status = 409;
    message = 'Ya existe un registro con esos datos';
  }
  if (err.code === '23503') {
    status = 409;
    message = 'No se puede eliminar porque tiene turnos asociados';
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'El archivo supera los 10 MB';
  }
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Turnero Clínicas listening on :${config.port}`);
  if (hasFrontendBuild) {
    console.log(`Serving UI from ${publicDir}`);
  }
});
