# nu PMC — v2 Changelog

**Date:** April 19, 2026
**For:** Guru (deployment)
**Supersedes:** v1 code zip

---

## What's changed since v1

### New product features

1. **Drawing Register** — Rajani and Srinath upload a master drawing list at project start. Main drawings must match the register. Detail drawings and RFI responses bypass the check. See Technical Brief Addendum 1.
2. **AI checks on drawings** — common-sense audit (is this a drawing? right orientation? matches declared metadata?), detail context extraction, RFI relevance check. All async, non-blocking.
3. **AI photo tagging** — runs after every photo upload. If site manager tagged, AI is a silent checker. If not, AI suggests task + caption for their confirmation.
4. **Photo tag correction chain** — Site manager (12 hrs) → stream audit → Principal-only once used in sent weekly report.
5. **Unified delegation model** — one table, one mechanism. Principal↔Principal permanent, others project-scoped and time-bounded. Site managers cannot be delegated to except with `limited_pmc` scope.
6. **Weekly report 3-way sign-off** — PMC + Design + Services sign their respective sections, then Principal approves, then PDF is generated with nu letterhead. Photos referenced lock automatically on approval.
7. **Desktop/laptop layout** — responsive breakpoint at 1024px. Mobile bottom-tabs become a left sidebar on desktop, topbar and content reflow.

### Schema cleanup

| Metric | v1 | v2 | Change |
|---|---|---|---|
| Tables | 115 | 89 | −26 trimmed |
| Duplicate tables | 1 (`mom_items`) | 0 | fixed |
| Forward FK refs | 35 | 0 | topologically ordered |
| Stale `ALTER IF NOT EXISTS` | 13 | 0 | folded into CREATE TABLE |
| Orphan FK columns | 4 | 0 | FKs added |
| CHECK constraints | 0 | 4 | pct/date/self-ref guards |
| `(project_id, status)` indexes | 4 | 23 | dashboard hot paths |

### Tables removed (out of scope)

`vendor_bank_signoffs`, `statutory_submissions`, `design_programme`, `client_design_approvals`, `insurance_records`, `vendor_rfq`, `vendor_rfq_quotes`, `vendor_loi`, `inspection_records`, `drawing_query_ai_suggestions`, `cn_impact_items`, `handover_checklist_template`, `handover_checklist_instances`, `handover_documents`, `handover_events`, `training_records`, `dlp_inspections`, `defect_responses`, `project_closure_signoffs`, `lessons_learned`, `lessons_learned_inputs`, `advance_adjustments`, `vendor_nonboq_items`, `provisional_boq_items`, `mom_actions`, plus the duplicate `mom_items`.

### Routes removed (out of scope)

- `routes/compliance.js`
- `routes/handover.js`
- `routes/lessons.js`
- Trimmed statutory and design-programme endpoints from `routes/project-setup.js`
- Trimmed `defect_responses` writes from `routes/whatsapp-bot.js`
- Trimmed retention/handover-approaching crons from `scripts/overdue-checker.js`

### New backend files

- `middleware/delegation.js` — resolves effective roles through the delegation graph
- `routes/register.js` — drawing register CRUD
- `routes/photo-tags.js` — tag + AI + correction chain
- `routes/delegations.js` — delegation management
- `routes/weekly-signoff.js` — 3-way sign-off workflow
- `scripts/build-weekly-pdf.js` — PDF generator (uses pdfkit)

### New frontend pieces

- `public/css/desktop.css` — laptop/desktop responsive layout
- 4 new screens in `public/js/app.js`: Register, Delegations, Weekly Sign-off, Photo Tag Review
- `API.get`, `API.post`, `API.patch`, `API.del` shim helpers

---

## Deployment notes

### Clean install (recommended for first deploy)

```bash
# 1. Drop the old database completely
mysql -u root -p -e "DROP DATABASE IF EXISTS nu_pmc; CREATE DATABASE nu_pmc CHARACTER SET utf8mb4;"

# 2. Run the schema (FK checks are handled internally)
mysql -u root -p nu_pmc < schema.sql

# 3. Install deps
npm install --production

# 4. Set passwords for seeded users
node scripts/set-passwords.js

# 5. Start
npm start
```

### Migrating from a v1 install

There's no automated v1 → v2 migration. Two options:

**Option A (clean):** Back up v1 data, drop database, run v2 schema fresh, re-enter projects/drawings manually. Faster for a small installation.

**Option B (manual):** Run v1 database alongside v2 schema, write a custom import script to move the data you want to keep. Only worth it if you have >50 projects or significant uploaded drawings.

### New environment variables

```env
ANTHROPIC_API_KEY=sk-ant-...     # for AI drawing/photo checks. Optional — app degrades gracefully if unset.
AI_MODEL=claude-sonnet-4-20250514
AI_MODEL_HEAVY=claude-opus-4-20250514
```

### Testing checklist post-deploy

- [ ] Login as each of the 19 users
- [ ] Upload a drawing register Excel as Rajani
- [ ] Try to upload a "main" drawing not on the register — confirm the prescriptive error modal
- [ ] Upload a detail drawing with free numbering — confirm it succeeds
- [ ] Upload a photo as a site manager — confirm AI tags it within 10 seconds
- [ ] Create a weekly report draft, sign all 3 sections, approve as Principal, confirm PDF generates
- [ ] Create a delegation from Rajani to Sahana on one project — confirm Sahana's actions are logged as "acting for Rajani"
- [ ] Open the app on a laptop — confirm the sidebar layout

---

## Known limitations / deferred

- **No v1 → v2 data migration tool** — clean install only
- **PDF builder uses basic pdfkit layout** — can be richer later (nu letterhead as embedded PNG, proper typography, signature blocks)
- **Desktop layout is additive** — mobile view takes over below 1024px. Tablet (768–1023px) falls into the mobile layout — fine for now
- **AI tagging is single-image** — batch uploads each get their own AI call (costs more at scale; batch-aware prompt is a v3 task)
- **Delegation conflict resolution** — if two people delegate to the same user for the same project with overlapping windows, the app allows both. Policy decision deferred

---

## One-line summary for Naveen

*v2 trims 26 out-of-scope tables, adds register-enforced drawings, AI drawing/photo checks, 3-way weekly sign-off with PDF, unified delegation, and a proper laptop layout. Schema is clean, FK-ordered, CHECK-protected.*
