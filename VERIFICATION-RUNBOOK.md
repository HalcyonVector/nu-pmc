# nu-pmc — Verification & Go-Live Runbook

Follow this top to bottom. Part A + B are commands you run once. Part C is the
manual click-through of all 29 upload buttons. Part D/E are cross-role and
production checks.

Conventions:
- **Switch role** = use the `user1` role-switcher dropdown at the top of the app to
  impersonate the role named.
- **Sample file** = the file in `test-uploads-v2/<folder>/` for that point.
- **Confirm** = what you should see; if you see a spinner-forever, an error toast,
  or a 500, note it.

---

## PART A — Database migrations (run once, in order)

Run each from PowerShell in the repo root. All are idempotent (safe to re-run).

```powershell
cd "C:\Users\basus\Documents\Internship\NUAssociates\nu-pmc-main"
$db = "-u root -psagnik@XEPDB1 nu_pmc"

Get-Content .\upload-audit\fixes\2026-07-01-grn-display-columns-GUARDED.sql -Raw | mysql -u root -psagnik@XEPDB1 nu_pmc
Get-Content .\upload-audit\fixes\2026-07-01-schema-reconcile.sql            -Raw | mysql -u root -psagnik@XEPDB1 nu_pmc
Get-Content .\upload-audit\fixes\2026-07-01-it-admin-bulk-grants.sql        -Raw | mysql -u root -psagnik@XEPDB1 nu_pmc
Get-Content .\upload-audit\fixes\2026-07-01-direct-payment-type-enum.sql    -Raw | mysql -u root -psagnik@XEPDB1 nu_pmc
Get-Content .\upload-audit\fixes\2026-07-01-handover-template-seed.sql      -Raw | mysql -u root -psagnik@XEPDB1 nu_pmc
Get-Content .\migrations\2026-07-01-hide-work-tab-principals.sql            -Raw | mysql -u root -psagnik@XEPDB1 nu_pmc
```

What each does:

| File | Purpose |
|---|---|
| grn-display-columns-GUARDED | Adds `grns.unit_rate` + display columns. Without it, creating a GRN 500s. |
| schema-reconcile | Adds missing columns/tables the code expects (project_documents, form_submissions status, handover tables). |
| it-admin-bulk-grants | Grants it_admin the users-bulk permission. |
| direct-payment-type-enum | Widens direct-payment types to bank_transfer/cheque/card/other (was crashing). |
| handover-template-seed | Seeds the 8 handover checklist items. Without it, "Initialise Checklist" fails. |
| hide-work-tab-principals | Removes the Work tab from principal/design_principal; moves handover to their More menu. |

Verify migrations landed:

```powershell
mysql -u root -psagnik@XEPDB1 nu_pmc -e "SELECT COUNT(*) AS handover_items FROM handover_checklist_template;"   # expect 8
mysql -u root -psagnik@XEPDB1 nu_pmc -e "SELECT role,COUNT(*) FROM role_nav WHERE bucket='work' AND is_visible=1 GROUP BY role;"  # only pmc_head, senior_site_manager, site_manager
```

---

## PART B — Automated test suites (run to confirm no regressions)

```powershell
cd "C:\Users\basus\Documents\Internship\NUAssociates\nu-pmc-main"
$env:NODE_ENV="test"; $env:TEST_DB_HOST="localhost"; $env:DB_USER="root"; $env:DB_PASSWORD="sagnik@XEPDB1"; $env:DB_NAME="nu_pmc"
npx jest --config jest.integration.config.js --forceExit `
  tests/integration/uploads tests/integration/uploads-chained tests/integration/sm-ssm-role-gates
