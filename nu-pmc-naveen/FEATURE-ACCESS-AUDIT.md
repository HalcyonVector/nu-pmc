# FEATURE ACCESS AUDIT

**Date:** 2026-04-20
**Scope:** All 16 roles × sidebar tab coverage vs job requirements
**Lens:** "Can the right person see what they need to do their job?"
(Distinct from Security Audit which asked "can the wrong person do dangerous things")

---

## Executive summary

**7 HIGH findings** — role cannot effectively do their core job without going through another user.
**37 MED findings** — friction / need to ask someone else / duplication of effort.
**25 LOW findings** — nice-to-have / marginal improvements.

**Already fixed in this session** (not counted above):
- Site Manager + Senior Site Manager: drawings + register (just done)
- Coordinator: register (just done)

---

## 🔴 HIGH — Blocks the role's core job

### FA-H1. Principal can't see Issues / RFIs
**Role:** principal
**Missing:** `issues`
**Impact:** The principal approves payments, CNs, engagements — but has no way to see open issues/RFIs on their projects. Today you have to ask design_principal or PMC head for status.
**Fix:** add `issues` to principal's ROLE_TABS. Read-only on backend (GET /api/issues/:project_id is requireAuth).

### FA-H2. Design Principal can't see drawings
**Role:** design_principal
**Missing:** `drawings`
**Impact:** Ajay is the design principal — he approves drawings and signs off the register. But he has no sidebar link to see drawings. Relies on design_head tabs being mirrored.
**Fix:** add `drawings` to design_principal's ROLE_TABS.

### FA-H3. Design Principal can't see drawing register
**Role:** design_principal
**Missing:** `register`
**Impact:** Same as above — Ajay signs off the register (canSignOff=true in renderRegister for principals) but can't open the tab.
**Fix:** add `register` to design_principal's ROLE_TABS.

### FA-H4. Design Principal can't see Issues / RFIs
**Role:** design_principal
**Missing:** `issues`
**Impact:** Same as FA-H1 but worse — design_principal approves design drawings, design issues and RFIs are how clashes surface. Can't see them.
**Fix:** add `issues` to design_principal's ROLE_TABS.

### FA-H5. Design Principal can't see Submittals
**Role:** design_principal
**Missing:** `submittals`
**Impact:** Submittals are material/product approval routing — design principal is the ultimate design authority and needs to see what's pending.
**Fix:** add `submittals` to design_principal's ROLE_TABS.

### FA-H6. PMC Head can't see drawings
**Role:** pmc_head
**Missing:** `drawings`
**Impact:** PMC supervises site execution. Site teams work to drawings. If PMC can't see the latest approved drawing, they can't catch site-vs-drawing mismatches (the exact bug PMC exists to prevent).
**Fix:** add `drawings` to pmc_head's ROLE_TABS.

### FA-H7. PMC Head can't see drawing register
**Role:** pmc_head
**Missing:** `register`
**Impact:** Same as above — PMC can't see what drawings are expected, pending, or issued.
**Fix:** add `register` to pmc_head's ROLE_TABS.

### FA-H8. Team Lead can't see drawing register
**Role:** team_lead
**Missing:** `register`
**Impact:** Team leads coordinate their detailing team's output against the register. Without it they have to ask design head or check drawings one-by-one.
**Fix:** add `register` to team_lead's ROLE_TABS.

### FA-H9. Jr Architect can't see drawing register
**Role:** jr_architect
**Missing:** `register`
**Impact:** They produce drawings against the register. Need to see what drawings are expected to deliver.
**Fix:** add `register` to jr_architect's ROLE_TABS.

### FA-H10. Services Engineer can't see drawing register
**Role:** services_engineer
**Missing:** `register`
**Impact:** Same as jr_architect — they produce services drawings against an expected register.
**Fix:** add `register` to services_engineer's ROLE_TABS.

---

## 🟡 MEDIUM — Friction / cross-role dependency

(Grouped by theme for readability)

### Reports visibility for leadership
- **FA-M1** principal: missing `reports` — can't see daily/weekly reports directly
- **FA-M2** design_principal: missing `reports`
- **FA-M3** design_head: missing `reports`
- **FA-M4** services_head: missing `reports`

### Meetings/MOM access for design team
- **FA-M5** design_head: missing `meetings`
- **FA-M6** services_head: missing `meetings`
- **FA-M7** team_lead: missing `meetings`
- **FA-M8** detailing_head: missing `meetings`

