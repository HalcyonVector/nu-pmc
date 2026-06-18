# Phase 5 — Edge cases that need user (Naveen) decisions

These are NOT bugs from the test harness. They are semantic questions
that only the product owner can answer. Listed for review before V5 ship.

## 1. Concurrent edits / optimistic lock

The codebase uses an `optimistic-lock` middleware. When two users edit
the same record at the same time, the second write is rejected with a
409. Test coverage for this exists in `tests/middleware.test.js`.

Question: should V5 ship with a UX that explains the 409 to users
(e.g., "Saved changes lost — refresh and re-apply"), or is the bare
409 acceptable for the current user base of <30?

## 2. IST timezone vs UTC storage

DB stores DATETIME without timezone. App generates timestamps in IST
in `services/time-ist.js`. Reports + audit logs assume IST display.

Question: any reports/exports that go to clients (CA, vendors, etc.)
expect IST display? Confirm: weekly report PDFs, GST statement, PI
PDFs, MOM exports — all IST. If anywhere reads from DB and treats
the stored value as UTC, that's a bug. Spot-checked: all writers use
`NOW()` which is server local (= IST in production).

## 3. NULL handling in financial reports

Several finance routes do `SUM(amount_paid)` etc. If a row has NULL
amount_paid (incomplete data), it's excluded. For partially-completed
projects, this could under-report.

Question: should NULL amount_paid be treated as 0 in summaries
(`COALESCE(SUM(...), 0)`) or be flagged ("3 PRs missing amounts")?

## 4. Deleted-user references

`users.is_active = 0` deactivates a user but their `id` is still
referenced from `created_by`, `recorded_by`, `approved_by`, etc.
The lookup service joins to `users` to get the name. If the user
is hard-deleted (which doesn't happen in V5 — only deactivated),
the joins return NULL.

Question: in audit logs, what's the desired display when the
acting user is deactivated? "Deactivated user" or actual name? V5
currently shows the actual name (good — preserves accountability).
Confirm this is desired.

## 5. Project assignment cascading

When `project_assignments.is_active = 0`, the user can no longer
access project-scoped routes for that project. But existing data
they wrote stays attributed to them.

Question: when a user is unassigned mid-project, should past
audit-log entries / created records be re-attributed to their
manager, or stay attributed to the unassigned user?

## 6. Trainee read access on unfinalized financials

Trainee-guard now correctly blocks /api/payments, /api/finance
etc (Bug 46 fix). But trainees CAN read drawings, daily reports,
issues. They cannot read budget summaries.

Question: confirm trainees should NOT see budget. Today's V5
behavior: BLOCKED. If trainees need budget for any reason
(e.g., site-trainee tracking material costs), this needs to
change.

## 7. Audit role write-blocking exception list

`blockAuditWrites` currently allows audit to `/api/auth/logout`
only. Should the list grow to include other "audit-noise" writes
like notification mark-as-read?

Today: audit cannot mark notifications as read. Result: their
notification count grows forever. This may be desired (audit
shouldn't be marking things read) but worth confirming.