```

What it checks:

| Suite | Asserts |
|---|---|
| uploads | All self-contained uploads (01,02,04,06,07,08,13,16,17,18,20,23,26,27,29) return a 2xx with the real file; role-gating (fee-schedule blocks site_manager, direct-payment blocks pmc_head); a disallowed .txt returns a clean 4xx. |
| uploads-chained | The 7 precondition points (03,05,19,21,22,24,28) run for real — the suite builds the register row / measurement / issued MOM / meeting / form template / handover seed, then uploads — and asserts no 5xx. |
| sm-ssm-role-gates | site_manager is blocked (403) and senior_site_manager allowed on: GRN approve, GRN reject, issue resolve, raise payment request. |

Expected: **3 suites passed, 0 failed.** (The "worker failed to exit gracefully" line is harmless.)

> Note: these use the test-only auth bypass. They prove the *backend* accepts/stores/gates
> correctly. They do NOT prove the download UI renders or that spreadsheet data parsed
> correctly — that's Part C.

---

## PART C — Manual click-through of all 29 buttons

For each: switch to the role, open the screen, attach the sample file(s), submit, then
**download/open** the stored file to confirm it's the right one. Tick the three boxes.

Legend: **U** = upload succeeds (no error). **D** = download/view opens the correct file.
**R** = it reflects where it should (list/gallery/queue/count).

| # | Button | Switch to role | Where to find it | Sample file(s) | Confirm (U / D / R) |
|---|--------|----------------|------------------|----------------|---------------------|
| 01 | Site photos | Site Manager | Project → Photos → Upload Photos | 01_site-photos (4 files) | 4 photos in gallery; each opens full-size |
| 02 | Issue/defect photo | Site Manager | Raise Issue modal → attach photo | 02_issue-defect-photo/defect-photo-1.jpg | Issue appears in register; photo opens |
| 03 | Meeting site-visit photo | PMC Head | Meetings → open meeting → + Photo (native picker) | 03_.../site-visit-photo.jpg | Photo shows in the meeting |
| 04 | Drawing register import | Design Head | Register → Upload Register | 04_.../design-drawing-register.xlsx | Row count matches the sheet; drawings listed |
| 05 | Drawing (main) | Design Head | Drawings → Upload (needs 04 done first) | 05_drawings/D-ARCH-001-...RevC.pdf | Attaches to register row D-ARCH-001; opens |
| 06 | Project schedule | PMC Head | Schedule → Upload + revision reason | 06_.../project-schedule.xlsx | New version; drift shows a real number |
| 07 | Design BOQ | Design Head | Materials/BOQ → Upload | 07_.../design-boq.xlsx | BOQ items + rates correct |
| 08 | Services BOQ | Services Head | Materials/BOQ → Upload | 08_.../services-boq.xlsx | Items + rates correct |
| 09 | Client BOQ | Principal | Client BOQ → Upload | 09_.../client-boq.xlsx | Rows + client rates correct |
| 10 | GRN (2 files) | Senior Site Manager | Raise GRN → delivery note + invoice | 10_grn/grn-delivery-note.pdf + grn-vendor-invoice.pdf | GRN created; both files attached |
| 11 | Payment-request evidence | Senior Site Manager | Raise Payment → attach 3 evidence PDFs | 11_.../ (3 files) | Request raised; all 3 attached |
| 12 | Urgent payment | PMC Head | Urgent Payment → invoice + UPI QR | 12_.../invoice + **a REAL UPI QR** | Upload OK; QR decodes to the UPI id |
| 13 | Petty-cash bill | PMC Head | Money → Petty Cash → Add Spend | 13_.../petty-cash-bill.jpg | Transaction saved; bill attached |
| 14 | Direct-payment receipt | Principal | Money → Direct Payment | 14_.../direct-payment-receipt.pdf | Payment recorded (try Bank Transfer); receipt opens |
| 15 | ICICI confirmation | Finance Admin | Payments → ICICI confirm (needs a batch) | 15_.../icici-confirmation.xlsx | Parsed UTR + amount match the sheet |
| 16 | Vendor-master bulk | PMC Head | Vendors → Master Upload | 16_.../vendor-master.xlsx | Vendors created; appear in finance clearance |
| 17 | Vendor-engagements bulk | Principal | Vendors → Engagements → Bulk Upload | 17_.../vendor-engagements.xlsx | Engagements created |
| 18 | Users bulk | Principal | Users → Bulk Upload | 18_.../users-bulk-upload.xlsx | Users created; temp passwords returned |
| 19 | Clients bulk | Principal / Finance Admin | Money → Clients → **Bulk Upload** button | 19_.../clients-bulk-upload.xlsx | "added / skipped / errors" modal; clients appear in list |
| 20 | Project documents | Principal | Documents → Upload (do both, one after another) | 20_.../building-plan-sanction.pdf, project-agreement.pdf | Both listed; each downloads correctly |
| 21 | Handover document | PMC Head | **More → Handover** (after the 2026-07-02 handover-nav migration) → Initialise Checklist → upload to an item | 21_.../handover-document.pdf | Needs handover seed (Part A) + handover-nav migration. Doc attaches to item; opens |
| 22 | Measurement signed cert | PMC Head | Measurements → open a measurement → Client Acceptance | 22_.../measurement-signed-certificate.pdf | Measurement → client_accepted; cert attached |
| 23 | Weekly report | PMC Head | Reports → Weekly → Upload | 23_.../weekly-report.pdf | Report appears in the weekly list |
| 24 | MOM reissue | PMC Head | Meetings → an **issued** MOM → Reissue | 24_.../mom-reissued.pdf | New revision created; PDF opens |
| 25 | Meeting observation | PMC Head | Meetings → open meeting → + Observation | 25_.../meeting-observation.pdf | Observation added; file opens |
| 26 | Fee schedule | Finance Admin | Invoices → Fee Schedule → Upload | 26_.../fee-schedule.xlsx | Imported, no 403 (confirms the B5 fix) |
| 27 | Site-form template | PMC Head | Work → Inspections → + Template | 27_.../site-form-template.xlsx | Template created and listed |
| 28 | Site-form submission | Site Manager | Work → Inspections → Fill Form (needs 27) | 28_.../site-form-filled.jpg | Submission created; PMC can review it |
| 29 | Daily report | Site Manager | Today's Report modal → attach photo | 29_.../daily-report-photo.jpg | Submitted; PMC sees it; attachment opens |

For every row, the most valuable manual check is the **D** (download/open) — the automated
suite proves the file was stored, not that it renders back correctly.

---

## PART D — Cross-role / workflow checks

These verify the hand-offs, which single-button tests don't:

1. **Daily report (29):** Site Manager submits → switch to PMC Head → the report appears →
   open the attachment → Approve. Confirm the site sees "approved".
2. **Inspection form (27 → 28):** PMC Head creates the template → switch to Site Manager →
   the template is available to fill → submit → switch to PMC Head → review/approve.
3. **Payment relay (11 → approve):** Senior Site Manager raises a payment request → switch
   to PMC Head → it's in the queue → Approve → switch to Principal → approve → confirm it
   advances (this is the flow where I fixed the 404 on the single Approve button).
4. **Vendor clearance (16):** PMC Head bulk-uploads vendors → switch to Finance Admin →
   confirm they appear in the clearance queue.
5. **Finance visibility:** as Finance Admin, confirm petty-cash (13), direct-payment (14),
   fee-schedule (26), and ICICI (15) items are all visible in that account.

---

## PART E — Production environment & security (BLOCKERS before go-live)

1. Set `NODE_ENV=production` in the prod `.env` — disables the dev-login/dev-switch/
   dev-escape backdoors AND the `X-Test-User-Id` header bypass. **Critical.**
2. Set `FORCE_HTTPS=1` — Secure session cookies.
3. Remove `DEV_PASSWORD = 'Start@123'` from `modules/auth/routes/auth.js` (~lines 99-100).
4. After setting `NODE_ENV=production`, **smoke-test ~5 uploads through a real login**
   (not the test bypass) — CSRF + real sessions + Secure cookies can behave differently
   from the test harness. This is the single check most likely to surface a prod-only issue.
5. Use separate, secret-managed DB credentials in production (the current `.env` password
   is plaintext and fine only for local dev).
6. Reconcile `schema.sql` from a known-good DB (`mysqldump --no-data --routines nu_pmc > schema.sql`)
   so fresh installs match the deployed shape.

---

## PART F — Known gaps to check by hand (not fully proven)

| Item | What to do |
|---|---|
| Spreadsheet imports (04, 07, 08, 09, 15, 16, 18) | Open the result and confirm the *rows/values* parsed correctly — tests only prove "no crash". |
| Download/view of every upload | Click the view/download control on each — only a few were eyeballed by me. |
| 12 urgent-payment | Retry with a **real** UPI QR image (the sample isn't machine-decodable). |
| 03 meeting photo | Uses a native OS picker — must be done by hand. |
| 19 clients-bulk | No UI button exists — decide whether to build one. |
| Notifications | `NOTIFICATIONS=disabled` — any upload that should trigger WhatsApp is untested until Twilio is wired. |