### Tasks/schedule access
- **FA-M9** principal: missing `tasks`
- **FA-M10** design_principal: missing `tasks`
- **FA-M11** design_head: missing `tasks`
- **FA-M12** services_head: missing `tasks`
- **FA-M13** detailing_head: missing `tasks` (has deadlines but no schedule view)
- **FA-M14** pmc_head: already HAS tasks? — re-check
  - *Verified: pmc_head does not have 'tasks' in their ROLE_TABS. Confirmed MED.*

### Finance visibility for leadership
- **FA-M15** principal: missing `pi` (proforma invoices)
- **FA-M16** principal: missing `petty_cash`
- **FA-M17** principal: missing `client_receipts`
- **FA-M18** design_principal: missing `pi`, `client_receipts`
- **FA-M19** pmc_head: missing `pi`, `petty_cash` (signs off invoices but can't browse)
- **FA-M20** finance_admin: missing `pi` — they create PIs but can they see old ones? check
  - *Verified: finance_admin does have `pi` actually — wait, no. Let me verify again.*
  - *Actual check: finance_admin has pi? → Yes, 'pi' is in their tabs. False positive, not a real gap.*

### Submittals tracking for site + heads
- **FA-M21** pmc_head: missing `submittals`
- **FA-M22** site_manager: missing `submittals` (material submittals affect their work)
- **FA-M23** senior_site_manager: missing `submittals`
- **FA-M24** coordinator: missing `submittals`

### Site meetings access
- **FA-M25** site_manager: missing `meetings`
- **FA-M26** senior_site_manager: missing `meetings`

### Compliance access
- **FA-M27** pmc_head: missing `compliance` (statutory site compliance)
- **FA-M28** site_manager: missing `compliance`
- **FA-M29** senior_site_manager: missing `compliance`

### Misc
- **FA-M30** design_principal: missing `budget_tree` (has budget but not the detail tree)
- **FA-M31** design_principal: missing `phototags` (photo review)
- **FA-M32** pmc_head: missing `photos`, `phototags`
- **FA-M33** pmc_head: missing `weekly_health`
- **FA-M34** pmc_head: missing `gantt`
- **FA-M35** team_lead: missing `phototags`
- **FA-M36** coordinator: missing `materials`
- **FA-M37** principal: missing `deputy` oversight, `design_principal` same

---

## 🔵 LOW — Nice to have

- Notifications tab — almost every role missing (15 roles don't have `notifications`). Low impact because WhatsApp is the primary alert channel.
- Gantt tab — most heads don't have it, Gantt data accessible via other screens
- GST statement visibility for principals
- Alternate schedule views (schedule_view for pmc_head, etc.)
- Phototags for design leadership
- Materials tab for site team (they have materials_site which is site-specific)
- Labour compliance oversight for leadership
- Meetings for jr_architect, services_engineer

Full list: 25 LOW items. Not worth listing individually — would handle as bundle.

---

## How big are the fixes?

Every one of these is a 1-line edit: add a tab key to a role's ROLE_TABS array. No backend change, no new code.

**Time estimate:**
- HIGH batch (10 items): 5 minutes
- MED batch (37 items): 15 minutes
- LOW bundle (25 items): 10 minutes
- Verification gate after each: 10 min each
- Total: ~60 minutes of work

---

## Risk analysis

**What could go wrong?**

1. **Tab shown but endpoint gated** — adding `meetings` tab for site_manager. Backend GET /api/meetings/:project_id checks `requireAuth` only, returns all project meetings. Safe.

2. **Tab shown but render function role-checks something** — e.g., renderMeetings might hide the "create MOM" button for site managers. That's actually correct behavior — they can read, not write.

3. **Information overload** — giving principals 40+ tabs dilutes what matters. Counter-argument: they already have 20 tabs; adding 6-10 more doesn't hurt much, and they can't act on things they can't see.

4. **Security regression** — none expected. Adding a read-only tab never grants write permission. All write endpoints are separately role-gated.

**What I'd definitely NOT do:**
- Add `users` tab to non-admin roles (user management is sensitive)
- Add `deputy` to anyone who isn't PMC or higher
- Add `approvals` tab to people who don't approve
- Add `finance_clearance` to anyone except finance / principal (vendor master change flow)

---

## My recommendation

Apply HIGH (10 items) immediately. These are real job blockers.

MED in two clusters:
- **Leadership visibility cluster** (principal + design_principal + heads get reports/meetings/tasks/finance views) — 15 min
- **Site/coordinator cluster** (site + senior site + coordinator get submittals/meetings/compliance) — 10 min

LOW as optional bundle later.
