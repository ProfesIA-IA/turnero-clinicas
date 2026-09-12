# Turnero Clínicas

Monolito React para agenda de clínicas: turnos, profesionales, servicios, horarios, bloqueos y páginas públicas de reserva al estilo Google Calendar.

Un solo servicio sirve la UI y la API. PostgreSQL guarda los datos. Listo para publicar como **template de Railway**.

## Qué incluye

- Agenda semanal / diaria / mensual (grilla tipo Google Calendar)
- Turnos con conflicto de horario
- Profesionales, servicios y relación N:M
- Horarios semanales por profesional
- Bloqueos de agenda (por profesional o de toda la clínica)
- Calendario compartible de un **profesional** o de un **servicio**
- Reserva pública con slots disponibles
- Login de administración
- Datos demo al primer arranque

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19 + Vite + Tailwind 4 |
| API | Express (mismo proceso) |
| DB | PostgreSQL 16 |
| Deploy | Railway (Nixpacks) + IaC en `.railway/railway.ts` |

## Desarrollo local

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001
- Usuario: `admin` / `admin123`

## Producción / Railway

`npm start` corre migraciones y levanta Express sirviendo `server/public` (el build de Vite).

Healthcheck: `GET /health`

Variables:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Postgres (`${{Postgres.DATABASE_URL}}` en Railway) |
| `DEFAULT_ADMIN_USER` | Usuario inicial (`admin`) |
| `DEFAULT_ADMIN_PASSWORD` | Se genera con `${{secret(20)}}` en el template |
| `CLINIC_TIMEZONE` | Por defecto `America/Argentina/Buenos_Aires` |
| `CLINIC_NAME` | Nombre visible de la clínica |
| `SEED_DEMO` | `true` carga profesionales/turnos de ejemplo si la DB está vacía |

Después del deploy, copiá `DEFAULT_ADMIN_PASSWORD` de Variables y generá un dominio público para el servicio `turnero`.

Enlaces públicos:

- Profesional: `/reservar/profesional/:slug`
- Servicio: `/reservar/servicio/:slug`

## Template Railway

Ver [template/TEMPLATE.md](template/TEMPLATE.md) y [template/marketplace.md](template/marketplace.md).

```bash
railway link
railway config plan
railway templates create
railway templates publish <id> --category Business \
  --description "Agenda de turnos para clínicas, con calendario compartible" \
  --readme-file template/marketplace.md
```
