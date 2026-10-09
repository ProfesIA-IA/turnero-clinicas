# Turnero Clínicas

Agenda de turnos para clínicas y consultorios. Un solo servicio sirve la interfaz y la API; PostgreSQL guarda los datos.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/turnero-clinicas?utm_medium=integration&utm_source=button&utm_campaign=turnero-clinicas)

Template publicado: [railway.com/deploy/turnero-clinicas](https://railway.com/deploy/turnero-clinicas)

## Qué hace

El staff entra con usuario y contraseña. Los pacientes reservan desde un enlace público, sin login.

| Área | Qué incluye |
|------|-------------|
| **Agenda** | Calendario semanal, diario y mensual, estilo Google Calendar |
| **Turnos** | Alta, edición, estados (reservado, confirmado, cancelado, completado) y detección de solapamientos |
| **Pacientes** | Ficha con datos de contacto e historial de turnos |
| **Historia clínica** | Notas por paciente, campos personalizados, archivos adjuntos y descarga en HTML |
| **Profesionales** | Color, servicios asociados, horarios semanales y enlace para compartir agenda |
| **Servicios** | Duración, precio, profesionales y enlace de reserva por prestación |
| **Bloqueos** | Cierres de agenda por profesional o de toda la clínica |
| **Reserva pública** | Slots libres según horarios, bloqueos y turnos ya tomados |
| **Configuración** | Nombre, zona horaria, rango horario, intervalo de slots y campos clínicos |

Zona horaria por defecto: `America/Argentina/Buenos_Aires`.

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19 + Vite + Tailwind 4 |
| API | Express en el mismo proceso |
| Base | PostgreSQL 16 |
| Deploy | Railway (Nixpacks) e IaC en `.railway/railway.ts` |

```text
Navegador  →  Turnero (React + API)  →  Postgres
                    │
           /reservar/profesional/:slug
           /reservar/servicio/:slug
```

## Desarrollo local

Requisitos: Node 20+, Docker (para Postgres) y npm.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev
```

Atajo equivalente:

```bash
npm run setup
npm run dev
```

- Interfaz: http://localhost:5173
- API: http://localhost:3001
- Salud: http://localhost:3001/health
- Usuario: `admin` / `admin123`

En desarrollo Vite hace proxy de `/api` al backend. En producción un solo proceso sirve el build estático y la API.

### Variables locales

Copiá `.env.example`. Las más usadas:

| Variable | Default | Uso |
|----------|---------|-----|
| `DATABASE_URL` | `postgres://turnero:turnero@localhost:5432/turnero` | Conexión a Postgres |
| `PORT` | `3001` | Puerto de la API |
| `DEFAULT_ADMIN_USER` | `admin` | Usuario inicial |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Contraseña inicial (solo local) |
| `CLINIC_TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria |
| `CLINIC_NAME` | `Clínica Demo` | Nombre visible |
| `SEED_DEMO` | `true` | Carga profesionales, servicios y turnos de ejemplo si la base está vacía |
| `UPLOAD_DIR` | (vacío → `uploads/` en el repo) | Carpeta de archivos clínicos |
| `CORS_ORIGIN` | `*` | Orígenes permitidos |
| `RESEND_API_KEY` | (vacío) | Si está vacía, no se envían mails |
| `EMAIL_FROM` | (vacío) | Remitente verificado. Vacío usa el sandbox de Resend |
| `EMAIL_DEV_TO` | (vacío) | En local o sin remitente propio, todos los mails van a esta casilla |
| `PUBLIC_APP_URL` | (vacío) | URL pública para el enlace de contraseña. En Railway se usa el dominio del servicio |

## Cómo usar el sistema

### Agenda y turnos

1. Entrá a **Agenda**. Creá un turno haciendo clic en un horario o desde **Turnos**.
2. Elegí paciente (o crealo al vuelo), profesional, servicio y horario.
3. El sistema rechaza solapamientos en la misma agenda.
4. Desde el turno podés abrir **Nueva entrada** de historia clínica o **Ver historia** del paciente.

### Pacientes e historia clínica

- **Pacientes** lista y busca fichas. Cada ficha muestra turnos y notas clínicas.
- Una nota puede vincularse a un turno. El buscador filtra por fecha, servicio y profesional.
- En **Configuración** definís campos extra por servicio o por profesional (texto, número, fecha, opciones, etc.).
- Los archivos adjuntos se guardan en `UPLOAD_DIR`. En Railway conviene un volumen en `/data` y `UPLOAD_DIR=/data/uploads`.
- **Descargar** exporta la historia clínica en HTML.

### Profesionales, horarios y servicios

- **Horarios** abre un modal con ventanas semanales (por ejemplo lunes 9:00–13:00).
- Relación N:M: un profesional atiende varios servicios y un servicio lo cubren varios profesionales.
- **Compartir** copia el enlace público de ese profesional o de ese servicio.

### Reserva pública (sin login)

- Profesional: `/reservar/profesional/:slug`
- Servicio: `/reservar/servicio/:slug`

La persona elige un slot libre, deja nombre y teléfono, y queda un turno con origen `public`.

## Producción en Railway

`npm start` corre migraciones y levanta Express sirviendo el build de Vite (`server/public`).

Healthcheck: `GET /health` → `{ "ok": true }`.

| Variable | En Railway |
|----------|------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `DEFAULT_ADMIN_USER` | `admin` |
| `DEFAULT_ADMIN_PASSWORD` | `${{secret(20)}}` (copiala de Variables al primer login) |
| `CLINIC_TIMEZONE` | `America/Argentina/Buenos_Aires` |
| `CLINIC_NAME` | Nombre de la clínica |
| `SEED_DEMO` | `true` la primera vez; después podés pasarlo a `false` |
| `UPLOAD_DIR` | `/data/uploads` si hay volumen montado en `/data` |
| `CORS_ORIGIN` | `*` o el dominio público |
| `RESEND_API_KEY` | API key de Resend. Vacía oculta el recupero y el envío de claves |
| `EMAIL_FROM` | Remitente del dominio verificado. Vacío = sandbox |
| `EMAIL_DEV_TO` | Casilla de prueba. En producción no recibe los mails reales |
| `KAPSO_API_KEY` | API key de Kapso. Vacía oculta Chatbot y Mensajes |
| `KAPSO_PHONE_NUMBER_ID` | Número de WhatsApp de Kapso |
| `KAPSO_WEBHOOK_SECRET` | Secret del webhook de Kapso |
| `OPENAI_API_KEY` | API key de OpenAI para las respuestas del chatbot |

Después del deploy:

1. Generá un dominio HTTPS para el servicio **turnero**.
2. Copiá `DEFAULT_ADMIN_PASSWORD` de las variables del servicio.
3. Entrá con usuario `admin`.
4. Desde **Profesionales** o **Servicios**, usá **Compartir** para el enlace de reservas.

Definición IaC: [`.railway/railway.ts`](.railway/railway.ts). Guía de plantilla: [`template/TEMPLATE.md`](template/TEMPLATE.md).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | API + Vite en paralelo |
| `npm run dev:api` | Solo API, con recarga |
| `npm run dev:web` | Solo frontend |
| `npm run build` | Build de producción |
| `npm run migrate` | Aplica `server/db/schema.sql` |
| `npm start` | Migraciones + servidor (producción) |
| `npm run setup` | Postgres local, dependencias y migrate |

## Publicar o actualizar el template

Hace falta una cuenta Railway verificada. Categoría válida del marketplace: `Starters` (no existe `Business` en la CLI). La descripción corta tiene un máximo de 75 caracteres.

```bash
railway templates create --project turnero-clinicas --environment production --json
railway templates publish <template-id> \
  --category Starters \
  --description "Agenda de turnos para clínicas, con calendario e historia clínica" \
  --readme-file template/marketplace.md \
  --json
```

Más detalle en [`template/TEMPLATE.md`](template/TEMPLATE.md) y el texto del marketplace en [`template/marketplace.md`](template/marketplace.md).
