import { bucket, defineRailway, github, group, postgres, project, service } from "railway/iac";

/**
 * Turnero Clínicas — plantilla Railway (monolito React + API + Postgres).
 *
 * Comandos:
 *   railway link
 *   railway config plan
 *   railway config apply
 *   railway templates create
 *   railway templates publish <id> --category Starters \
 *     --description "Agenda de turnos para clínicas, con calendario e historia clínica" \
 *     --readme-file template/marketplace.md
 */
export default defineRailway(() => {
  const db = postgres("Postgres");
  const imagenes = bucket("imagenes", { region: "iad" });

  const app = service("turnero", {
    source: github("ProfesIA-IA/turnero-clinicas", { branch: "main" }),
    build: "npm install --include=dev && npm run build",
    start: "npm start",
    healthcheck: "/health",
    healthcheckTimeout: 60,
    env: {
      NODE_ENV: "production",
      CORS_ORIGIN: "*",
      DATABASE_URL: db.env.DATABASE_URL,
      CLINIC_TIMEZONE: "America/Argentina/Buenos_Aires",
      CLINIC_NAME: "Mi clínica",
      SEED_DEMO: "true",
      DEFAULT_ADMIN_USER: "admin",
      DEFAULT_ADMIN_PASSWORD: "${{secret(20)}}",
      UPLOAD_DIR: "/data/uploads",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      EMAIL_DEV_TO: "",
      PUBLIC_APP_URL: "",
      KAPSO_API_KEY: "",
      KAPSO_PHONE_NUMBER_ID: "",
      KAPSO_WEBHOOK_SECRET: "",
      OPENAI_API_KEY: "",
    },
  });

  return project("turnero-clinicas", {
    resources: [group("Turnero", [app, db, imagenes])],
  });
});
