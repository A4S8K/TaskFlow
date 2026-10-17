# TaskFlow Cloud — production readiness report

Date: 2026-10-17. Version: 1.0.0. Baseline: `3234936`.
Prepared branch: `codex/production-readiness`.
Changes are saved locally; this audit does not push or merge the branch or
trigger a deployment.

**Production readiness is not yet confirmed.** Source hardening and local
verification have been performed, but actual Supabase connectivity/TLS, Render
ingress/HTTPS, Vercel operation and live backups are BLOCKED until approved cloud
configuration and verification. No deployment, account, billing, domain, live
database or production credential was created or changed.

## 1. Initial findings and disposition

The audit inspected the actual React/FastAPI/PostgreSQL implementation before
application edits. See [PRODUCTION_AUDIT.md](docs/PRODUCTION_AUDIT.md) for the
architecture, inventory, severity definitions and detailed baseline findings.

| Findings | Initial severity | Implemented correction | Local disposition |
|---|---|---|---|
| H-01 production config | HIGH | Explicit validated environment, HTTPS origins/hosts/proxies, required random JWT and verified database TLS; sanitized startup errors | PASS |
| H-02 Supabase Data API boundary | HIGH | Additive migration 0002 enables RLS and revokes PUBLIC/anon/authenticated table/sequence access without browser policies | PASS on disposable PostgreSQL; actual project grants BLOCKED |
| H-03 auth abuse | HIGH | Bounded per-client/path rate counters and process-wide concurrent-auth admission; one-worker/one-instance topology | PASS locally; hosted client-IP behavior BLOCKED |
| H-04 exception disclosure | HIGH | Safe event-only error boundary, hidden SQL parameters, generic localized 500/503 responses | PASS |
| H-05 frontend localhost fallback | HIGH | Production build rejects absent, insecure or local API origins; explicit Docker-only same-origin mode | PASS |
| H-06 dependency advisories | HIGH | Keep compatible FastAPI 0.143.3, upgrade Starlette 0.52.1→1.8.0 and pip 23.2.1→26.2; update pins and scan again | PASS |
| M-01/M-02 routing and lint | MEDIUM | Vercel SPA fallback, asset exclusions/security headers, ESLint and CI gate | Local checks PASS; hosted routing BLOCKED |
| M-03 database pool | MEDIUM | Bounded pool/recycling/connect/statement/lock timeouts, session-compatible SQL settings, NullPool for migrations | PASS locally; Supavisor verification BLOCKED |
| M-04/M-05/M-06 browser/network/health | MEDIUM | Outer CORS, health/readiness, exact hosts/proxies and HTTPS handling | PASS locally; actual platform chain BLOCKED |
| M-07 startup migrations | MEDIUM | Remove implicit migration command from web startup; explicit Docker/CI/release migration step | PASS source/local migration; new Docker image NOT TESTED locally |
| M-08 recovery | MEDIUM | Backup/recovery runbook and actual protected local dump/restore/API drill | PASS locally; live backups BLOCKED |
| M-09/M-10 testing and session races | MEDIUM | Disposable cluster/configurable browser ports, generation guards for stale login/profile/401 responses | PASS |
| M-11 false-ready redirect | MEDIUM | Exact GET health paths execute on internal HTTP probes; API/docs still redirect, hosts still checked | PASS |
| M-12 Linux-only optional dependency | MEDIUM | Bare pinned Uvicorn for REST avoids unpinned optional uvloop/WebSocket/reload dependencies in clean production installs | PASS source/dependency metadata |
| M-13 CSP eval probe | MEDIUM | Shared Zod jitless configuration before form schemas; retain strict script CSP | Corrected; final browser evidence recorded below |
| L-01 documentation | LOW | Required operational runbooks, current acceptance table and README links | PASS |

No unresolved CRITICAL or HIGH **source finding identified in this audit** remains
after remediation and local checks. This statement does not waive the BLOCKED
hosted requirements or assert that an unconfigured deployment is secure.

## 2. Files changed

- Backend configuration/auth/error handling: `backend/app/core/config.py`,
  `middleware.py`, `security.py`, `app/main.py`, `app/dependencies.py`,
  `app/services/auth_service.py`, en/ru/kk API dictionaries and `.env.example`.
