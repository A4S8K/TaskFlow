# Security model and operations

FastAPI is the authority for TaskFlow authentication and project permissions.
The browser holds a Bearer token only in memory. PostgreSQL is never called
directly from the frontend. Do not configure browser Supabase Data API access to
TaskFlow tables. See [deployment](DEPLOYMENT.md) for environment and network
requirements, [audit](PRODUCTION_AUDIT.md) for initial findings and the root
production report for executed evidence.

## Authentication and authorization

- Passwords are Argon2 hashes, never plaintext database fields. Login uses generic
  invalid-credential messages and a timing-equalizer hash for unknown accounts.
- HS256 is the only allowed JWT algorithm. Tokens require subject, issued-at,
  expiry, issuer and audience; malformed, expired and wrongly signed tokens are
  rejected. No refresh token or persistent browser token was introduced.
- OWNER/ADMIN/MEMBER checks and membership scoping remain on the backend. Tests
  verify cross-project isolation, protected endpoints and restricted task edits.
- Auth rate limits apply before validation/hashing, have bounded memory and
  return 429 with Retry-After. Concurrent auth requests are bounded as well.
  They depend on trustworthy client IPs and the single-worker/single-instance
  release topology. They are not a substitute for platform abuse protection.
- Registration can return a generic conflict for duplicate identifiers. It does
  not promise full account-enumeration prevention. Login does not identify
  whether a supplied email exists.
- Logout removes browser memory state. It does not revoke a stolen issued token;
  expiry is short. An incident may require planned JWT key rotation, which logs
  out every user. Never rotate external credentials automatically during audit.

## Database boundary

Migration 0002 enables RLS on application and Alembic tables and revokes
PUBLIC/anon/authenticated table and sequence privileges. It supplies no browser
policies. The backend must use the trusted table owner; owner bypass is
intentional because FastAPI performs tenant authorization. Do not add a blanket
`auth.uid()` policy: these integer TaskFlow identities are not Supabase Auth
identities. No service-role or secret key belongs in browser code.

Production connections require certificate/hostname-verified TLS and use bounded
pool, connect, statement and lock timeouts. No raw connection URL or SQL
parameters should appear in application error logs. Readiness returns only
generic status. Temporary outages return localized 503 responses; unsuccessful
request transactions roll back. No automatic schema creation occurs at startup.

## Browser/network controls

Production public URLs/CORS use explicit HTTPS origins and exact trusted hosts.
Wildcard CORS/proxy trust is refused. Host platform TLS terminates HTTPS; the
launcher trusts forwarded headers only from configured proxies. Production
redirects HTTP and provides HSTS/security headers. Verify the real host/proxy
chain before enabling public traffic; local tests cannot establish that boundary.

Vercel gets a CSP built with the exact configured API origin and headers such as
nosniff, frame denial, Referrer-Policy and Permissions-Policy. Existing UI inline
styles are allowed for charts, Radix and drag-and-drop; inline scripts/eval are
not allowed. SPA fallback excludes built assets. CORS is browser response-sharing
policy, not authentication or protection against non-browser API calls.

## Secret handling and incident response

Keep `.env`, PostgreSQL service/password files, keys, databases and backups out of
Git. `.env.example` must contain placeholders only. Use protected provider secret
settings and restricted local file ACLs. Avoid credential-bearing URLs in shell
arguments and screenshots. Never enable SQL echo or raw tracebacks in production.
Swagger schemas contain field descriptions/contracts, not environment values.

Before a release:

1. Scan the full Git history and the proposed commit with a secret scanner, then
   review findings without printing candidate values. Inspect dependencies with
   `npm audit` and `pip-audit` against the installed/pinned dependencies.
2. If a real secret was published, treat it as exposed: identify affected systems,
   revoke/rotate it with authorized operators, review access logs and update
   secret stores. Adding `.gitignore` does not remove an exposed credential.
3. Decide separately whether history remediation is needed. Do not force-push,
   rewrite history, revoke credentials or contact other people without approval.
4. Restore service only after validating new credentials, authorization, logs,
   backup access and a fresh secret scan. Record incident facts without secrets.

Report vulnerabilities privately to the repository owner through a channel they
provide; do not put credentials or exploitable private data in public issues.
No email address or security contact has been invented by this audit.

## Verification limits

Dependency/secret scanners find known patterns/advisories, not all vulnerabilities.
The report distinguishes local PASS from live cloud BLOCKED. Password recovery,
email verification, refresh sessions and distributed abuse protection remain
future features; UI does not advertise controls that do not work.
