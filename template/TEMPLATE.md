# Turnero Clínicas — plantilla Railway

Un clic para desplegar un turnero genérico (UI React + API + Postgres):

| Servicio | Rol |
|---|---|
| **turnero** | Monolito React + Express (agenda, turnos, reservas públicas) |
| **Postgres** | Base de datos |

```text
Browser  →  Turnero (React + API)  →  Postgres
                 │
        /reservar/profesional/:slug
        /reservar/servicio/:slug
```

## Checklist marketplace

- [x] Secrets con `${{secret()}}` (password de admin)
- [x] `DATABASE_URL` referenciada a Postgres
- [x] Healthcheck `/health`
- [x] Seed demo opcional (`SEED_DEMO=true`)
- [x] Zona horaria Argentina por defecto

## Opción A — IaC

```bash
railway link
railway config plan
railway config apply
```

En el dashboard:

1. Generá un **dominio público** para `turnero`.
2. Copiá `DEFAULT_ADMIN_PASSWORD` → login (`admin` + esa password).
3. Abrí Agenda y las páginas de reserva.

## Opción B — Marketplace

Cuenta verificada de Railway. Desde un proyecto que ya coincida con este stack:

```bash
railway templates create --json
railway templates publish <template-id> \
  --category Business \
  --description "Agenda de turnos para clínicas, con calendario compartible" \
  --readme-file template/marketplace.md
```

## Opción C — Manual

1. Proyecto nuevo.
2. **+ Database → PostgreSQL** (nombre: `Postgres`)
3. **+ GitHub Repo** → este repo (nombre: `turnero`)
4. Variables: ver `.railway/railway.ts`
5. Dominio HTTPS → redeploy.

## Post-deploy

- [ ] El servicio tiene dominio HTTPS
- [ ] `/health` responde `{ ok: true }`
- [ ] Login con la password generada
- [ ] Se ven profesionales y turnos demo
- [ ] El enlace público de un profesional abre la reserva
