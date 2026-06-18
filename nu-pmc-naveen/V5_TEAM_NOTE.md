# nu PMC V5 — Monday Morning Note

**For:** All nu associates team (architects, engineers, PMC, finance, principals)
**Date:** Monday, 27 April 2026
**From:** Naveen

---

## What changed over the weekend

Five areas of the nu PMC platform got better. Most of you won't notice anything different in your day-to-day; a few of you will see new tools appear in your menu.

### 1. Defect tracking is now in one place

Previously, snags and defects could live in three different places depending on which screen you raised them from — a "Snag Register" screen, a pre-handover snags concept, and the new DLP punch list. That was confusing and meant you couldn't search across them.

**Now:** every defect, NCR, RFI, and snag is one thing — an "issue" — with a type. The DLP punch list, the snag register, all roll up to the same underlying record. You'll see them in the same place; you can search across them; the audit trail is one chain.

**Action for you:** none. The screens you use look the same. The data is just consolidated underneath.

### 2. Photos can now belong to anything

Before, a photo uploaded as site progress couldn't easily become evidence for a defect — you'd have to upload it twice. The four separate photo tables (project photos, issue photos, meeting photos, weekly report photos) are now one polymorphic table.

**New workflow:** if you spot a defect in someone else's site progress photo, you can flag it from the photo viewer and a snag is raised that references the original photo. No re-upload. The photo's history shows up: "uploaded as progress evidence on 12 March, flagged as defect by [you] on 18 March."

**Action for you:** the "Flag as defect" button on photos isn't wired into the frontend yet — that's coming this week. Backend is ready.

### 3. Knowledge Library

When a project closes (all four signoffs in), the team's lessons learned now publish to a firm-wide Knowledge Library. Anyone in the firm — jr_architects, services_engineers, anyone — can read past project lessons.

**Where:** new "Library" tab in your bottom nav (5 roles see it: principal, design_principal, pmc_head, design_head, services_head). Anyone else with the right login can see it via direct link.

**What's in it now:** nothing — no projects have closed since this went live. Lessons accumulate as projects close.

**For closing teams:** when your project closes, log lessons against `Lessons` tab. Categories are "what went well", "improvement", "recommendation". The system AI-drafts a synthesis from all team inputs; the principal edits and publishes.

### 4. Closed projects can't be edited

If a project is closed (status = completed), all writes return 403 with code `PROJECT_CLOSED`. Reads still work. This prevents accidental data corruption on closed projects.

**Action for you:** if you're trying to edit something on a project that's been closed, the system will tell you. If that's wrong (you needed to edit), talk to me — we'll re-open the project on the backend.

### 5. CSRF protection + client-error reporting

Behind the scenes: every form submission now carries a CSRF token. If a phishing site tries to make your browser POST to nu PMC while you're logged in, the request fails. You won't notice — it's invisible — but it closes a security hole.

Also: when something on the frontend fails (say a bug in the React code), the error gets reported back to the server. We get a log of "this user, this screen, this error" so we can fix things faster. Logs are admin-only, no PII is included.

---

## What's not changed

- All your existing screens. Snag register screens look the same. Photo gallery looks the same. Daily reports work the same.
- Permissions. If you could see something before, you can still see it.
- Your password.
- File paths, file storage. Old photos still load.

---

## Known small gaps that we'll close this week

1. **"Flag as defect from photo" button** — backend is ready. Frontend button on the photo viewer hasn't been added yet. Workaround: raise the snag the normal way and reference the photo by file name.

2. **Knowledge Library search** — for now, library shows ALL published lessons in a list. When we have 50+ lessons, we'll add filter-by-trade and search. Not urgent.

3. **AI draft regeneration on demand** — the "Generate AI Draft" button on the Lessons screen now actually works (was previously hitting a missing endpoint and silently failing). If you noticed nothing happened when you clicked it before, try again.

---

## If something breaks

Send a message to me with:
- What you were trying to do (one line)
- Which screen you were on (URL or tab name)
- What happened (error message or describe it)

The client-error reporter is also catching errors automatically, so I may already know.

---

— Naveen
