# TaskFlow

[English](README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md)

A multilingual project management application built with React, FastAPI and PostgreSQL. Version 1.0.0 includes projects, team roles, tasks, Kanban and workspace statistics from real data. See [verification notes](docs/verification.md) for executed checks and remaining release criteria.

## Features

- Argon2 passwords, short-lived Bearer JWTs, server-enforced project permissions.
- Project CRUD, search and pagination; add registered teammates by email.
- OWNER/ADMIN/MEMBER roles, task ownership and assignee status permissions.
- Tasks with priorities, assignees, local-time deadlines, filters and sorting.
- Kanban drag-and-drop with rollback, accessible status selectors, task details and personal tasks.
- Real dashboard totals, project progress, task chart, upcoming deadlines and recent work.
- English, Russian and Kazakh UI, API messages and localized API documentation.
- Light, dark and system themes, responsive navigation and accessible dialogs.

Tokens stay in memory. **Reloading the page or token expiry requires signing in again.** Only language and appearance persist locally. No demo credentials or fabricated application data.

## Stack

Python 3.12+, FastAPI, SQLAlchemy 2, PostgreSQL 17, Alembic, Pydantic 2, PyJWT, Argon2, Pytest/HTTPX. React 19, TypeScript, Vite, Tailwind 4, shadcn-style Radix components, React Router, TanStack Query, Axios, React Hook Form/Zod, react-i18next, Lucide, Recharts, dnd-kit. Vitest/Testing Library, Playwright, Docker Compose and GitHub Actions.

## Docker quick start

Install Docker with Compose. From the repository root:

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Edit `.env`: set a random URL-safe `POSTGRES_PASSWORD` and an independently generated `JWT_SECRET` of at least 32 characters. Configure `POSTGRES_USER` and `POSTGRES_DB` if needed. Never commit `.env`.

```powershell
docker compose up --build
```

Open [TaskFlow](http://localhost:5173), choose **Create account**, enter a unique username, valid email and password, then sign in. Create a project and tasks. Teammates must register before being added by email. PostgreSQL uses a persistent volume; the backend waits for database health and applies migrations automatically.

API: [health](http://localhost:8000/api/v1/health), [Swagger](http://localhost:8000/docs), [ReDoc](http://localhost:8000/redoc), localized docs at `/docs/en`, `/docs/ru`, `/docs/kk`.

```powershell
docker compose exec backend alembic upgrade head
docker compose down
```

Stopping preserves data. Removing the database volume deletes data.

## Manual installation and database setup

Install Python 3.12+, Node 22.12+ and PostgreSQL 17. PowerShell commands:

```powershell
createuser -U postgres --pwprompt taskflow
createdb -U postgres -O taskflow taskflow
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -c backend/constraints.txt -e 'backend[test]'
Copy-Item backend/.env.example backend/.env
```

Configure `backend/.env`:

- `DATABASE_URL=postgresql+psycopg://taskflow:YOUR_PASSWORD@localhost:5432/taskflow`
- `JWT_SECRET`: separate random secret of at least 32 characters.
- `ACCESS_TOKEN_MINUTES=30` (allowed range 1–120).
- `CORS_ORIGINS=["http://localhost:5173"]` (explicit frontend origins).

Run from the backend directory so its environment file resolves correctly:

```powershell
cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

`VITE_API_URL=http://localhost:8000` is public configuration. Never put backend secrets in `VITE_` variables. An empty API URL uses the current origin for the production proxy. On Linux/macOS use `.venv/bin/python` and `npm` instead of Windows executable paths.

## Tests

Create a **separate** PostgreSQL database with a name ending in `_test`. Tests reject other names and the application URL. Apply the real migrations; each test rolls back its outer transaction and does not drop tables.

```powershell
createdb -U postgres -O taskflow taskflow_test
cd backend
$env:TEST_DATABASE_URL='postgresql+psycopg://taskflow:YOUR_PASSWORD@localhost:5432/taskflow_test'
$appDatabase=$env:DATABASE_URL
$env:DATABASE_URL=$env:TEST_DATABASE_URL
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m alembic check
$env:DATABASE_URL=$appDatabase
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m pytest -q
```

Without `TEST_DATABASE_URL`, integration tests explicitly skip. A passing run must execute them against PostgreSQL.

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright requires the API on port 8000 and starts or reuses the frontend on 5173. It creates real unique accounts/projects, testing register → login → project → task → status update → logout and language/theme switching. Use a disposable development database. CI runs Python lint, PostgreSQL tests, migration drift checks, TypeScript, frontend tests/build and Compose smoke tests.

## Production

```powershell
docker compose -f docker-compose.prod.yml up --build -d
```

Open [localhost:8080](http://localhost:8080). Nginx serves the optimized build and proxies API calls on the same origin. Database/API ports are private. Configure HTTPS termination, backups and unique secrets before publishing publicly.

## Architecture and API

```mermaid
flowchart LR
    UI[React / TanStack Query] -->|REST + JWT| API[FastAPI routers]
    API --> Services[Business services + permissions]
    Services --> DB[(PostgreSQL)]
    Alembic --> DB
```

```text
backend/app/       core, db, models, schemas, routers, services, i18n
backend/alembic/   versioned migrations
backend/tests/     PostgreSQL integration tests
frontend/src/      api, components, contexts, locales, pages, types, utils
frontend/tests/    browser smoke tests
docs/              architecture, API, verification
screenshots/       real application captures
.github/workflows/ CI
```

[API examples/contracts](docs/api.md) · [Architecture and permissions](docs/architecture.md) · [Verification and limitations](docs/verification.md) · [Screenshots](screenshots).

## Future improvements

Secure HTTP-only cookie refresh sessions, password recovery, verified email, public-host rate limiting, invitations, ownership transfer and persisted task ordering are outside v1. There are no nonfunctional controls for them.

[MIT license](LICENSE).

![TaskFlow](screenshots/dashboard-en.png)
