# PostgreSQL backup and recovery

This is an operating procedure, not confirmation that live backups exist.
Check the selected Supabase plan, enabled backup/PITR features, retention, recovery
limits and last successful restore in the project dashboard before public release.
Record an owner and explicit recovery point/time objectives (RPO/RTO). Provider
backups and PITR complement an independently verified logical export; do not assume
a plan includes or enables either feature.

## Protect credentials and destinations

Use a dedicated protected directory outside the repository, build output, synced
public folders and web roots for service files, passwords and archives. Restrict
Windows ACLs to the backup operator/service identity and administrators; verify the
effective permissions. Windows libpq does not enforce password-file ACLs for you.
On Unix use a private directory (`0700`) and password/service files (`0600`).
Prefer a managed encrypted backup destination with separate access credentials,
encryption at rest, audited access and an off-site copy. Encrypt logical archives
before transfer with the organization's approved tool and test decryption; their
compression and custom format are **not encryption**. Protect hashes/manifests and
logs alongside the archive. Backups contain password hashes and personal data.

Use a maintenance/backup connection from the Supabase Connect dialog: direct
port 5432 is recommended; session pooler 5432 is the IPv4 fallback. Never use a
transaction pooler. Use the same verified CA/hostname configuration as the API.
The database role must be authorized to export all TaskFlow rows (the table owner
works with this release's RLS model). A limited role that silently omits rows is
not a valid backup identity.

Create a private service file with operator-supplied metadata. The angle-bracket
entries below are placeholders; replace them privately, not in this repository:

```ini
[taskflow_backup]
host=<actual-host-from-supabase-connect>
port=5432
dbname=postgres
user=<authorized-backup-role>
sslmode=verify-full
sslrootcert=<absolute-path-to-supabase-ca>
connect_timeout=10

[taskflow_restore_test]
host=127.0.0.1
port=<isolated-test-port>
dbname=<new-disposable-name-ending-in-_test>
user=<isolated-test-owner>
sslmode=disable
connect_timeout=10
```

`sslmode=disable` is only for an isolated loopback PostgreSQL test instance; cloud
connections must verify TLS. Store passwords separately in the private password
file, one exact host/port/database/user entry per identity:

```text
<host>:<port>:<database>:<username>:<password>
```

Escape `:` and `\` inside a password-file field with `\`. Avoid broad wildcards.
Set `PGSERVICEFILE` and `PGPASSFILE` to these files' absolute paths. The default
Windows locations are `%APPDATA%\postgresql\.pg_service.conf` and
`%APPDATA%\postgresql\pgpass.conf`; explicit paths simplify operator isolation.
Do not use credential-bearing URLs, `PGPASSWORD`, shell history, `set -x`, environment
dumps or shared terminal transcripts for backup commands. `--no-password` makes
an unattended job fail if its protected password file is missing.

## Create a logical backup

Use PostgreSQL client tools compatible with the source server (same major version
is the simplest baseline). Verify the source host, database and role privately.
The commands below run from the private backup directory; they do not create a
production connection until an operator supplies approved credentials.

```sh
pg_dump --dbname="service=taskflow_backup" --no-password --format=custom --no-owner --no-acl --strict-names --table=public.users --table=public.projects --table=public.project_members --table=public.tasks --table=public.alembic_version --table=public.users_id_seq --table=public.projects_id_seq --table=public.project_members_id_seq --table=public.tasks_id_seq --file=taskflow-release.dump
pg_restore --list taskflow-release.dump
```

Require a zero exit status and review warnings without publishing sensitive logs.
Use a unique UTC timestamp/release in the real filename; do not overwrite the last
known-good archive. The allowlist explicitly includes ID sequences, alongside
the tables and their indexes and constraints. Update it when migrations add objects.
This archive covers TaskFlow application data and Alembic history, not Supabase
managed auth/storage, roles, provider settings, uploaded objects or other schemas.
Preserve configuration, release commit, database/client versions, migration head,
table inventory and recovery notes separately in the protected manifest. Do not
export cluster role password hashes into Git.

Compute SHA-256 (for example `Get-FileHash taskflow-release.dump -Algorithm SHA256`
in PowerShell), record size/time and verify the hash after transfer and decryption.
`pg_restore --list` verifies that the archive can be read, **not** that recovery
works. A successful isolated restore and smoke test are required.

## Restore only into a new isolated database

An operator must first provision a new empty disposable database on a separate
local test cluster or isolated non-production project. Use a new name ending in
`_test`, dedicated credentials and a service entry that is different from source.
Before restoration, independently verify its host, port and name and inspect that
it has no application tables. Do not use an existing application database merely
because its name ends in `_test`. Do not include `--clean` or `--create` in the
restore command, and never point this procedure at production.

```sh
psql "service=taskflow_restore_test" --no-password -v ON_ERROR_STOP=1 -c "SELECT current_database(), inet_server_addr(), inet_server_port();"
pg_restore --dbname="service=taskflow_restore_test" --no-password --exit-on-error --single-transaction --no-owner --no-acl taskflow-release.dump
```

The restored objects belong to the restore identity. `--no-acl` avoids importing
source privileges; check the destination's default grants. Even when an archive
contains revision `0002`, its ACLs were intentionally omitted and `alembic upgrade
head` alone will not replay that revision. For this disposable restored copy,
reapply the allowlist's access boundary as its owner before exposing any service:

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.users, public.projects, public.project_members,
    public.tasks, public.alembic_version FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SEQUENCE public.users_id_seq, public.projects_id_seq,
    public.project_members_id_seq, public.tasks_id_seq FROM PUBLIC;
DO $taskflow$
DECLARE target_role text;
BEGIN
    FOR target_role IN SELECT rolname FROM pg_catalog.pg_roles
        WHERE rolname IN ('anon', 'authenticated')
    LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.users, public.projects,
            public.project_members, public.tasks, public.alembic_version FROM %I', target_role);
        EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE public.users_id_seq,
            public.projects_id_seq, public.project_members_id_seq, public.tasks_id_seq
            FROM %I', target_role);
    END LOOP;
END
$taskflow$;
```

Save this SQL privately and execute with `psql "service=taskflow_restore_test"
--no-password -v ON_ERROR_STOP=1 --file=<reviewed-security-file>` against the
verified isolated target only. Inspect effective/inherited grants and confirm
there are no unexpected RLS policies. Run the role/RLS verification queries in
[DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md). This does not authorize a live
restoration, role change or grant change.

Next, check Alembic revision, compare expected row counts/invariants and sequence
values, and start the release against this isolated copy using a separate temporary
JWT secret. If it is an older backup, migrate that copy forward. Verify `/ready`,
registration, login, project/task creation/update, permission denial, and the three
languages. Use test users and keep recovered personal data private. Record actual
restore duration and recovery point, then securely remove the isolated copy when
the approved verification is finished. Restore only trusted archives: restoring
an archive executes SQL supplied by its source.

## Retention and recovery checklist

A starting policy to approve is 7 daily, 4 weekly and 3 monthly independent
encrypted backups, adjusted to data sensitivity, cost, RPO/RTO and deletion duties.
Run a restore drill at least monthly and after schema/backup-tool changes. Retain
the last verified backup until its replacement has passed restoration; expire
old copies through the storage system's lifecycle policy and verify deletion.
Monitor backup failures, age of the newest successful backup, integrity checks,
storage access and age of the last successful drill. A scheduled job is not proof
of a usable backup.

For an incident:

1. Stop/limit writes using an approved incident procedure and record the event.
2. Identify the required recovery point and a verified backup/PITR capability.
3. Check authorized access, decrypt privately and verify archive integrity.
4. Restore to a fresh isolated target and validate schema, rows and permissions.
5. Run smoke tests and measure the actual data loss and restoration duration.
6. Prepare a reviewed cutover/rollback plan; obtain explicit production approval.
7. After an approved cutover, verify health and access, resume writes and monitor.
8. Record the cause, recovery evidence and follow-up actions without credentials.

No cloud backup, live recovery or production cutover is performed by this document.

## References

- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [PostgreSQL service files](https://www.postgresql.org/docs/current/libpq-pgservice.html)
- [PostgreSQL password files](https://www.postgresql.org/docs/current/libpq-pgpass.html)
- [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
