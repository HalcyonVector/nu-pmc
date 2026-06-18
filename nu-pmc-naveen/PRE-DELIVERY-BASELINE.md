# Pre-Delivery Check Report
Generated: 2026-04-21T11:20:01.794Z
Total findings: **204**

## Summary

| # | Check | Scanned | Findings |
|---|---|---|---|
| 1 | ✅ Parse clean | 161 | 0 |
| 2 | ✅ Duplicate route registrations | 318 | 0 |
| 3 | ⚠ Ungated routes (no role gate) | 318 | 80 |
| 4 | ⚠ Orphan APP functions | 186 | 12 |
| 5 | ✅ Duplicate APP function declarations | 184 | 0 |
| 6 | ⚠ Table INSERT/SELECT coverage | 91 | 14 |
| 7 | ⚠ Render-map orphans + missing renderers | 93 | 5 |
| 8 | ⚠ In-handler role checks | 55 | 36 |
| 9 | ✅ Routes after module.exports | 55 | 0 |
| 10 | ⚠ Dead schema columns | 84 | 57 |

## Findings

### 3. Ungated routes (no role gate) — 80 findings

**HIGH** (42):
- `changes.js:29` — POST /:project_id — no role middleware, no in-handler role check
- `claims.js:92` — POST /:project_id — no role middleware, no in-handler role check
- `claims.js:263` — PATCH /:project_id/:claim_id/invoice-number — no role middleware, no in-handler role check
- `comms.js:48` — POST /:project_id — no role middleware, no in-handler role check
- `finance.js:121` — POST /:project_id/client-receipts — no role middleware, no in-handler role check
- `forms.js:25` — POST /templates — no role middleware, no in-handler role check
- `forms.js:96` — POST /:project_id/submit — no role middleware, no in-handler role check
- `grn.js:28` — POST /:project_id — no role middleware, no in-handler role check
- `issues.js:59` — POST /:project_id — no role middleware, no in-handler role check
- `issues.js:406` — POST /rfi/:project_id — no role middleware, no in-handler role check
- `issues.js:461` — POST /rfi/:id/answer — no role middleware, no in-handler role check
- `materials.js:336` — POST /:project_id/boq/items — no role middleware, no in-handler role check
- `measurements.js:118` — POST /:project_id/:measurement_id/client-acceptance — no role middleware, no in-handler role check
- `meetings.js:48` — POST /:project_id — no role middleware, no in-handler role check
- `meetings.js:86` — PATCH /:id — no role middleware, no in-handler role check
- `meetings.js:435` — PATCH /action-items/:id/acknowledge — no role middleware, no in-handler role check
- `meetings.js:445` — PATCH /action-items/:id/countersign — no role middleware, no in-handler role check
- `meetings.js:466` — PATCH /action-items/:id/complete — no role middleware, no in-handler role check
- `meetings.js:488` — POST /:project_id/site-visit — no role middleware, no in-handler role check
- `meetings.js:503` — POST /:meeting_id/observation — no role middleware, no in-handler role check
- `meetings.js:526` — POST /:meeting_id/upload — no role middleware, no in-handler role check
- `notifications.js:35` — POST /ses-webhook — no role middleware, no in-handler role check
- `notifications.js:97` — POST /:id/read — no role middleware, no in-handler role check
- `notifications.js:109` — POST /read-all — no role middleware, no in-handler role check
- `payment-requests.js:67` — POST /:project_id — no role middleware, no in-handler role check
- `photo-tags.js:105` — POST /:photo_id/ai-tag — no role middleware, no in-handler role check
- `photos.js:33` — POST /:project_id/upload — no role middleware, no in-handler role check
- `photos.js:150` — POST /:project_id/documents/upload — no role middleware, no in-handler role check
- `register.js:55` — POST /:project_id/upload — no role middleware, no in-handler role check
- `reports.js:246` — POST /:id/mark-sent — no role middleware, no in-handler role check
- `reports.js:267` — POST /:id/ack-anomaly — no role middleware, no in-handler role check
- `schedule.js:84` — POST /:project_id/update — no role middleware, no in-handler role check
- `snags.js:53` — POST /:project_id — no role middleware, no in-handler role check
- `snags.js:87` — POST /:project_id/:id/rectified — no role middleware, no in-handler role check
- `snags.js:97` — POST /:project_id/:id/close — no role middleware, no in-handler role check
- `submittals.js:42` — PATCH /:id/review — no role middleware, no in-handler role check
- `urgent-payments.js:45` — POST /:project_id — no role middleware, no in-handler role check
- `user-management.js:41` — POST /initiate — no role middleware, no in-handler role check
- `vendors.js:83` — POST /master — no role middleware, no in-handler role check
- `vendors.js:585` — PATCH /master/:id/validate-pan — no role middleware, no in-handler role check
- `weekly-signoff.js:60` — POST /:report_id/edit-section — no role middleware, no in-handler role check
- `weekly-signoff.js:100` — POST /:report_id/sign — no role middleware, no in-handler role check

