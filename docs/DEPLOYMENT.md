# Manual cloud deployment

Target: Vercel frontend → Render FastAPI → Supabase PostgreSQL. The application
uses its own JWT/Argon2 authentication; Supabase supplies PostgreSQL only.
Applying a Blueprint or creating a hosting project can start a deployment and
incur charges. No cloud resources were created by the audit. Obtain explicit
authorization before applying these steps to real infrastructure.

## Build and service settings

| Component | Root | Install/build | Start/output | Health |
|---|---|---|---|---|
| Vercel | `frontend` | `npm ci`; `npm run build` | `dist` | Browser smoke |
| Render | `backend` | Upgrade to pinned pip 26.2, then `python -m pip install --no-cache-dir -c constraints.txt .` | `python start.py` | `/ready` |
| Database | Supabase project | Explicit `alembic upgrade head` from backend | Direct or session connection | Verified `SELECT 1` |

Use Node 22.13+ (match the committed engines/lockfile) and the pinned Python
3.12.15 cloud runtime. The local audit interpreter is recorded separately in the
final report. `render.yaml` disables subsequent automatic deployments and fixes
one service instance. Importing it can still cause an initial deployment; it is
not an instruction to apply it now. Select an appropriate hosting plan yourself;
the template intentionally does not select a paid plan or enable autoscaling.
Render can apply a paid default when a plan is omitted: review and explicitly
choose the approved plan before importing/creating a service.

## Environment variables

Never send credentials in chat, screenshots, shell command arguments, frontend
variables or Git. Set backend secrets in the provider's protected environment
settings and use a protected local environment for manual migration commands.
See `backend/.env.example` for every supported setting and default.

