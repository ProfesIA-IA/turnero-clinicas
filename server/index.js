import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { assertRuntimeConfig, config } from './config.js';
import { requireAuth, userFromToken, readToken } from './middleware/auth.js';
import { requireAny, requireByMethod } from './lib/permissions.js';
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
  if (req.path === '/login' || req.path === '/olvide' || req.path === '/restablecer') return next();
  const user = await userFromToken(readToken(req));
  if (user) req.user = user;
  next();
}, authRouter);
const catalogReads = ['agenda.ver', 'turnos.ver', 'usuarios.ver'];
app.use('/api/professionals', requireAuth, requireByMethod({
  GET: ['profesionales.ver', ...catalogReads],
  POST: (req) => (req.path.endsWith('/share') ? ['profesionales.compartir'] : ['profesionales.crear']),
  PUT: ['profesionales.editar'],
  DELETE: ['profesionales.eliminar'],
}), professionalsRouter);
app.use('/api/services', requireAuth, requireByMethod({
  GET: ['servicios.ver', ...catalogReads],
  POST: (req) => (req.path.endsWith('/share') ? ['servicios.compartir'] : ['servicios.crear']),
  PUT: ['servicios.editar'],
  DELETE: ['servicios.eliminar'],
}), servicesRouter);
app.use('/api/schedules', requireAuth, requireByMethod({
  GET: ['profesionales.ver', 'profesionales.editar_horarios', 'agenda.ver', 'turnos.ver'],
  POST: ['profesionales.editar_horarios'],
  PUT: ['profesionales.editar_horarios'],
  DELETE: ['profesionales.editar_horarios'],
}), schedulesRouter);
app.use('/api/blocks', requireAuth, requireByMethod({
  GET: ['agenda.ver'],
  POST: ['agenda.crear_bloqueo'],
  PUT: ['agenda.editar_bloqueo'],
  DELETE: ['agenda.eliminar_bloqueo'],
}), blocksRouter);
app.use('/api/appointments', requireAuth, requireByMethod({
  GET: ['turnos.ver', 'agenda.ver'],
  POST: ['turnos.crear', 'agenda.crear_turno'],
  PUT: (req) => (req.path.endsWith('/cancelar') ? ['turnos.cancelar', 'agenda.cancelar_turno'] : ['turnos.editar', 'agenda.editar_turno']),
  DELETE: ['turnos.eliminar', 'agenda.eliminar_turno'],
}), appointmentsRouter);
app.use('/api/patients', requireAuth, requireByMethod({
  GET: ['pacientes.ver', 'agenda.ver', 'turnos.ver', 'usuarios.ver'],
  POST: ['pacientes.crear'],
  PUT: ['pacientes.editar'],
  DELETE: ['pacientes.eliminar'],
}), patientsRouter);
app.use('/api/clinical', requireAuth, requireByMethod({
  GET: (req) => {
    if (req.path.includes('/export')) return ['historia.exportar'];
    if (req.path.startsWith('/fields')) return ['historia.ver', 'configuracion.ver'];
    return ['historia.ver'];
  },
  POST: (req) => {
    if (req.path.startsWith('/fields')) return ['configuracion.editar_campos'];
    if (req.path.endsWith('/files')) return ['historia.adjuntar'];
    return ['historia.crear'];
  },
  PUT: (req) => (req.path.startsWith('/fields') ? ['configuracion.editar_campos'] : ['historia.editar']),
  DELETE: (req) => {
    if (req.path.startsWith('/fields')) return ['configuracion.eliminar_campos'];
    if (req.path.startsWith('/files')) return ['historia.eliminar_archivo'];
    return ['historia.eliminar'];
  },
}), clinicalRouter);
app.use('/api/settings', requireAuth, requireByMethod({
  GET: ['configuracion.ver', 'agenda.ver', 'turnos.ver', 'usuarios.ver'],
  PUT: ['configuracion.editar'],
}), settingsRouter);
app.use('/api/agenda', requireAuth, requireAny('agenda.ver'), agendaRouter);
app.use('/api/users', requireAuth, requireByMethod({
  GET: ['usuarios.ver'],
  POST: ['usuarios.crear'],
  PUT: ['usuarios.editar'],
  DELETE: ['usuarios.eliminar'],
}), usersRouter);

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
