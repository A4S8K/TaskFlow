# TaskFlow — Жобалар мен тапсырмаларды басқару

[English](README.md) · [Русский](README.ru.md) · [Қазақша](README.kk.md)

React, FastAPI және PostgreSQL негізіндегі толық қолданба. Жобалар, команда, тапсырмалар және нақты деректер статистикасы.

Тіркелу және кіру; жобалар; иесі, әкімші және қатысушы рөлдері; пошта арқылы команда басқару; кері қайтаруы бар канбан; жеке тапсырмалар; іздеу, сүзгілеу, сұрыптау және беттеу; қазақ, орыс және ағылшын тілдері; ашық, күңгірт және жүйелік тақырып.

**Токен тек жедел жадта сақталады. Бетті жаңартқанда немесе мерзімі біткенде қайта кіру қажет. Құрылғыда тек тіл мен тақырып сақталады.**

## Технологиялар

Python 3.12+, FastAPI, SQLAlchemy 2, PostgreSQL 17, Alembic, Pydantic 2, PyJWT, Argon2. React 19, TypeScript, Vite, Tailwind 4, Radix/shadcn, React Router, TanStack Query, Axios, React Hook Form/Zod, react-i18next, Lucide, Recharts, dnd-kit. Pytest/HTTPX, Vitest, Testing Library, Playwright, Docker Compose, GitHub Actions.

## Docker

Docker және Compose орнатыңыз. Репозиторий түбірінен орындаңыз:

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`POSTGRES_PASSWORD` мәнін URL үшін қауіпсіз кездейсоқ құпиясөзге, `JWT_SECRET` мәнін кемінде 32 таңбалы бөлек кездейсоқ құпияға ауыстырыңыз. `.env` жарияламаңыз.

```powershell
docker compose up -d --wait db
docker compose build
docker compose run --rm backend alembic upgrade head
docker compose up backend frontend
```

[Қолданбаны](http://localhost:5173) ашып, бірегей ат, пошта және құпиясөзбен тіркеліңіз, содан кейін кіріңіз. Жоба мен тапсырмалар құрыңыз. Команда мүшелері қосылу алдында тіркелуі керек. Миграциялар жоғарыдағы бөлек пәрменмен орындалады. Деректер тұрақты томда сақталады.

API: [Swagger](http://localhost:8000/docs), [ReDoc](http://localhost:8000/redoc), [/docs/kk](http://localhost:8000/docs/kk).

```powershell
docker compose exec backend alembic upgrade head
docker compose down
```

## Орнату

Қауіпсіздік жаңартулары бар Python 3.12+, Node 22.13+, PostgreSQL 17. PowerShell:

```powershell
createuser -U postgres --pwprompt taskflow
createdb -U postgres -O taskflow taskflow
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install --upgrade pip==26.2
backend/.venv/Scripts/python.exe -m pip install -c backend/constraints.txt -e 'backend[test]'
Copy-Item backend/.env.example backend/.env
```

## Баптау

`backend/.env` ішінде орнатыңыз:

- `DATABASE_URL=postgresql+psycopg://taskflow:YOUR_PASSWORD@localhost:5432/taskflow`
- `JWT_SECRET`: кемінде 32 таңбалы бөлек құпия.
- `ACCESS_TOKEN_MINUTES=30`
- `CORS_ORIGINS=["http://localhost:5173"]`

Серверді `backend` бумасынан іске қосыңыз:

```powershell
cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Басқа терминалда:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

`VITE_API_URL=http://localhost:8000` — ашық API мекенжайы. `VITE_` ішіне құпиялар жазылмайды. Linux/macOS жүйесінде `.venv/bin/python` және `npm` пайдаланыңыз.

## Тестілеу

Атауы `_test` жалғауымен аяқталатын бөлек дерекқор құрыңыз. Басқа атаулар мен қолданба мекенжайы қабылданбайды. Миграцияларды орындаңыз; әр тест транзакциясын кері қайтарады.

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
npm.cmd run lint
npm.cmd test
$env:VITE_API_URL='https://api.taskflow.invalid' # Тек компиляцияға арналған сынақ мекенжайы
npm.cmd run build
$env:VITE_API_URL='http://localhost:8000' # Playwright үшін бір реттік жергілікті API
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

`TEST_DATABASE_URL` болмаса, PostgreSQL тесттері өткізіледі. Playwright үшін 8000 портында API қажет; 5173 портындағы интерфейс автоматты қосылады. Тіркелу → кіру → жоба → тапсырма → күй → шығу және тіл/тақырып тексеріледі. Нақты жазбалар жасалады — бір реттік орта қолданыңыз. CI Python, миграциялар, PostgreSQL, TypeScript, тесттер, жинақ және Compose тексереді.

## Өндірістік жинақ

```powershell
docker compose -f docker-compose.prod.yml up -d --wait db
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml up -d backend frontend
```

[localhost:8080](http://localhost:8080). Бұл loopback HTTP және PostgreSQL үшін әзірлеу баптауларымен дайын жинақты жергілікті тексеру. Nginx жинақты таратып, API сұрауларын бағыттайды. Бұлтқа жариялау үшін [Vercel/Render/Supabase нұсқаулығын](docs/DEPLOYMENT.md) және [қорытынды есепті](PRODUCTION_READINESS_REPORT.md) қараңыз. Нақты орналастыру орындалған жоқ; бұлттағы дайындық әлі расталмаған.

## Архитектура және API

```mermaid
flowchart LR
    React --> FastAPI
    FastAPI --> Services
    Services --> PostgreSQL
    Alembic --> PostgreSQL
```

`backend/app` — модельдер, схемалар, маршруттар, сервистер, қауіпсіздік, аудармалар; `backend/alembic` — миграциялар; `backend/tests` — PostgreSQL тесттері; `frontend/src` — интерфейс; `frontend/tests/e2e` — браузер тексерулері; `docs` — құжаттама; `screenshots` — нақты суреттер; `.github/workflows` — CI.

[API мысалдары](docs/api.md) · [Архитектура](docs/architecture.md) · [Тексерулер мен шектеулер](docs/verification.md) · [Экран суреттері](screenshots).

## Болашақ жетілдірулер

HTTP-only cookie арқылы сессия жаңарту, құпиясөз қалпына келтіру, поштаны растау, таратылған теріс пайдаланудан қорғау, шақыру, меншік құқығын беру және карточка ретін сақтау v1 құрамына кірмейді. Кіру сұрауларының жиілігі мен параллельдігі бір процесс және бір сервер данасы үшін шектелген.

[MIT](LICENSE).

![TaskFlow](screenshots/dashboard-en.png)