- Database: `backend/app/db/engine.py`, `session.py`, `backend/alembic/env.py`,
  new `0002_protect_backend_tables.py`. Original migration 0001 is unchanged.
- Backend execution/dependencies/tests: `backend/start.py`, Dockerfile,
  `.dockerignore`, `pyproject.toml`, `constraints.txt`, existing test fixture and
  new production security/database/launcher tests.
- Frontend: API configuration and client, auth context, shared Zod validation,
  four schema imports, Vite/ESLint/Vercel configuration, environment/type
  definitions, package/lock files, Nginx/Docker configuration, unit and
  configurable browser tests. No UI design or existing screenshots were replaced.
- Release configuration: `render.yaml`, `docker-compose.prod.yml`, Git ignores,
  `.github/workflows/ci.yml` and new dependency/secret-check workflow.
- Documentation: all three READMEs, historical verification note, this report,
  and the six required documents in `docs/`.

## 3. Security and configuration improvements

The existing Argon2, server-side tenant/role checks, short-lived Bearer JWTs,
English/Russian/Kazakh support and themes are preserved. Tokens remain in browser
memory; no localStorage token, cookie/refresh flow or Supabase browser auth was
introduced. JWTs now validate issuer/audience and subject/lifetime shape. Existing
sessions require login after upgrading.

Production rejects insecure defaults, wildcard browser/proxy trust, invalid
hosts, debug mode and unverified database TLS. Legacy JWT_SECRET and
ACCESS_TOKEN_MINUTES remain supported aliases. Errors do not echo credentials
or raw validation input; unexpected exceptions are not logged as raw tracebacks.

The selected database connection modes are direct or Supavisor **session** mode.
Transaction pooling/6543 is intentionally refused for this release. Database
certificate and hostname verification require the operator's actual trusted CA.
The backend uses a trusted table-owner connection; RLS deliberately has no
Supabase browser policies. FastAPI remains the authority for tenant access.

Authentication limits require one worker/one instance and trustworthy forwarded
client addresses. A shared limiter or reviewed platform enforcement is required
before horizontal scaling. A captured valid Bearer token remains valid until
expiry; browser logout does not revoke it globally.

Build-time public API values are separate from secrets. Vercel's frontend root is
`frontend`, output `dist`; Render's backend root is `backend`, start command
`python start.py`, health path `/ready`. Render auto-deploy is disabled in the
template; applying/importing it can still create a service and initial deploy,
so it has not been applied. Review the provider's default/approved compute plan
before service creation. Migration execution is a separate release action.

## 4. Executed verification and results

Verification used a newly initialized PostgreSQL **17.11** cluster on loopback
port 55433, separate from the existing development cluster. Distinct disposable
databases were used for application smoke, rollback-based tests, restoration and
a final clean migration. No production connection was attempted. Credentials
were generated locally, stored in ignored directories with restricted Windows
ACLs and omitted/redacted from reports and commands.

Local tools: Python 3.12.0, Node 22.23.1, npm 12.2.0. Cloud/container Python is
pinned to patched 3.12.15. Successful local tests do not prove operation of that
hosted/container runtime. A clean frontend copy was used for npm ci because an
existing development server held a native-module file lock. The original ignored
node_modules was repaired; original lint and typecheck also passed. Existing
user development services and databases were not stopped or replaced.

