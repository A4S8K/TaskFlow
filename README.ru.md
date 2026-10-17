# TaskFlow — Управление проектами и задачами

[English](README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md)

Полноценное приложение на React, FastAPI и PostgreSQL. Проекты, команда, задачи и статистика по реальным данным.

Регистрация и вход; проекты; роли владельца, администратора и участника; управление командой по почте; канбан с перетаскиванием и откатом; личные задачи; поиск, фильтры, сортировка и страницы; русский, казахский и английский интерфейс; светлая, тёмная и системная тема.

**Токен хранится только в памяти. Обновление страницы или истечение токена требует повторного входа. Локально сохраняются только язык и тема.**

## Технологии

Python 3.12+, FastAPI, SQLAlchemy 2, PostgreSQL 17, Alembic, Pydantic 2, PyJWT, Argon2. React 19, TypeScript, Vite, Tailwind 4, Radix/shadcn, React Router, TanStack Query, Axios, React Hook Form/Zod, react-i18next, Lucide, Recharts, dnd-kit. Pytest/HTTPX, Vitest, Testing Library, Playwright, Docker Compose, GitHub Actions.

## Docker

Установите Docker с Compose. Из корня репозитория выполните:

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Замените `POSTGRES_PASSWORD` случайным паролем без специальных символов URL, а `JWT_SECRET` — отдельным случайным секретом длиной от 32 символов. Не публикуйте `.env`.

```powershell
docker compose up --build
```

Откройте [приложение](http://localhost:5173), создайте учётную запись с уникальным именем, почтой и паролем, затем войдите. Создайте проект и задачи; участники должны зарегистрироваться перед добавлением по почте. Миграции выполняются автоматически. Данные сохраняются в томе.

API: [Swagger](http://localhost:8000/docs), [ReDoc](http://localhost:8000/redoc), [/docs/ru](http://localhost:8000/docs/ru).

```powershell
docker compose exec backend alembic upgrade head
docker compose down
```

## Установка

Python 3.12+, Node 22.12+, PostgreSQL 17. PowerShell:

```powershell
createuser -U postgres --pwprompt taskflow
createdb -U postgres -O taskflow taskflow
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -c backend/constraints.txt -e 'backend[test]'
Copy-Item backend/.env.example backend/.env
```

## Настройка

В `backend/.env` укажите:

- `DATABASE_URL=postgresql+psycopg://taskflow:YOUR_PASSWORD@localhost:5432/taskflow`
- `JWT_SECRET`: отдельный случайный секрет от 32 символов.
- `ACCESS_TOKEN_MINUTES=30`
- `CORS_ORIGINS=["http://localhost:5173"]`

Запустите сервер из папки `backend`:

```powershell
cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

В другом терминале:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

`VITE_API_URL=http://localhost:8000` — публичный адрес API. Секреты нельзя помещать в `VITE_`. На Linux/macOS используйте `.venv/bin/python` и `npm`.

## Тестирование

Создайте отдельную базу с именем, заканчивающимся на `_test`. Тесты отклоняют другие имена и адрес рабочей базы. Примените миграции; каждый тест откатывает свою транзакцию.

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

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Без `TEST_DATABASE_URL` тесты PostgreSQL пропускаются. Для Playwright нужен API на 8000; интерфейс на 5173 запускается автоматически. Проверяется регистрация → вход → проект → задача → статус → выход и языки/тема. Создаются реальные записи — используйте одноразовую среду. CI проверяет Python, миграции, PostgreSQL, TypeScript, тесты, сборку и Compose.

## Промышленная сборка

```powershell
docker compose -f docker-compose.prod.yml up --build -d
```

[localhost:8080](http://localhost:8080). Nginx раздаёт готовую сборку и проксирует API. База и API не имеют внешних портов. Для публикации настройте HTTPS, резервные копии и секреты.

## Архитектура и API

```mermaid
flowchart LR
    React --> FastAPI
    FastAPI --> Services
    Services --> PostgreSQL
    Alembic --> PostgreSQL
```

`backend/app` — модели, схемы, маршруты, сервисы, безопасность, переводы; `backend/alembic` — миграции; `backend/tests` — тесты PostgreSQL; `frontend/src` — интерфейс; `frontend/tests/e2e` — браузерные проверки; `docs` — документация; `screenshots` — настоящие снимки; `.github/workflows` — CI.

[Примеры API](docs/api.md) · [Архитектура](docs/architecture.md) · [Результаты проверок и ограничения](docs/verification.md) · [Снимки экрана](screenshots).

## Развитие

Безопасное обновление сессии через HTTP-only cookie, восстановление пароля, подтверждение почты, ограничение частоты запросов, приглашения, передача владения и порядок карточек — вне v1.

[MIT](LICENSE).

![TaskFlow](screenshots/dashboard-en.png)
