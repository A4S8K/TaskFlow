# Verification — 17 October 2026

TaskFlow is implemented and running locally. It is **not yet a fully verified v1.0 release**, because Docker startup and the hosted GitHub Actions workflow could not be executed on this machine.

## Executed checks

| Check | Result |
|---|---|
| PostgreSQL 17.11 application/test databases | Running locally, with separate databases |
| Alembic initial migration | Applied to application and test databases |
| Alembic model/schema drift check | Passed; no new upgrade operations |
| Pytest integration suite | 21 passed against PostgreSQL |
| Ruff Python lint | Passed |
| Python dependency consistency | Passed |
| TypeScript validation | Passed |
| Vitest/Testing Library | 40 passed across 10 files |
| Frontend production build | Passed; page-level chunks generated |
| Playwright Chromium desktop/mobile | 2 passed against the real API and PostgreSQL |
| Development server startup | FastAPI on 8000 and Vite on 5173 verified |
| Compose/CI YAML parsing | Passed; production API/database ports are private |

Backend coverage includes registration, duplicate email, wrong/expired/invalid tokens, exact password preservation, protected routes, project CRUD, membership roles, owner protection, task CRUD/assignment/status, assignee field restrictions, cross-project access, filtering, sorting, pagination, dashboard isolation, all three languages, language precedence, saved preferences and localized documentation.

Frontend tests cover login/registration validation and errors, dialogs, localization dictionary parity, API authentication/language behavior, date conversion, preference controls, project creation, task edit restrictions, dashboard data/error states, optimistic board rollback, and preference responses arriving after logout.

Browser smoke tests cover registration → login → project creation → task creation → actual drag-and-drop → task status save → language switching → dark theme → logout, plus mobile navigation, overflow checks, and session clearing on reload. Screenshots in `screenshots/` are captured from these actual test sessions. Their accounts and projects are test records, not claimed customer activity.

## Remaining verification

- Docker is not installed or on the command path. Neither development nor production container startup/build was executed locally. YAML validation does not establish that containers run. CI includes a Compose-backed browser smoke job to exercise the development image on a Docker host.
- GitHub Actions has been authored but not run on GitHub; no repository remote/publication was configured during this task.
- Browser smoke coverage is Chromium; Firefox, WebKit, touch drag gestures and screen-reader testing remain unverified. Mobile provides native status selectors.
- A dependency emits an upstream Starlette/AnyIO `BlockingPortal` deprecation warning during tests; the suite passes. Application code does not call that deprecated alias.

## v1 boundaries

- Memory-only sessions intentionally end on reload or expiry. No refresh tokens, email verification or password recovery.
- Project ownership transfer and manual ordering within Kanban columns are outside v1. Board column counts refer to the current paginated result, not the entire project.
- Project dashboards show the six most recently updated projects, six recent tasks and six upcoming deadlines within fourteen days. Counts cover all accessible projects/tasks.
- Task search uses PostgreSQL `ILIKE`; large-scale full-text indexing and query optimization are future work. Priority sorting currently follows enum labels.
- Production Compose is a starting deployment configuration; provide TLS termination, backups, public-host abuse protection and secret management before opening it to the internet.

## Local validation environment

The task provisioned an ignored PostgreSQL runtime/data directory under `.validation-deps/`, bound to `127.0.0.1:55432`. `backend/.env` contains generated local credentials and a generated JWT secret. These are ignored by Git. The application database is `taskflow`; `taskflow_test` is separate and tests roll back their outer transactions. Smoke tests create uniquely named real records in the application database.

To stop the local validation database from the repository root:

```powershell
.validation-deps/pgsql/bin/pg_ctl.exe -D .validation-deps/pgdata stop
```

Follow the README for a fresh setup on the standard PostgreSQL port 5432 or with Docker. No deployment links or CI success claims have been invented.
