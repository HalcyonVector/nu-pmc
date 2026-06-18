# nu PMC — Preview Bundle (for Naveen)
**Version:** 22 Apr 2026

---

## What this zip contains

- `pv90-preview.html` — static HTML preview showing PV 90 data as it would render in the app
- `source/` — full application source code (same as Guru's zip)
- `README-NAVEEN.md` — this file
- UI fixes summary + screenshots guide

## Two ways to look at it

### Option 1 — Static preview (no setup)
Open `pv90-preview.html` in any phone/desktop browser. Shows static snapshots of the screens — harness-style for visual review of the UI fixes. No login, no database needed.

### Option 2 — Full app locally (needs Node + MySQL)
```bash
cd source
# Set up database
mysql -u root < schema.sql
for m in migrations/*.sql; do mysql -u root nu_pmc < "$m"; done
mysql -u root nu_pmc < tools/seed-pv90-rich.sql

cp .env.example .env
# Set DB credentials in .env
npm install
npm start
# → Open http://localhost:3000
```

Log in as `test_principal` (password `TestPass1`) and select PV 90.

## What to look at

The fixes from today's session that you should confirm visually:

1. **Topbar** — now shows `Test Principal · Principal` on line 1, `PV 90 Production Line` on line 2
2. **Bottom nav** — 44px tap targets, visible to all roles
3. **Accordion** — label says "7 sections — tap to expand" when in a bucket with >5 tabs
4. **Approve buttons (btn-sm)** — no longer tiny (44px minimum)
5. **Modal X button** — now has proper tap area
6. **Action cards on dashboard** — clicking opens triage list, not direct tab jump
7. **Text contrast** — muted text now readable (was failing WCAG)
8. **Focus rings** — tab key through the UI, you'll now see blue outlines

## Test data loaded for PV 90

- 10 schedule tasks (Civil / Electrical / HVAC)
- 9 BOQ items (across both streams)
- 3 vendors (all cleared + engaged)
- 5 drawings in register, 3 with R0 uploaded (different approval states)
- 4 open issues (RFI, design, safety, quality)
- 3 GRNs, 3 payment requests, 3 meetings, 2 daily reports

## What's still pending

From the earlier report:
- Semantic click inference test — ready to run, not executed yet
- Fix 3 (document library with version control) — deferred to module map
- Desktop layout polish (bottom-nav overlap, accordion cramped) — separate scope