| Executed command/check | Result | Evidence/limits |
|---|---|---|
| `npm ci` using committed lock | PASS | Clean installation, 382 packages installed; no lock regeneration |
| `npm run typecheck` | PASS | Clean copy and original frontend |
| `npm run lint` | PASS | ESLint 10, zero warnings; final changed form/config/test files included |
| `npm run test -- --run` | PASS | Final frozen source after Zod adjustment: **54 tests across 12 files**, 69.59 seconds; affected 14 form tests also passed separately |
| `npm run build`, external synthetic HTTPS origin | PASS | Origin is a test-only `.invalid` name, not a claimed deployment |
| `npm run build`, explicit Docker same-origin | PASS | Actual production bundle served locally with API proxy and unchanged CSP |
| Missing/HTTP/local production API, Vercel same-origin | PASS | Four negative cases correctly exit 1; unsafe configurations are rejected |
| Bundle checks | PASS | CSP ordering/origin, assets, no application localhost API fallback/backend env secrets/source maps; dependency-internal URL parser fallback is not an API configuration |
| `npm audit --json` | PASS | Zero known vulnerabilities in the final npm dependency tree |
| Constrained backend editable install + `pip check` | PASS | FastAPI 0.143.3, Starlette 1.8.0, pip 26.2; metadata updated after removing optional Uvicorn extras |
| `python -m ruff check .` / `ruff format --check .` | PASS | Backend lint and formatting |
| `python -m pytest -q` with separate test database | PASS | **84 passed**, one upstream httpx TestClient fallback deprecation warning |
| `alembic upgrade head` on clean databases | PASS | Fresh upgrade through 0001→0002; final code also upgraded an additional empty database |
| `alembic check` | PASS | No new upgrade operations/metadata drift |
| Transaction/pool/RLS tests | PASS | Commit/rollback, bounded pool, timeouts, NullPool, RLS/no policies and actual denied SET ROLE reads for anon/authenticated |
| API `/health` and `/ready` | PASS | Real disposable API responses; production HTTP probe success/outage and untrusted Host covered by tests |
| Playwright production-bundle desktop/mobile | PASS | Final combined run: **6 passed in 18.9 seconds**; register→login→project→task→update→logout, languages/themes and memory-only session |
| Nested route/asset/CSP Playwright tests | PASS | Included in final six: direct navigation/refresh, protection, asset MIME/404 and zero CSP violations after Zod fix |
| Protected pg_dump/custom archive/list/SHA-256/pg_restore | PASS | Five tables and four sequences verified; matched counts/revision, reapplied access boundary, verified denied browser-role grants |
| API smoke against restored copy | PASS | Readiness, registration/login, new project/task, status update and unauthorized access rejection |
| `pip-audit` installed dependency tree | PASS | Zero known vulnerabilities after upgrade; editable TaskFlow package skipped as expected |
| `pip-audit --no-deps --disable-pip -r constraints.txt` | PASS | 46 pinned entries, zero known vulnerabilities; tool recommends hashes for stronger supply-chain reproducibility |
| Gitleaks 8.30.1 full Git history | PASS | Checksum-verified scanner, redaction enabled; no leaks in baseline history |
| Final proposed commit secret scan | PASS | Gitleaks staged scan plus inspection of all 154 tracked files; no forbidden files, strong signatures or matches to local environment secrets |
| Deployment file validation | PASS | Render published JSON schema; Vercel used fields validate against published schema; unrelated beta section of vendor metaschema is nonconformant; both JSON/YAML parse and local consistency pass |
| New Docker build/container smoke | NOT TESTED | Docker is not installed/on PATH locally; prior baseline hosted CI passed, not evidence for new image |
| Hosted CI for these changes | NOT TESTED | Source workflow updated; no cloud deployment or new hosted run is claimed |

The initial dependency scan found 24 advisory entries in two packages (scanner
aliases can duplicate advisories). These were not suppressed. The first CSP
hosting run failed three route checks because Zod's capability probe attempted
eval; configuring supported jitless mode removed the violation without weakening
the policy. An early launcher test depended on inherited test settings; its
fixture was isolated and the complete backend suite rerun. These failures were
investigated and fixed, not counted as successful executions.

The local restore archive was 19,508 bytes; the archive's SHA-256 stayed unchanged
through the drill. Original row counts matched: users 2, projects 1, memberships
1, tasks 1, migration-history rows 1; all four ID sequence states matched. The
measured isolated restore/verification step took approximately 1.2 seconds on
this machine. This is not a production RTO, backup SLA or proof of cloud backups.

After verification, only the audit API/static-server processes and isolated
PostgreSQL cluster were stopped. The original development PostgreSQL and `.env`
remain intact. Automatic approval review rejected recursive removal of
`.validation-deps/production-audit` with `blocked by policy` and no further
explanation. The stopped test data, generated local-only credentials and archive
therefore remain in that ignored directory under restricted local ACLs. No
production credentials were used. Sanitized evidence logs remain in the chat's
work directory.

