# Turnero Clínicas — plantilla Railway

Publicado: [railway.com/deploy/turnero-clinicas](https://railway.com/deploy/turnero-clinicas)

Un clic para desplegar un turnero (UI React + API + Postgres):

| Servicio | Rol |
|---|---|
| **turnero** | Monolito React + Express (agenda, pacientes, historia clínica, reservas públicas) |
| **Postgres** | Base de datos |

```text
Navegador  →  Turnero (React + API)  →  Postgres
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
- [x] Volumen de uploads (`UPLOAD_DIR=/data/uploads`)

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
railway templates create --project turnero-clinicas --environment production --json
railway templates publish <template-id> \
  --category Starters \
  --description "Agenda de turnos para clínicas, con calendario e historia clínica" \
  --readme-file template/marketplace.md \
  --json
```

Categorías válidas de la CLI: `AI/ML`, `Analytics`, `Authentication`, `Automation`, `Blogs`, `Bots`, `CMS`, `Observability`, `Other`, `Starters`, `Storage`, `Queues`.

Para actualizar el texto público después del primer publish:

```bash
railway templates update <template-id> \
  --category Starters \
  --description "Agenda de turnos para clínicas, con calendario e historia clínica" \
  --readme-file template/marketplace.md \
  --json
```

## Opción C — Manual

1. Proyecto nuevo.
2. **+ Database → PostgreSQL** (nombre: `Postgres`)
3. **+ GitHub Repo** → este repo (nombre: `turnero`)
4. Variables: ver `.railway/railway.ts`
5. Volumen en `/data` y `UPLOAD_DIR=/data/uploads`
6. Dominio HTTPS → redeploy.

## Post-deploy

- [ ] El servicio tiene dominio HTTPS
- [ ] `/health` responde `{ ok: true }`
- [ ] Login con la password generada
- [ ] Se ven profesionales y turnos demo
- [ ] El enlace público de un profesional abre la reserva
- [ ] Se puede cargar un adjunto en una nota clínica
