# Production release checklist

Do not use checked boxes here as test evidence. The acceptance table in
`../PRODUCTION_READINESS_REPORT.md` is the source of actual execution status.
Local source preparation does not prove hosted operation.

## Source and local validation

- [ ] Review the production audit and close all CRITICAL/HIGH source findings.
- [ ] Install with the committed npm lockfile and Python constraints.
- [ ] Run TypeScript, frontend lint, unit tests and production build.
- [ ] Run Python lint and the full suite against isolated PostgreSQL databases.
- [ ] Apply all Alembic revisions on a clean database; check metadata drift,
  transactions, constraints, RLS and Data API-role denial.
- [ ] Run desktop/mobile browser smoke, language/theme and nested-route refresh.
- [ ] Scan commit/history/secrets and frontend compiled output; review dependency
  advisories. No unresolved HIGH/CRITICAL advisories are accepted silently.
- [ ] Review generated cloud configuration without applying it.

## Approved cloud setup

- [ ] User approves real infrastructure/deployment; selects plan/region and owns
  accounts/billing. No deployment is implied by this checklist.
- [ ] Supabase direct/session endpoint and CA are provided in backend secrets;
  verify-full succeeds against the actual hostname.
- [ ] Database credentials stay backend-only. RLS/grants are verified on the
  actual project, including pre-existing privileges and restore behavior.
- [ ] Configure exact public HTTPS frontend/API origins, trusted hosts and
  validated proxy IPs. Do not allow wildcard Vercel previews.
- [ ] One Render instance/one worker; assess Argon2 memory, pool budget and rate
  limits for the selected plan. Shared limits are required before scaling.
- [ ] Execute migrations as an explicit controlled release action, with a verified
  backup for existing data. App startup does not migrate.
- [ ] Deploy backend manually, verify HTTPS `/health` and database `/ready`.
- [ ] Deploy Vercel frontend manually with actual public build-time API URL.
- [ ] Verify CORS allowed/disallowed preflights, Authorization, CSP and assets.
- [ ] Verify real ingress forwarded-header behavior and no redirect loops.
- [ ] Run disposable production smoke: register/login/project/task/update/logout,
  en/ru/kk, light/dark, refresh nested routes, unavailable API and expiry behavior.
- [ ] Confirm no mixed content, secrets or stack traces in browser/network/logs.
- [ ] Set backup access/retention appropriate to the chosen plan; verify a protected
  backup and isolated restore. Do not assume automatic backups/PITR are enabled.
- [ ] Record provider-specific PASS evidence and remaining risks in the report.

Release readiness remains unconfirmed while a critical hosted check is BLOCKED,
FAIL or NOT TESTED. Obtain the final deployment decision from the responsible
operator after reviewing those results.
