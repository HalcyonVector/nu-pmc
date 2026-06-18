# nu PMC V5 — what's new on Monday morning

A short team note. Forward to anyone who logs into nu PMC.

---

## What changed for you

### 1. DLP Punch List
*Replaces the older "Snag Register" (which was never fully wired up).*

Anyone on a project's team can now raise a defect during the construction → handover phase:

- **Tap "Raise Defect"** on the project's DLP Punch List view. Pick a trade, location, severity (minor / major / critical), and add a description. You can attach a photo from the camera or gallery.
- **Site managers and PMC heads** mark defects as Resolved with a resolution note (min 3 characters).
- **Defects need three signatures to close**: pmc_head, design_head, services_head. (For small projects with only some of these roles assigned, only the assigned roles need to sign.)
- **Photos attached to defects** show as 📷N on the defect card.

### 2. Spot a defect from a site progress photo
A new workflow: when reviewing the project photo gallery and you notice something wrong, tap the photo to open it full-size, then tap **⚠ Flag as Defect**. Fill in trade, location, severity, and a short description. The defect is raised and linked to the existing photo — no need to re-upload. From the defect register you'll see the linked photo as evidence; from the gallery, the photo stays in its original spot.

### 2b. Defect photos in the gallery
Photos that have been flagged as defects show with a coloured pip (red = critical, orange = major, yellow = minor) on the thumbnail. The gallery now has filter chips at the top: **All** (everything), **Progress** (just site progress photos), **Defects** (just photos flagged as defects). Tap a defect photo to see the linked defect's number, severity, and status.

### 3. Lessons Learned (post-closure)
When all four closure signoffs land on a project (pmc_head, design_head, services_head, principal), the project status flips to *completed* and:

- **The team is invited to share lessons.** Any team member, including trainees, can post a learned-lesson with a category: "what went well", "improvement", or "recommendation".
- **AI generates a draft retrospective** combining all the inputs. Principal or design_principal reviews and edits.
- **Once published, the lesson appears in the firm-wide Knowledge Library.** Any nu associates user can read it from the new "Library" tab.

### 4. Knowledge Library (firm-wide)
A new tab: **Library**. Visible to all roles including jr_architect, services_engineer, trainee. Shows published lessons from past projects. Search by project name, client, publisher, or content from the box at the top. Open one to see the full retrospective.

### 5. Closed projects are read-only
Once a project is marked completed, no new writes go to it. Reads (drawings, photos, history, BOQ, etc.) still work. If you try to upload, edit, or sign on a completed project you'll see "Project is closed."

### 6. Behind the scenes (FYI)
- **CSRF protection** on all writes — invisible to users, blocks a class of cross-site attack.
- **Client-error reporting** — when something errors in the browser, IT admin can now see it in a centralised dashboard. Helps us catch silent UI bugs.
- **Photos infrastructure unified** — four old photo tables collapsed into one. No user-visible change today, but it sets up better photo features later.
- **Snag tracking unified** — three legacy snag concepts collapsed into one. Today's "DLP defect" is the canonical snag.

---

## What's the same

- Login is unchanged.
- All your existing projects, drawings, BOQs, schedules, photos, daily reports, weekly reports, payment requests — unchanged.
- All your existing nav tabs are in their existing positions.
- Vendor master, vendor onboarding, RFI flow, MOM flow — all unchanged.
- Notifications — unchanged.

---

## If something doesn't work

1. **First, refresh.** Close the tab and reopen. The new app.js has to load.
2. **If a button doesn't respond** — IT can check the client-error log to see what's failing.
3. **If you can't access something you used to**: roles haven't changed; this is most likely a stale browser session. Log out, log back in.
4. **Direct line to Naveen** for anything urgent.

---

*nu PMC V5 — released [date]*
*Migration tag: v5.9*
*Internal reference: SHIP_READINESS_REPORT.md in the repo*
