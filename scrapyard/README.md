# Scrap Yard Inventory & Part Compatibility

Web system for a scrap yard: store parts and stock, record which vehicles each part fits, and answer
"does this part fit that car?" and "what do we have for this car?". Admin and worker logins.

**Phase 1 (this repo):** inventory, compatibility checker, dashboard, authentication, CSV import.
**Phase 2 (planned):** RFID location tracking with a Chainway C72 handheld (see *Roadmap*).

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI (Python), SQLAlchemy 2, Pydantic |
| Database | PostgreSQL (SQLite for local dev) |
| Auth | JWT access + refresh tokens, argon2 password hashes, roles: `admin`, `worker` |
| Web app | React + Vite + Tailwind CSS |
| Deploy | Docker Compose, nginx serves the web app and proxies `/api` |

## Run it (Docker)

```bash
cp .env.example .env      # then edit: passwords and SECRET_KEY
docker compose up --build
```

Open <http://localhost:8080>. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.
With `SEED_DEMO_DATA=true` an empty database gets a few `DEMO-` parts and a `worker1` / `worker12345` account.
Interactive API docs (Swagger) are served by the backend at `/docs` — available at <http://localhost:8000/docs> when you run the backend locally. In Docker only the web app port is published; add `ports: ["8000:8000"]` to the `backend` service if you want the docs exposed.

## Run it locally (development)

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
SEED_DEMO_DATA=true uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest                                                   # run the API tests

# frontend (second terminal)
cd frontend
npm install
npm run dev                                              # http://localhost:5173 (proxies /api to :8000)
```

Locally the backend uses SQLite (`scrapyard.db`) and the default admin `admin` / `admin12345`.

## Roles

| | Worker | Admin |
|---|---|---|
| View dashboard, parts, run compatibility checks | ✓ | ✓ |
| Add / edit parts, adjust stock, manage fitments and interchange links | ✓ | ✓ |
| Delete parts | | ✓ |
| Import CSV | | ✓ |
| Manage users (create, change role, disable, reset password) | | ✓ |

## How the compatibility checker works

- A **fitment** says "part P fits vehicle V", where a vehicle is make + model + year range (+ optional variant).
  Leave the variant blank when the part fits every variant of that model.
- An **interchange link** says two parts are interchangeable. They then share fitment: if either fits a
  vehicle, the checker treats both as fitting. Links are one step only (A↔B and B↔C does not link A↔C).
- **Check a part** → compatible / not recorded / part unknown, plus in-stock parts that would fit instead.
- **Find parts for a vehicle** → everything that fits (directly or via interchange), optionally in-stock only.
- Part numbers match ignoring case, dashes and spaces (`1K0-615-301` = `1k0 615 301`).
- Make/model matching is case-insensitive but exact, so use consistent spelling. Suggestions in the forms help.

"Not compatible" in the app really means **"no fitment recorded"**. The checker is only as good as the fitment
data loaded into it, so the dashboard shows how many parts still have no fitment.

## CSV import

Admin → *Import CSV* (a template can be downloaded there). One row per fitment:

```
part_number,name,category,condition,quantity,price,notes,make,model,year_from,year_to,variant
```

Repeat the part number on extra rows to add more vehicles to the same part. Existing parts are updated with the
non-empty values (quantity is replaced, not added). Bad rows are skipped and reported.

## Before handing over to the customer

- Set a long random `SECRET_KEY`, real `POSTGRES_PASSWORD` and `ADMIN_PASSWORD`; set `SEED_DEMO_DATA=false`.
- Put HTTPS in front (Caddy, nginx + Let's Encrypt, or a cloud load balancer). Tokens travel in headers, so do not run plain HTTP over the internet.
- Back up the `pgdata` volume (`pg_dump` on a schedule).
- Known simplifications: tokens are kept in the browser's `localStorage` (use httpOnly cookies if the threat model needs it),
  there is no login rate-limiting, and tables are created automatically on start (add Alembic migrations before changing the schema in production).

## Roadmap: RFID phase

The `locations` and `rfid_tags` tables already exist (no endpoints yet). Plan:

1. Android (Kotlin) app for the Chainway C72 using Chainway's RFID SDK, with offline scanning and sync to this API.
2. Tag registration: link an EPC to a part; tag shelves/bins as locations.
3. Shelf scan → parts present at that shelf. Heaps → "find" mode using signal strength to walk toward a tagged part.
4. Test read range on real metal scrap early; use on-metal UHF tags.

## Layout

```
backend/   FastAPI app (app/), tests (tests/), Dockerfile
frontend/  React app (src/), nginx.conf, Dockerfile
docker-compose.yml, .env.example
```
