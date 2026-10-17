# Database connections and Alembic migrations

TaskFlow uses synchronous SQLAlchemy 2 with Psycopg 3 and its existing Alembic
history. FastAPI remains the authentication and project-permission boundary;
Supabase supplies PostgreSQL, not application authentication. No Supabase browser
client or Data API key is needed. Startup never creates or upgrades tables.

## Select and protect the connection

Copy the **actual** connection details from the Supabase project's Connect dialog.
For this persistent Render service choose direct PostgreSQL on port 5432 if the
network supports its IP version, or the shared **session** pooler on port 5432.
Set `DB_POOL_MODE=direct` or `session` consistently. Transaction poolers on 6543
are not supported by this release: Psycopg prepared statements and session timeout
settings require a persistent session. Do not infer a pooler hostname from a region.

Use `postgresql+psycopg://` for `DATABASE_URL` (`postgres://` and `postgresql://`
are normalized). URL-encode special characters in individual credentials. Obtain
the Supabase CA certificate and mount it as a protected Render secret file, then
add `sslmode=verify-full&sslrootcert=/path/to/supabase-ca.crt` to the URL. Production
startup rejects a missing TLS verification mode or CA setting. `sslrootcert=system`
is an alternative only when the installed libpq supports it and its trust store
validates the selected host. Never replace verification with `require`, `prefer`,
`disable` or a hostname override to work around a certificate error.

Store the full URL and JWT secret in the backend environment/secret manager only.
Do not paste them into command arguments, screenshots, logs, CI output, frontend
variables or this repository. Missing credentials or invalid certificates must be
fixed in the protected configuration, without printing the connection string.

The API pool defaults to 5 persistent connections plus at most 5 overflow
connections **per process**; queued acquisition waits at most 10 seconds. Budget
`instances * workers * (DB_POOL_SIZE + DB_MAX_OVERFLOW)` against the actual
Supabase connection limit with reserve for migrations, monitoring and backups.
The initial deployment uses one worker. The pool checks stale connections before
checkout and recycles them after 1800 seconds. Connect, statement and lock timeouts
default to 10 seconds, 15 seconds and 5 seconds. Statement/lock timeouts are applied
with SQL session settings on each new connection, outside the request transaction;
they survive rollback and do not depend on a pooler forwarding startup `options`.
Adjust the documented `DB_*` settings using measured needs. A migration uses
`NullPool` and disposes its engine.
Long migrations can require a separately approved larger statement/lock timeout.

The request dependency commits only after successful route execution and before
the response is sent (`scope="function"`); exceptions roll back and sessions close.
Automatic write retries are deliberately avoided: after a lost commit response,
the client cannot know whether a write committed. Inspect the result before retrying.

## History and access control

| Revision | Purpose |
| --- | --- |
| `0001` | Original tables, relationships, checks, uniqueness and indexes; retained unchanged |
| `0002` | Enable RLS on TaskFlow tables and Alembic history; revoke public/Data API access |

`0002` protects `public.users`, `projects`, `project_members`, `tasks`,
`alembic_version` and their ID sequences. It revokes privileges from `PUBLIC` and,
when those roles exist, `anon` and `authenticated`. No browser-facing RLS policies
are created. The trusted backend connects as the table owner; owner bypass of RLS
is intentional because FastAPI checks membership and roles. Do not use an `anon`
or `authenticated` PostgreSQL login for the API. A future dedicated runtime role
requires an explicit reviewed privilege design before rollout.

The migration does not change grants or default privileges for unrelated public
tables. For every future TaskFlow table, add RLS and the same explicit revocations
in its creating migration. Audit inherited grants as well as direct grants if roles
are customized. Supabase's changing default grants do not revoke existing access.
Keep service-role keys and privileged database credentials exclusively on the server.

## Apply and verify

Install the pinned backend dependencies described in [DEPLOYMENT.md](DEPLOYMENT.md).
Run commands from `backend/` in an environment with protected, validated backend
settings already loaded. Use a direct connection for maintenance when reachable;
the session connection is the fallback for IPv4-only hosts. Never use 6543.

First run the exact release on a **new isolated PostgreSQL database**, then obtain
the required approval before changing a live cloud database. Confirm the target,
take a verified backup for an existing installation and schedule one migration
runner. Do not run migrations concurrently from web workers.

```sh
python -m alembic heads
python -m alembic history
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

Expected: one head (`0002`), current revision `0002`, and no new upgrade operations
from the metadata check. A clean installation needs no manual table creation and
must reach this revision through `0001`. Do not use `stamp head` to conceal a failed
upgrade or a pre-existing schema mismatch.

Use a trusted `psql` session (service/password files below) for non-sensitive checks:

```sql
SELECT version_num FROM public.alembic_version;
SELECT 1;
SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();
SELECT relname, relrowsecurity
FROM pg_class JOIN pg_namespace n ON n.oid = relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('users', 'projects', 'project_members', 'tasks', 'alembic_version');
SELECT rolname, tablename,
       has_table_privilege(rolname, 'public.' || tablename, 'SELECT') AS can_read,
       has_table_privilege(rolname, 'public.' || tablename, 'INSERT') AS can_insert,
       has_table_privilege(rolname, 'public.' || tablename, 'UPDATE') AS can_update,
       has_table_privilege(rolname, 'public.' || tablename, 'DELETE') AS can_delete
FROM pg_roles CROSS JOIN (VALUES ('users'), ('projects'), ('project_members'),
    ('tasks'), ('alembic_version')) AS t(tablename)
WHERE rolname IN ('anon', 'authenticated');
```

Expect TLS `true` in cloud, RLS `true` for all five tables, and all role privilege
checks `false` (plain PostgreSQL can return no such roles). Do not select password
hashes or personal data for connectivity testing. Verify the actual Supabase Data
API settings and denial of both anonymous and authenticated Data API requests after
cloud configuration; local PostgreSQL role tests cannot prove live API settings.
Then verify `/health`, `/ready`, registration/login and project/task permissions
against the configured backend. A local result does not verify external TLS,
network reachability or Supabase configuration.

For PostgreSQL command-line tools, put connection metadata in a private
`PGSERVICEFILE` and the password in a separate private `PGPASSFILE`; set only their
paths in the shell. For example, invoke `psql "service=taskflow_maintenance"`.
See [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) for file formats and protection.
Alembic itself continues to use `DATABASE_URL`, not a second configuration system.

## Failure and recovery

Stop the release if an upgrade, readiness check, certificate check or authorization
test fails. Keep the previous application version available. A normal failed
PostgreSQL DDL transaction rolls back, but inspect `alembic current` and the actual
schema before retrying; do not assume a disconnected migration never committed.
Prefer a reviewed forward repair. Never run `downgrade base`, drop tables or restore
over production as an automatic recovery step.

`0002` has a non-destructive downgrade: it deliberately leaves RLS and revoked
grants in place because the prior privileges cannot be reconstructed safely.
Downgrading the revision does **not** reopen Data API access. An application rollback
does not need to remove this security boundary. Test any other downgrade only in
a disposable database after checking its SQL and data-loss implications.

For data recovery, restore the verified backup into a separate isolated database,
check its revision and contents, migrate that copy forward if necessary, verify
permissions and run application smoke tests. A production cutover or restoration
requires separate explicit approval; follow [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md).

## References

- [Supabase PostgreSQL connection modes and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase grants and RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase default-grants rollout](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [SQLAlchemy connection pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [Supabase session timeouts](https://supabase.com/docs/guides/database/postgres/timeouts)