| Variable | Where | Production requirement |
|---|---|---|
| `APP_ENV` | Backend | `production` |
| `DEBUG` | Backend | `false` |
| `DATABASE_URL` | Backend only | psycopg PostgreSQL URL from the real Supabase Connect panel; percent-encode password characters; `sslmode=verify-full` and a trusted `sslrootcert` |
| `JWT_SECRET_KEY` | Backend only | Independently generated random secret, at least 32 characters; legacy `JWT_SECRET` is an alias, do not set both |
| `JWT_ALGORITHM` | Backend | `HS256` only |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Backend | Defaults `taskflow-api`, `taskflow-web`; changing them invalidates existing tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | 30 default, 1–120; legacy `ACCESS_TOKEN_MINUTES` alias |
| `FRONTEND_URL` | Backend | Actual HTTPS frontend origin, no path or trailing route |
| `BACKEND_URL` | Backend | Actual HTTPS API origin |
| `CORS_ORIGINS` | Backend | JSON array or comma-separated explicit HTTPS origins, including `FRONTEND_URL`; no wildcard/localhost |
| `TRUSTED_HOSTS` | Backend | Exact hostnames, including `BACKEND_URL` hostname; JSON array or comma-separated |
| `TRUSTED_PROXY_IPS` | Backend | Explicit verified ingress proxy IP/CIDR allowlist; no `*` or all-address CIDR |
| `WEB_CONCURRENCY` | Backend | `1`; also retain one Render instance |
| `PORT` | Backend | Supplied by Render; launcher validates 1–65535 |
| `DB_POOL_MODE` | Backend | `session` (Supavisor session endpoint) or `direct`; transaction endpoint 6543 is intentionally unsupported |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` | Backend | Defaults 5 + 5 maximum connections for the one worker; budget against the selected Supabase plan |
| `DB_POOL_TIMEOUT_SECONDS`, `DB_POOL_RECYCLE_SECONDS` | Backend | Defaults 10 and 1800 |
| `DB_CONNECT_TIMEOUT_SECONDS` | Backend | 10 default |
| `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS` | Backend | Defaults 15000 and 5000 |
| `AUTH_LOGIN_LIMIT`, `AUTH_REGISTER_LIMIT` | Backend | Defaults 10 and 5 requests per client/path/window |
| `AUTH_RATE_WINDOW_SECONDS`, `AUTH_RATE_MAX_KEYS` | Backend | Defaults 60 seconds and 10000 stored keys; memory is bounded |
| `AUTH_MAX_CONCURRENT` | Backend | Default 2 simultaneous authentication requests, bounding Argon2 memory |
| `VITE_API_URL` | Vercel build | Actual public HTTPS API origin, no credentials, path, query or fragment |
| `VITE_API_MODE` | Vercel build | `external`; `same-origin` is for the local Docker/Nginx profile and forbidden on Vercel |

`VITE_` values are public compiled data. Do not provide database, JWT, Supabase
secret/service-role keys or passwords to Vercel. TaskFlow does not require a
Supabase JS client or browser Data API key.

## Ordered release procedure

1. With approval, configure the Supabase database and obtain the direct or
   **session** connection from the actual Connect panel. Match the region/network
   of the backend. Download the database CA from trusted Supabase settings and
   provide it to Render as a protected secret file. Include its actual path as
   `sslrootcert` and keep `sslmode=verify-full`. Do not disable verification to
   work around a connection error. See [migrations](DATABASE_MIGRATIONS.md).
2. Reserve/identify actual frontend/backend origins, without enabling arbitrary
   Vercel preview domains in CORS. Set backend environment variables. Confirm the
   real Render ingress proxy addresses with the platform documentation/support;
   do not guess a broad trust range. The web process is behind platform ingress,
   not directly published on another port. Incorrect trust causes redirect loops
   or incorrect client-IP rate limiting and must be resolved before release.
3. Take and verify a backup if updating an existing database. Apply migrations
   once through a controlled release job or protected shell. `python start.py`
   does **not** run migrations. Set the migration role to the trusted owner of
   TaskFlow tables; never use browser Data API roles. The migration enables RLS
   without browser policies and removes their table/sequence grants.
4. Deploy the backend manually after approval. `render.yaml` has no deployment
   hook and no automatic migration/pre-deploy command. On plans with a pre-deploy
   phase, a separately reviewed `alembic upgrade head` can be configured there;
   do not assume all plans provide a release shell/pre-deploy phase.
5. Verify the actual HTTPS `/health` response, HTTPS `/ready` response (200 only
   when PostgreSQL responds), certificate chain and HTTP→HTTPS behavior. Confirm
   forwarded headers cannot be spoofed by an untrusted direct client. Health
   output contains no connection data. Do not expose PostgreSQL/API internal
   ports or provide the database credentials to a browser.
   Exact GET health paths also accept the platform's internal HTTP health probe,
   so `/ready` executes its database check instead of returning a 3xx redirect.
   Render terminates public HTTPS at ingress. API/docs still redirect HTTP in
   production. A slow database can exceed the host's probe timeout and must be
   treated as unhealthy; measure this behavior on the actual service.
6. Configure Vercel root `frontend`, set its **build-time** public API origin and
   deploy manually with approval. Rebuild when the API origin changes. Missing,
   HTTP, local or credential-bearing production API values fail the build.
7. Confirm production CORS contains only the actual frontend origins. Use the
   exact origin: scheme, hostname and port matter. Test a valid Authorization
   preflight and an unauthorized origin; a browser must not receive permission
   to read the unauthorized response. CORS does not authenticate users.
8. Verify register → login → project → task → update → logout on disposable
   records. Reload `/app/projects` and `/app/settings`: HTML fallback must load
   and redirect a logged-out user to login, not return a hosting 404. Existing
   memory-only sessions intentionally end on reload. Check assets return their
   correct content type; missing `/assets/` files must not return HTML.
9. Verify en/ru/kk, light/dark/system, browser error handling, CSP, HTTPS/no mixed
   content and correct API destination. Review provider logs without capturing
   tokens or registration passwords. Confirm backup access, retention and an
   isolated restore rehearsal before declaring the release ready.

## Local container profile

The production Compose file is a local production-build verification profile,
bound to loopback and using `APP_ENV=development` because it has local HTTP and
non-TLS PostgreSQL. It is not the cloud production security configuration.

```powershell
docker compose -f docker-compose.prod.yml up -d --wait db
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml up -d backend frontend
```

For cloud production use validated production settings and platform HTTPS.
Do not expose this local profile to the internet as a substitute.

## Limits and sources

The process-local limiter requires one worker and one instance. Before scaling,
introduce a shared atomic limiter or validated platform enforcement; changing
only the worker/instance count weakens the limits. Logout clears the local token;
an already issued Bearer token remains valid until its short expiry. JWT issuance
now includes issuer/audience; old sessions require login after this upgrade.

Official references, consulted 2026-10-17:
[Render FastAPI](https://render.com/docs/deploy-fastapi),
[Blueprint configuration](https://render.com/docs/blueprint-spec),
[Render ingress/TLS](https://render.com/docs/web-services),
[Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite),
[Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[PostgreSQL TLS](https://www.postgresql.org/docs/current/libpq-ssl.html).
