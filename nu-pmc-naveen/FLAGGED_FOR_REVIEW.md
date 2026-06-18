# Flagged for Architectural Review

These items found in Phase 4 GUI link audit. They are NOT V5 ship-blockers
on their own — they are missing features or architectural decisions that
need product-level review.

## 1. Handover checklist upload — frontend ghost call

The frontend `public/js/app.js:4410` calls:
```javascript
const res = await fetch(`/api/handover/${projectId}/checklist/${itemId}/upload`,
  { method: 'POST', body: fd }).then(r => r.json());
```

There is NO backend implementation. No `handover` route module exists in
`modules/site/routes/` or anywhere else. The frontend will get a 404
whenever a user tries to upload a checklist item during handover.

Decision needed:
- (a) Build the handover module (significant work — checklist tables,
  document upload, project-scope gating, signoff workflow)
- (b) Hide the UI element that triggers this call (find the form/button
  that calls this and remove or disable it)
- (c) Defer to V6

Recommended: (b) for V5 ship; (a) for V6 if handover workflow is on the
product roadmap.
