# Render Free ingress

Status: source and local tests verified; hosted verification remains pending.
Applying `render.yaml` creates a public service and requires publication approval.
Automatic deploys are disabled, including for later source pushes; creating the
service can still initiate its first deployment.

## Selected topology

The Blueprint explicitly selects a **Free public web service in Singapore**,
one instance, `WEB_CONCURRENCY=1`, and `python start.py`. Supabase supplies
PostgreSQL separately. Alembic migrations remain an explicit approved release
step; web startup does not migrate the database.

This mode relies on three documented platform properties:

- Render redirects public HTTP requests to HTTPS, terminates TLS at its load
  balancer, and forwards HTTP to the application. [Web services](https://render.com/docs/web-services).
- Free web services cannot receive private-network traffic. Paid web services can,
  so changing the compute plan requires reviewing and replacing this ingress
  configuration. [Free service limits](https://render.com/docs/free),
  [private networking](https://render.com/docs/private-network).
- Cloudflare overwrites `CF-Connecting-IP` for public Render web-service requests.
  It appends to `X-Forwarded-For`, whose leftmost value can be supplied by a caller.
  [Render's client-IP guidance](https://render.com/articles/host-pocketbase-on-render).

## Configuration and guards

The Blueprint sets `INGRESS_MODE=render-free` and
`RENDER_FREE_INGRESS_ACK=true`. The acknowledgment explicitly accepts the Free
public-service topology above. Do not enable it for a private service or reuse it
after changing the compute plan.

Render automatically supplies these platform markers. Do not override or invent
them in the Blueprint or environment store:

| Marker | Required value or relationship |
| --- | --- |
| `RENDER` | `true` |
| `RENDER_SERVICE_TYPE` | `web` |
| `RENDER_SERVICE_ID` | Actual `srv-...` service identifier |
| `RENDER_EXTERNAL_HOSTNAME` | Actual public `onrender.com` hostname, matching `BACKEND_URL` |
| `RENDER_CPU_COUNT` | Exact string `0.1`, the current Free web-service CPU count |

The marker names and values are documented in
[default environment variables](https://render.com/docs/environment-variables).
The current [compute-plan catalog](https://render.com/docs/compute-plans) lists
Free web services with 0.1 CPU. The exact runtime string must still be verified
on the deployed service. A missing or changed marker causes startup to fail;
these guards must not be bypassed to accommodate an unreviewed plan or platform
change. They are configuration checks, not cryptographic attestation.

`APP_ENV=production`, strong backend secrets, verified database TLS, explicit
HTTPS frontend/backend URLs, exact `CORS_ORIGINS`, and exact `TRUSTED_HOSTS`
remain required. Include the provider's public backend hostname in
`TRUSTED_HOSTS`. Store credentials only in the backend's secret settings.

`TRUSTED_PROXY_IPS` is not needed in this mode because the launcher disables
Uvicorn's generic forwarded-header processing. No wildcard or guessed proxy
CIDRs are used. The default `INGRESS_MODE=explicit-proxy` behavior is unchanged
and still requires explicit trusted proxy addresses in production.

## Request handling

Before CORS or application routes run, the Render adapter requires exactly one
valid public `CF-Connecting-IP` and exactly one `X-Forwarded-Proto: https`.
Duplicate, missing or malformed edge headers are rejected with a generic 400.
The protocol header is a consistency check: the documented public edge HTTPS
contract establishes scheme trust, not a caller-supplied protocol value.

The adapter canonicalizes the client IP, sets the request scheme to HTTPS, and
discards generic forwarding headers. Forged `X-Forwarded-For` or `Forwarded`
values cannot reset authentication rate-limit buckets. Valid requests receive
the existing HTTPS security headers and exact-origin CORS behavior.

Only exact `GET /health`, `GET /api/v1/health`, and `GET /ready` can run without
Cloudflare client headers for internal probes. They retain their original scheme,
still pass hostname validation, and execute the actual health/readiness checks.
`/ready` tests database connectivity and returns 503 on failure. The exception
does not apply to POST, authentication, other API routes, or documentation.

Authentication limits are process-local. Keep one worker and one instance until
a shared limiter is implemented and verified.

## Required hosted evidence

Local ingress, launcher, and production-security tests passed (112 tests); lint,
formatting, and whitespace checks passed. These checks do not establish that the
actual provider header chain matches the contract.

Before declaring the public release successful, verify:

1. Actual platform markers and Free compute plan; no marker overrides or private
   inbound path; exactly one instance and one worker.
2. Public HTTPS certificate validation, HTTP-to-HTTPS redirects, API requests
   without redirect loops, HSTS, exact CORS, and backend readiness.
3. Real public requests carrying forged `X-Forwarded-For`, `Forwarded`,
   `CF-Connecting-IP`, and protocol headers cannot choose a different rate-limit
   identity or weaken HTTPS handling. Confirm duplicate/malformed inputs are
   rejected or safely normalized by the provider before reaching the application.
4. Consecutive authentication attempts share the caller's bucket despite forged
   forwarding values, while requests from distinct real clients have independent
   buckets. Do not expose a public client-IP diagnostic endpoint for this check.
5. Render's actual internal GET readiness probe executes successfully with
   database access and valid hostname handling; a failed database check is never
   accepted merely because it redirected.

Stop and review the ingress contract if these checks fail. Do not resolve a
header or marker mismatch by enabling wildcard proxy trust.
