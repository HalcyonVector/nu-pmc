# nu PMC — Build Checklist (v2, post-audit campaign)

## Production readiness

### Tests (all green, ~12s run time)
- 124/124 module integration tests
- 4/4 optimistic-lock tests
- 10/10 malformed Excel tests
- Total test run: `bash /tmp/run-full.sh` or `npm test` after install

### UI layer (post-audit)
- 190/190 clickable handlers wired to real backend routes
- 40 `/api/api/` double-prefix bugs fixed (biggest catch of campaign)
- 7 path/method mismatches fixed
- 3 missing endpoints implemented
- 0 label-vs-effect catastrophe mismatches
- Clients master UI complete (tab, incomplete widget, complete-stub modal, new-client modal, project dropdown)

### Backend layer
- 297 route handlers
- Role gates verified live — 0 unguarded high-risk endpoints
- 5 external-send flows hardened with preview+confirm+audit:
  1. MOM approve/preview/issue-to-client
  2. ICICI Excel generate (preview with expected-total check)
  3. ICICI confirm/apply (explicit two-step)
  4. Vendor NCR notice (preview with GRN-number confirmation)
  5. UTR webhook (X-Webhook-Secret header)

### Safety infrastructure
- `audit_log` table with user_id, action, entity_type, entity_id, details JSON, IP, UA, timestamps
- Optimistic locking on `payment_requests`, `schedule_versions`, `moms`
- OTP rate limiter (5/hr/IP)
- Deputy cycle prevention (self-deputy + mutual-cycle check)
- Client master guard on PI creation (CLIENT_INCOMPLETE / CLIENT_NOT_LINKED)

### Schema-to-code integrity
- 4 enum mismatches fixed (projects.status 'closed'→'completed', 'archived'→'completed', vendor_payments 'paid' added, weekly_reports filter 'pending_pmc'→'pending_approval')
- 23 half-implemented state machines catalogued (for Phase 2 wiring)
- 9 write-only tables catalogued
- `vendor_boq_items` flagged — 12 readers 0 writers

## Deployment path

1. Run `npm install` on VPS
2. Set env vars per `.env.example`: DB credentials, SESSION_SECRET, WEBHOOK_SECRET, TWILIO_* for WhatsApp
3. Run `mysql < schema.sql` on empty DB
4. Run `node scripts/create-admin.js` to seed Naveen's principal login
5. Start via `pm2 start ecosystem.config.js`
6. Reverse proxy: Nginx → localhost:PORT with TLS

## Known Phase 2 items (non-blocking for Day 1)

- Multi-client projects (junction table `project_clients` with cost-center splits)
- 23 state-machine mid-states with no current transitions (e.g. `material_approvals.rejected`, `pre_handover_snags.in_progress`)
- 9 write-only tables need read-side UI (TDS summary, comms log viewer, MOM unlock audit)
- `vendor_boq_items` population path (line-item BOQ pricing)
- 80+ orphan backend routes need UI wiring or removal
- Playwright end-to-end test suite (scripts ready, run on VPS)
- post-deploy-smoke.sh script

## Contact rules (hardcoded in system)

- **Principal**: Naveen (Naveen@nuassociates.com)
- **Finance admin**: Udupa (single canonical finance user)
- **Bank**: ICICI 233705000984, IFSC ICIC0002337
- **LLP**: NU ASSOCIATES LLP, GSTIN 29AAVFN2055K1ZM, Bengaluru 560070
- **Default user password** (first login, forces change): NuPMC@2026
