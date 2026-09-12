# Deploy and Host Turnero Clínicas on Railway

Agenda de turnos para clínicas y consultorios: calendario tipo Google Calendar, fichas de pacientes, historia clínica y páginas públicas para reservar con un profesional o un servicio. Un clic despliega la app y PostgreSQL. Un solo servicio sirve la interfaz y la API.

## About Hosting Turnero Clínicas

El stack es un monolito: React + Express en el servicio **turnero**, con PostgreSQL para turnos, pacientes y notas clínicas. Railway genera el dominio HTTPS, la password de administración y conecta `DATABASE_URL` al plugin de Postgres.

Los adjuntos de historia clínica viven en un volumen montado en `/data` (`UPLOAD_DIR=/data/uploads`) para que no se pierdan entre redeploys. El arranque corre migraciones y, si la base está vacía, puede cargar datos de ejemplo (`SEED_DEMO=true`).

## Why Deploy Turnero Clínicas

- Subí una agenda de clínica a producción sin armar servidores ni Nginx.
- Postgres administrado y HTTPS listos, con healthcheck en `/health`.
- Reserva online con un enlace, sin login para el paciente.
- Historia clínica con archivos persistentes en un volumen.

## Common Use Cases

- Consultorios y clínicas que necesitan turnos y reserva por WhatsApp/enlace
- Equipos con varios profesionales y servicios compartidos
- Historia clínica liviana por paciente, con campos propios de cada prestación
- Demo o piloto de un turnero antes de integrar un HIS

## Dependencies for Turnero Clínicas Hosting

### Deployment Dependencies

| Servicio | Propósito |
| --- | --- |
| **turnero** | UI React + API Express (agenda, pacientes, historia clínica, reservas públicas) |
| **Postgres** | Persistencia de usuarios, turnos, pacientes y notas |
| Volumen `/data` | Archivos clínicos (`UPLOAD_DIR=/data/uploads`) |

### Después del deploy

1. Generá un **dominio público** para el servicio **turnero**.
2. En Variables copiá `DEFAULT_ADMIN_PASSWORD`.
3. Entrá con usuario `admin` y esa contraseña.
4. Desde **Profesionales** o **Servicios**, usá **Compartir** para copiar el enlace de reservas.

Enlaces públicos:

- Profesional: `/reservar/profesional/:slug`
- Servicio: `/reservar/servicio/:slug`

Zona horaria por defecto: `America/Argentina/Buenos_Aires`. Cambiala en **Configuración** si hace falta.

Para dejar de cargar datos de demostración, poné `SEED_DEMO=false` (solo afecta bases vacías).

### Fuente

GitHub: `ProfesIA-IA/turnero-clinicas`  
IaC: `.railway/railway.ts`