**MED** (38):
- `acc-summary.js:22` — GET /acc-summary/:projectId — no role middleware, no in-handler role check
- `acc-summary.js:163` — GET /acc-preview/:tabKey/:projectId? — no role middleware, no in-handler role check
- `admin-reset.js:182` — GET /wa-failures — no role middleware, no in-handler role check
- `changes.js:11` — GET /:project_id — no role middleware, no in-handler role check
- `delegations.js:127` — GET /effective — no role middleware, no in-handler role check
- `drawings.js:70` — GET /:project_id/:drawing_id/history — no role middleware, no in-handler role check
- `forms.js:12` — GET /templates — no role middleware, no in-handler role check
- `forms.js:76` — GET /templates/:id/download — no role middleware, no in-handler role check
- `forms.js:113` — GET /:project_id/submissions — no role middleware, no in-handler role check
- `gantt.js:9` — GET /:project_id — no role middleware, no in-handler role check
- `grn.js:15` — GET /:project_id — no role middleware, no in-handler role check
- `issues.js:40` — GET /:project_id — no role middleware, no in-handler role check
- `issues.js:335` — GET /:id/photos — no role middleware, no in-handler role check
- `issues.js:389` — GET /rfi/:project_id — no role middleware, no in-handler role check
- `issues.js:503` — GET /ncr/:project_id — no role middleware, no in-handler role check
- `labour.js:7` — GET /:project_id — no role middleware, no in-handler role check
- `meetings.js:32` — GET /:project_id — no role middleware, no in-handler role check
- `meetings.js:352` — GET /:id/action-items — no role middleware, no in-handler role check
- `meetings.js:543` — GET /:meeting_id/documents — no role middleware, no in-handler role check
- `photo-tags.js:92` — GET /:photo_id/history — no role middleware, no in-handler role check
- `photo-tags.js:157` — GET /disputes/:project_id — no role middleware, no in-handler role check
- `photos.js:12` — GET /:project_id — no role middleware, no in-handler role check
- `photos.js:133` — GET /:project_id/documents — no role middleware, no in-handler role check
- `pmc-deputy.js:33` — GET /status — no role middleware, no in-handler role check
- `project-setup.js:15` — GET /:id/scope — no role middleware, no in-handler role check
- `project-setup.js:143` — GET /entities — no role middleware, no in-handler role check
- `project-slas.js:37` — GET /:project_id — no role middleware, no in-handler role check
- `projects.js:91` — GET /:id — no role middleware, no in-handler role check
- `register.js:25` — GET /:project_id — no role middleware, no in-handler role check
- `register.js:235` — GET /:project_id/template — no role middleware, no in-handler role check
- `schedule.js:15` — GET /:project_id — no role middleware, no in-handler role check
- `schedule.js:47` — GET /:project_id/lookahead — no role middleware, no in-handler role check
- `schedule.js:71` — GET /:project_id/versions — no role middleware, no in-handler role check
- `snags.js:16` — GET /:project_id — no role middleware, no in-handler role check
- `submittals.js:13` — GET /:project_id — no role middleware, no in-handler role check
- `urgent-payments.js:139` — GET /:project_id — no role middleware, no in-handler role check
- `weekly-health.js:636` — GET /schedule — no role middleware, no in-handler role check
- `weekly-signoff.js:22` — GET /:report_id — no role middleware, no in-handler role check

