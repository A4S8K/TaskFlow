# TaskFlow production audit

Audit date: 2026-10-17. Baseline: `3234936`, version 1.0.0.
The repository was inspected before application changes. This document records
initial findings; the final report records remediation and executed verification.

## Current architecture and inventory

- `frontend/`: React 19, TypeScript, Vite, React Router, TanStack Query, Axios,
  Radix UI, Tailwind, i18next (en/ru/kk), light/dark/system themes. The committed
  npm lockfile provides installation reproducibility. Routes are `/app`,
  `/app/projects`, `/app/projects/:id`, `/app/tasks`, `/app/settings`.
- `backend/`: FastAPI, Pydantic Settings, synchronous SQLAlchemy 2 and psycopg 3,
  PostgreSQL, Alembic. Python dependency constraints are committed.
- Four application tables: users, projects, project_members, tasks. One initial
  Alembic revision defines foreign keys, unique/check constraints and indexes.
- Authentication uses Argon2 and short-lived HS256 Bearer JWTs. Backend membership
  and role checks control access; tokens remain in browser memory. Reload requires
  login. There is no refresh-cookie flow or persistent token storage.
- The database dependency commits/rolls back request transactions and closes
  sessions. SQLAlchemy pre-pings pooled connections. No `create_all` is used.
- Existing Dockerfiles and development/production Compose files target a local
  Postgres/API/Nginx stack. The backend container command currently runs migrations
  before starting Uvicorn. Cloud configuration for Vercel/Render is absent.
- Environment templates exist; real `backend/.env`, local database files,
  `.venv`, node_modules and built output are ignored. Their values are not included
  here. The API defaults to development PostgreSQL/CORS; frontend defaults to an
  HTTP localhost API.
- Existing tests: pytest PostgreSQL integration tests, Vitest/Testing Library,
  and Playwright desktop/mobile smoke tests. GitHub Actions has backend,
  frontend and Docker Compose smoke jobs. The baseline workflow completed
  successfully: https://github.com/A4S8K/TaskFlow/actions/runs/39047152803 . This
  does not establish readiness on Vercel/Render/Supabase.
- Existing documentation: three READMEs, architecture/API/verification notes.
  Cloud deployment, migration recovery, backup and production security runbooks
  are missing.

## Initial findings and remediation plan

Severity indicates impact if this code is deployed publicly; an identified
configuration risk is not evidence that a live system has been compromised.

| ID | Severity | Finding | Required remediation |
|---|---|---|---|
| H-01 | HIGH | No validated production mode: development DB/CORS defaults, placeholder JWT secrets and non-TLS database URLs can be accepted. | Fail closed for required production variables, HTTPS origins/hosts and verified database TLS; redact settings validation. |
| H-02 | HIGH | Public-schema tenant tables have no RLS or explicit denial of Supabase Data API roles. Platform default grants could bypass FastAPI permissions. | New non-destructive migration: enable RLS, no browser-role policies, revoke PUBLIC/anon/authenticated privileges; retain backend table-owner access. |
| H-03 | HIGH | Login/registration allow unbounded expensive password hashing and guessing. | Bound auth request rates and limiter memory; document/enforce single-worker deployment limits and shared-limiter requirement before scaling. |
| H-04 | HIGH | Unhandled exceptions are logged with full traceback; database exceptions can carry sensitive statement/connection context. | Event-only error logs, hidden SQL parameters and generic localized 500/503 responses; sanitized startup validation. |
| H-05 | HIGH | Production frontend can silently target HTTP localhost or accept an insecure API URL. | Validate the public HTTPS API at build time; explicitly separate development and Docker same-origin modes. |
| H-06 | HIGH | The executed dependency scan found known advisories in baseline Starlette 0.52.1 and pip 23.2.1. | Upgrade to compatible patched Starlette 1.8.0 and pip 26.2, pin the versions and rerun tests/advisory scans. |
| M-01 | MEDIUM | No Vercel SPA fallback or deployment security-header configuration. | Configure actual nested routes, asset handling, CSP and security headers without invented deployment domains. |
| M-02 | MEDIUM | No frontend lint script or lint gate in CI. | Add meaningful static lint checks and run them with the existing tests/build. |
| M-03 | MEDIUM | Database pool sizing/recycling/timeouts are implicit; Supabase transaction pool mode is not assessed. | Configure bounded pool/timeouts and support only documented direct/session connections for this release. |
| M-04 | MEDIUM | CORS is inside the exception middleware stack, so unexpected error responses can lack CORS headers. | Wrap the complete ASGI response path and verify error/preflight behavior. |
| M-05 | MEDIUM | Liveness exists only at `/api/v1/health`; database readiness is absent. | Preserve compatibility, add minimal `/health` and database `/ready`, and test unavailable database behavior. |
| M-06 | MEDIUM | Trusted proxy/host and HTTPS handling are not explicitly configured. | Validate public hosts and explicit trusted proxy addresses; use hosting TLS, reject invalid production configuration. |
| M-07 | MEDIUM | Container startup performs schema migrations automatically. | Make migration execution a separate explicit release step and test clean-database upgrades. |
| M-08 | MEDIUM | No backup/recovery runbook or evidence of cloud backup configuration. | Document protected backups, retention, verification and isolated restore rehearsal; do not claim live backups are enabled. |
| M-09 | MEDIUM | Playwright endpoints are fixed and the prior local database contains existing development data. | Use separate disposable PostgreSQL databases and configurable local test ports. |
| M-10 | MEDIUM | A delayed login/profile response can restore a signed-out user; an old request's 401 can clear a newer session. | Track session generations and add regressions for stale login and unauthorized responses. |
| M-11 | MEDIUM | An unconditional HTTPS redirect can return a successful 3xx to an internal readiness probe without executing the database check. | Bypass redirects only for exact GET health paths, retain host validation, test HTTP readiness success/outage and API HTTPS redirects. |
| M-12 | MEDIUM | Windows-generated constraints omit the Linux-only uvloop extra pulled by uvicorn[standard]. | Use pinned bare Uvicorn for the existing REST service, avoiding unnecessary optional runtime dependencies. |
| M-13 | MEDIUM | Production CSP testing found Zod's eval feature probe creates a script-src violation. | Use Zod's supported jitless mode; keep the strict CSP and rerun form/browser checks. |
| L-01 | LOW | Prior verification notes predate publication and do not cover production settings. | Add an evidence-based final acceptance table and link the new runbooks. |

No CRITICAL vulnerability was confirmed in the initial code review. H-06 was
identified by the subsequent executed dependency scan, not assumed from version
numbers alone. See the final report for remediation and separate verification
of repository history, new tests and cloud checks.

## Existing security strengths

Argon2 hashes, explicit JWT algorithm validation and expiry, generic failed-login
responses with a timing-equalizer hash, server-side role/membership checks,
parameterized SQLAlchemy queries, rollback/cleanup, validation responses that omit
raw input, three-language API messages, memory-only browser tokens and ignored
local credentials are already implemented and must be preserved.

## External verification boundaries

No production credentials, approved cloud database connection or deployment
domains have been supplied. No accounts, billing, domains or infrastructure will
be changed. Real Supabase connectivity/TLS, Vercel routing, Render proxy behavior,
hosted backups and public end-to-end verification remain BLOCKED until the user
configures and authorizes those environments. Local configuration tests alone do
not change those statuses to PASS.
