# Turnero Clínicas

Agenda de turnos para clínicas y consultorios, con calendario tipo Google Calendar, fichas de pacientes, historia clínica y páginas públicas para compartir la disponibilidad de un profesional o de un servicio.

Un clic despliega la app y PostgreSQL. Un solo servicio sirve la interfaz y la API.

## Qué incluye

- Calendario semanal, diario y mensual
- Turnos con detección de horarios ocupados
- Pacientes e historia clínica (notas, campos personalizados, archivos y descarga)
- Profesionales, servicios y horarios de atención
- Bloqueos de agenda
- Reserva online con slots libres (sin login)
- Login de administración
- Datos de ejemplo en el primer arranque
- PostgreSQL incluido

## Después de desplegar

1. Generá un **dominio público** para el servicio **turnero**.
2. En Variables copiá `DEFAULT_ADMIN_PASSWORD`.
3. Entrá con usuario `admin` y esa contraseña.
4. Desde **Profesionales** o **Servicios**, usá **Compartir** para copiar el enlace de reservas.

Enlaces públicos:

- Profesional: `/reservar/profesional/:slug`
- Servicio: `/reservar/servicio/:slug`

Zona horaria por defecto: `America/Argentina/Buenos_Aires`. Cambiala en **Configuración** si hace falta.

Los archivos de historia clínica se guardan en `/data/uploads`. No borres el volumen si querés conservar adjuntos.

Para dejar de cargar datos de demostración, poné `SEED_DEMO=false` y volvé a desplegar (solo afecta bases vacías).