### 4. Orphan APP functions — 12 findings

**LOW** (12):
- `public/js/app.js` — APP.expandVendor defined but never called
- `public/js/app.js` — APP.loadFeeSchedule defined but never called
- `public/js/app.js` — APP.loadPendingUsers defined but never called
- `public/js/app.js` — APP.lookupPAN defined but never called
- `public/js/app.js` — APP.getWeatherForReport defined but never called
- `public/js/app.js` — APP.suggestHSN defined but never called
- `public/js/app.js` — APP.draftCNText defined but never called
- `public/js/app.js` — APP.checkSimilarQueries defined but never called
- `public/js/app.js` — APP.readInvoice defined but never called
- `public/js/app.js` — APP.viewReport defined but never called
- `public/js/app.js` — APP.checkVendorDuplicate defined but never called
- `public/js/app.js` — APP.checkClientDuplicate defined but never called

### 6. Table INSERT/SELECT coverage — 14 findings

**MED** (14):
- `codebase` — Table `labour_logs` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `tasks` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `vendor_boq_items` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `change_notice_signatories` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `project` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `issue_photos` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `material_approvals` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `current_pmc_assignments` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `site_manager_leave` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `vendor_contract_history` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `weekly_report_photos` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `site_checkins` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `mom_action_items` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer
- `codebase` — Table `company_entities` has SELECT/FROM but no INSERT/UPDATE — dead sink or external-writer

### 7. Render-map orphans + missing renderers — 5 findings

**LOW** (5):
- `public/js/app.js map/extra` — Tab "schedule" has a renderer but no role has it in ROLE_TABS — unreachable
- `public/js/app.js map/extra` — Tab "documents" has a renderer but no role has it in ROLE_TABS — unreachable
- `public/js/app.js map/extra` — Tab "gantt" has a renderer but no role has it in ROLE_TABS — unreachable
- `public/js/app.js map/extra` — Tab "pending" has a renderer but no role has it in ROLE_TABS — unreachable
- `public/js/app.js map/extra` — Tab "nav_editor" has a renderer but no role has it in ROLE_TABS — unreachable

### 8. In-handler role checks — 36 findings

**LOW** (36):
- `routes/changes.js:79` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/claims.js:192` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/client-boq.js:127` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/client-boq.js:145` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/clients.js:36` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/clients.js:103` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/clients.js:134` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/clients.js:295` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/clients.js:304` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/clients.js:387` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/comms.js:21` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:59` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:68` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:117` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:176` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:209` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:237` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/daily-reports.js:262` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/delegations.js:81` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/drawings.js:28` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/drawings.js:184` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/drawings.js:372` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/drawings.js:350` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/drawings.js:472` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/finance.js:60` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/issues.js:216` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/issues.js:239` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/measurements.js:21` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/measurements.js:45` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/measurements.js:63` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/measurements.js:81` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/measurements.js:149` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/payments.js:668` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/projects.js:15` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/users.js:101` — In-handler role check — migrate to middleware for audit-bypass compat
- `routes/users.js:18` — In-handler role check — migrate to middleware for audit-bypass compat

### 10. Dead schema columns — 57 findings

