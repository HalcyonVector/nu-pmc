# nu PMC v4

Project Management Console for **NU Associates LLP** (Bengaluru).
Progressive Web App. Node 20 + MariaDB 10.11. One active site: PV 90.

---

## Quick start (one command)

```bash
cp .env.docker.example .env
# Edit .env — set DB_ROOT_PASSWORD, DB_PASSWORD, SESSION_SECRET

docker compose up -d db                       # start database
sleep 30
docker compose --profile seed run --rm seed   # schema + users + governance sheets
docker compose up -d app                      # start application

# App is now at http://localhost:3100
```

That's it. Database, app, seed data, 8 governance sheets loaded — all in one
compose file. Stop with `docker compose down`. Reset with `docker compose down -v`.

---

## Before you do anything else

**Read `HANDOFF.md`.** It is the single source of architectural truth for this
codebase. Every new engineering session — AI or human — starts there.

The most important thing in it: **the permissions middleware reads from the DB,
and the DB is loaded from 8 Excel sheets. There is no hardcoded fallback.**
Change permissions by editing a sheet and uploading it via `/api/governance/upload`
(principal only) or by re-running the seed.

---

## Testing

```bash
# Inside the running app container
docker compose exec app node scripts/test-kitchen-sink.js   # L1-L4a — 60 tests
docker compose exec app node scripts/test-workflows.js      # workflow chains
docker compose exec app node scripts/verify-single-boss.js  # permission coverage
docker compose exec app bash scripts/post-deploy-smoke.sh   # smoke test
```

All four should pass before declaring a build ready.

---

## Logging in

Default users after seed (password `Test1234` — **change on first login**):

| Username | Role |
|---|---|
| `naveen` | principal |
| `ajay` | design_principal |
| `murugesan`, `praveen` | pmc_head |
| `rajani` | design_head |
| `test_<role>` | one per role (L1-L4a test fixtures) |

---

## Deploying to a server

See `deploy/GURU-AWS-DEPLOY.md` for AWS. The same Docker image works on any
host with Docker — Hetzner, DigitalOcean, a bare-metal VPS, wherever.

---

## Layout

```
.
├── server.js                    Express entry
├── schema.sql                   91 tables
├── Dockerfile                   Multi-stage Alpine
├── docker-compose.yml           db + seed + app (+ optional adminer)
├── .env.docker.example          Environment template
├── HANDOFF.md                   Session context — READ FIRST
├── middleware/                  auth, permissions (DB-backed), trainee-guard
├── routes/                      56 files, 324 routes
├── migrations/                  v4.0 → v4.7
├── governance_sheets/           8 Excel sheets — the permission source of truth
├── scripts/                     seed-full, load-governance-sheets, tests
├── public/                      PWA frontend (plain JS, no framework)
└── deploy/                      nginx.conf, AWS guide
```

---

## Governance panel

Principals see a **Governance** tab in the More bucket. It shows permission/
workflow/notification counts and lets them upload modified Excel sheets. Every
upload writes an audit trail row in `governance_uploads` and triggers a live
reload of the permission cache — no app restart needed.

---

## Development workflow

1. **Before making any claim about state — grep or read the file.** Memory rule 23
   is non-negotiable.
2. Make changes. `node --check <file>` before considering done.
3. Run the four test scripts above.
4. `docker compose exec app bash scripts/post-deploy-smoke.sh` on the full stack.
5. Only then commit.

---

## Contact

- **Naveen Bhat** — principal, final decisions
- **Guru Udupa** — deployment / AWS
- **Praveen, Murugesan** — site ops at PV 90

For AI-assisted work: start the chat by pasting `HANDOFF.md`. That restores
context for both the model and the human.
