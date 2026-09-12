import { defineRailway, github, group, postgres, project, service } from "railway/iac";

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
    },
  });

  return project("turnero-clinicas", {
    resources: [group("Turnero", [app, db])],
  });
});