## 5. Acceptance criteria

PASS = executed successfully; FAIL = executed unsuccessfully; BLOCKED = requires
external access/configuration/approval; NOT TESTED = not executed. Scope is
explicit so a local PASS cannot stand in for a hosted requirement.

| Acceptance criterion | Local/source status | Actual cloud/public status |
|---|---|---|
| React production build | PASS | BLOCKED — Vercel project not configured/deployed |
| TypeScript validation | PASS | Local criterion |
| Environment-based validated FastAPI settings | PASS | BLOCKED — actual provider variables absent |
| No discovered real credentials exposed | PASS — history/source/bundle and final index scan | BLOCKED — no provider secret stores inspected |
| PostgreSQL cloud configuration supported | PASS — direct/session driver, TLS/pool settings | BLOCKED — actual Supabase connection/CA unverified |
| Clean Alembic migration | PASS | BLOCKED — no production migration authorized/run |
| Explicit configurable CORS | PASS — valid/invalid origin and error/preflight tests | BLOCKED — real Vercel origin/proxy unverified |
| Secure JWT/Argon2/auth abuse limits | PASS | BLOCKED — actual ingress/client-IP/load behavior unverified |
| Backend authorization and tenant isolation | PASS | BLOCKED — deployed application not tested |
| HTTPS deployment support | PASS — settings/middleware/templates | BLOCKED — certificates/ingress/mixed-content checks not performed live |
| Backup/recovery procedures | PASS — runbook and isolated restore/API drill | BLOCKED — live backup plan/retention/PITR not inspected or enabled |
| Health/readiness | PASS — including production internal HTTP probe outage | BLOCKED — actual Render health integration not verified |
| Automated tests | PASS — backend and frontend local results above | NOT TESTED — new hosted workflow not run |
| English/Russian/Kazakh and themes | PASS — dictionary/component/API/browser checks | BLOCKED — hosted UI not tested |
| Deployment documentation complete | PASS | Operator must supply actual domains/CA/proxy/settings |
| No unresolved identified CRITICAL/HIGH source findings | PASS | BLOCKED — critical external requirements remain unverified |

## 6. Remaining limits and required manual actions

1. Review the source changes, findings and prepared configuration. No deployment
   is approved by this report. Choose cloud plans/regions and authorize real
   infrastructure work separately.
2. Supply the actual Supabase direct/session endpoint and CA through protected
   backend settings; verify certificate/hostname and grants in the actual project.
   Keep database credentials and Supabase secret/service keys out of Vercel.
3. Supply actual HTTPS frontend/API origins and verified proxy CIDRs. Confirm
   Render ingress/Host/forwarded-client behavior, CORS and health timeout behavior.
   Retain one worker and one instance until shared limits are designed.
4. Follow the documented order: database → backend settings → explicit migrations
   → backend/health → frontend → exact CORS → authentication and smoke checks.
5. Review Docker/hosted CI on a Docker-capable runner; verify actual Python 3.12.15
   and cloud service behavior. Do not use historical baseline CI as a new pass.
6. Approve and configure protected backup storage/retention, inspect the selected
   plan's enabled features and rehearse an isolated cloud restore. No automatic
   backup/PITR guarantee is made. Live restoration requires explicit approval.
7. Run disposable hosted smoke, all three languages/themes, route refresh/assets,
   browser CSP/mixed-content, expired-token and dependency/secret checks. Record
   actual evidence before changing BLOCKED entries to PASS.

Documentation:
[deployment](docs/DEPLOYMENT.md), [checklist](docs/PRODUCTION_CHECKLIST.md),
[migrations](docs/DATABASE_MIGRATIONS.md), [recovery](docs/BACKUP_RECOVERY.md),
[security](docs/SECURITY.md).

## 7. Assessment

The existing application has been hardened and prepared for a controlled first
cloud release without redesigning it. Local execution provides evidence from
functional/security regression testing, clean migrations and recovery. Public
production readiness remains **unconfirmed** until the critical external checks
above are executed with explicit authorization and actual infrastructure values.