**LOW** (57):
- `schema.sql` — Column `company_entities.address_line2` defined but never referenced in code or migrations
- `schema.sql` — Column `company_entities.pincode` defined but never referenced in code or migrations
- `schema.sql` — Column `company_entities.email_finance` defined but never referenced in code or migrations
- `schema.sql` — Column `company_entities.bank2_upi_id` defined but never referenced in code or migrations
- `schema.sql` — Column `schedule_tasks.is_payment_milestone` defined but never referenced in code or migrations
- `schema.sql` — Column `drawing_versions.approval_level` defined but never referenced in code or migrations
- `schema.sql` — Column `drawing_versions.l2_rejection_note` defined but never referenced in code or migrations
- `schema.sql` — Column `boq_items.bank_verified` defined but never referenced in code or migrations
- `schema.sql` — Column `boq_items.bank_verification_sent_at` defined but never referenced in code or migrations
- `schema.sql` — Column `boq_items.vendor_confirmed_at` defined but never referenced in code or migrations
- `schema.sql` — Column `boq_items.payment_eligible` defined but never referenced in code or migrations
- `schema.sql` — Column `issues.rectification_note` defined but never referenced in code or migrations
- `schema.sql` — Column `issues.wa_request_sid` defined but never referenced in code or migrations
- `schema.sql` — Column `issues.amber_sent` defined but never referenced in code or migrations
- `schema.sql` — Column `issues.red_sent` defined but never referenced in code or migrations
- `schema.sql` — Column `change_notices.rfi_id` defined but never referenced in code or migrations
- `schema.sql` — Column `password_reset_otps.otp_hash` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_payment_cycles.cycle_type` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_payment_cycles.icici_file_path` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_payment_cycles.confirm_file_path` defined but never referenced in code or migrations
- `schema.sql` — Column `material_approvals.brand_spec` defined but never referenced in code or migrations
- `schema.sql` — Column `material_approvals.sample_submitted_date` defined but never referenced in code or migrations
- `schema.sql` — Column `material_approvals.client_response_date` defined but never referenced in code or migrations
- `schema.sql` — Column `material_approvals.client_comments` defined but never referenced in code or migrations
- `schema.sql` — Column `material_approvals.is_mockup` defined but never referenced in code or migrations
- `schema.sql` — Column `labour_compliance.pf_number` defined but never referenced in code or migrations
- `schema.sql` — Column `labour_compliance.esi_number` defined but never referenced in code or migrations
- `schema.sql` — Column `labour_compliance.labour_licence_number` defined but never referenced in code or migrations
- `schema.sql` — Column `labour_compliance.labour_licence_expiry` defined but never referenced in code or migrations
- `schema.sql` — Column `labour_compliance.alert_sent` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_acknowledgements.ack_type` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_acknowledgements.reference_id` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_acknowledgements.wa_reply` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_payments.amount_auto_calc` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_payments.ai_flag_note` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_payments.icici_ref` defined but never referenced in code or migrations
- `schema.sql` — Column `petty_cash_transactions.recorded_at` defined but never referenced in code or migrations
- `schema.sql` — Column `principal_direct_payments.recorded_at` defined but never referenced in code or migrations
- `schema.sql` — Column `client_receipts.recorded_at` defined but never referenced in code or migrations
- `schema.sql` — Column `tds_records.tds_section` defined but never referenced in code or migrations
- `schema.sql` — Column `tds_records.form16a_received` defined but never referenced in code or migrations
- `schema.sql` — Column `tds_records.quarter` defined but never referenced in code or migrations
- `schema.sql` — Column `pre_handover_snags.responsible_vendor_id` defined but never referenced in code or migrations
- `schema.sql` — Column `archival_log.archived_at` defined but never referenced in code or migrations
- `schema.sql` — Column `archival_log.archived_by` defined but never referenced in code or migrations
- `schema.sql` — Column `archival_log.retain_until` defined but never referenced in code or migrations
- `schema.sql` — Column `weekly_report_documents.generated_at` defined but never referenced in code or migrations
- `schema.sql` — Column `labour_register.recorded_at` defined but never referenced in code or migrations
- `schema.sql` — Column `pmc_deputy.project_assignment_id` defined but never referenced in code or migrations
- `schema.sql` — Column `wa_pending_actions.budget_flag_id` defined but never referenced in code or migrations
- `schema.sql` — Column `wa_pending_actions.rfi_id` defined but never referenced in code or migrations
- `schema.sql` — Column `vendor_boq_items.entered_by` defined but never referenced in code or migrations
- `schema.sql` — Column `client_claims.pmc_signoff_at` defined but never referenced in code or migrations
- `schema.sql` — Column `client_claims.rs_signoff_at` defined but never referenced in code or migrations
- `schema.sql` — Column `meetings.next_meeting_date` defined but never referenced in code or migrations
- `schema.sql` — Column `meetings.client_ack_by` defined but never referenced in code or migrations
- `schema.sql` — Column `mom_items.carried_from` defined but never referenced in code or migrations

