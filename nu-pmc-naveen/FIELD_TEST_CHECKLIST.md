# nu PMC — Real-Device Field Checklist

**For:** Anjaneya (site), Murugesan (PMC), Rajani (design), Arun (site cover)
**Device:** Your actual work phone, NOT a lab device
**Where:** Site office + outdoor work area + on-the-move
**When:** At least one full workday each — morning, afternoon, evening

> **How to use this:** Work through each section in order. For each test, mark **PASS / FAIL / SKIP** and note anything weird in the "Notes" column. If something fails, take a screenshot or video. Return the completed sheet + any screenshots at the end of your test day.

---

## Pre-check before you start

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 0.1 | You have your real work phone (not a borrowed test phone) | | |
| 0.2 | Phone battery ≥ 30% (plug in first if below) | | |
| 0.3 | You know your test login: test_<role> / Test1234 | | |
| 0.4 | You know the app URL | | |
| 0.5 | Weather condition noted (sunny / cloudy / shaded site etc.) | | |

---

## 1. First-time install (PWA)

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 1.1 | Open the app URL in your default phone browser (Chrome/Safari) | | |
| 1.2 | Login with your test credentials — logs you in within 10 seconds | | |
| 1.3 | After first login, you see a banner/prompt to "Install" or "Add to Home Screen" | | |
| 1.4 | Install the app — new icon appears on home screen | | |
| 1.5 | Open the app from the home-screen icon — launches in full-screen mode, no browser bar | | |
| 1.6 | App remembers you're logged in (no re-login needed after install) | | |
| 1.7 | Run `/self-test.html` — the diagnostic page — and all tests pass or warn only on "Camera" if you've not given permission yet | | |

---

## 2. Touch & ergonomics

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 2.1 | All buttons on the bottom nav bar are easy to hit with your thumb — no mis-taps | | |
| 2.2 | Tabs bar at the top is legible (you can read all tab labels) | | |
| 2.3 | You can operate the app **one-handed** (thumb-reachable buttons) | | |
| 2.4 | Text inputs (notes, reasons) pop up the keyboard without the input being hidden behind it | | |
| 2.5 | Can you close the keyboard and scroll the page independently? | | |
| 2.6 | **Try wearing work gloves** — can you still tap buttons accurately? | | |
| 2.7 | **Try with wet/sweaty fingers** — does the screen still respond? | | |

---

## 3. Daylight & outdoor visibility

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 3.1 | In direct sunlight, you can read the app without squinting | | |
| 3.2 | Status badges (red/amber/green) are distinguishable in bright light | | |
| 3.3 | Photo thumbnails render visibly in daylight (not washed out) | | |
| 3.4 | You can read amounts in ₹ format without zooming (e.g. ₹1,50,000) | | |
| 3.5 | In a shaded outdoor spot, app is comfortable to read | | |

---

## 4. Core workflows (role-specific)

### 4a. Site Manager (Anjaneya / Arun / Prajwal)

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 4a.1 | Submit today's daily report from Work tab — click "Today's Report", enter notes, submit | | |
| 4a.2 | Raise a GRN — Money → GRN → + Raise — fills in engagement, quantity, upload photo | | |
| 4a.3 | Camera opens from the upload button and captures a clear photo | | |
| 4a.4 | Raise an issue — Work → Issues → + Raise — type "safety", brief description | | |
| 4a.5 | See your own issues in the list with correct status | | |
| 4a.6 | Log labour for today — Work → Labour → add head count | | |
| 4a.7 | View your assigned drawings — Work → Drawings — can scroll and see latest versions | | |
| 4a.8 | Attempt an action on another project (if any visible) — should be blocked | | |

### 4b. PMC Head (Murugesan / Praveen)

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 4b.1 | Review Needs You pinned card on Work tab — shows today's pending reports, MOMs, PRs, GRNs | | |
| 4b.2 | Approve a daily report — Work → Reports → pick one → Approve | | |
| 4b.3 | Flag a report with a reason — correct report goes to "flagged" list | | |
| 4b.4 | Approve a PR — Money → Payments → Approve All → the expected count approves | | |
| 4b.5 | Check Pending tab — shows blocked items with age days | | |
| 4b.6 | PMC Assignment card shows you as Primary / Backup on relevant projects | | |

### 4c. Design Head (Rajani) / Services Head

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 4c.1 | See drawings pending your sign-off in the Drawings tab | | |
| 4c.2 | Approve a drawing version — status goes from pending_l1 or pending_l2 to issued | | |
| 4c.3 | Reject a drawing with rejection note — uploader gets notified | | |
| 4c.4 | Raise a submittal request | | |
| 4c.5 | Respond to an RFI assigned to you — Issues tab → click issue → Resolve with note | | |

---

## 5. Network flakiness (IMPORTANT — can't skip)

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 5.1 | Turn phone to **airplane mode** | | |
| 5.2 | Try to submit a daily report — see offline message | | |
| 5.3 | Check that offline indicator is visible | | |
| 5.4 | Turn airplane mode **off** — app syncs the queued submission automatically within 30s | | |
| 5.5 | Go to a **low-signal area** (e.g. basement, inside an RCC slab enclosure) | | |
| 5.6 | Try to load a drawing PDF — does it show a clear "loading / slow" indicator or does it hang? | | |
| 5.7 | Drop signal mid-upload of a photo — reconnect — does the photo retry? | | |

---

## 6. Multi-instance & freshness

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 6.1 | Log in on your phone. Ask a colleague to raise an issue assigned to you, on their phone | | |
| 6.2 | Without reloading, your Needs You count reflects the new item within 60 seconds | | |
| 6.3 | Tap refresh/pull-down — new issue appears in your list | | |
| 6.4 | Two people try to approve the same GRN at the same moment — one succeeds, the other sees a clear message (not silent failure) | | |

---

## 7. Safety: can you break it?

Try these deliberately — we want to know the app refuses gracefully.

| # | Task | PASS / FAIL | Notes |
|---|---|---|---|
| 7.1 | Type 5000 characters into a notes field — does it truncate cleanly or accept it? | | |
| 7.2 | Paste an image from clipboard instead of typing — does anything weird happen? | | |
| 7.3 | Rapidly tap "Approve" 10 times — does it register 10 approvals or 1? | | |
| 7.4 | Upload a non-image file (e.g. a PDF) as a "photo" — does it reject with a clear message? | | |
| 7.5 | Change your phone's system language — does the app stay functional (numbers, dates still make sense)? | | |

---

## 8. End-of-day reflection

| # | Question | Your answer |
|---|---|---|
| 8.1 | Biggest friction in your typical day's flow? | |
| 8.2 | One thing that slowed you down more than expected? | |
| 8.3 | One thing that was faster than paper? | |
| 8.4 | Would you trust this with a statutory deadline (ELCITA inspection, BBMP submission)? Why / why not? | |
| 8.5 | What would you change first? | |
| 8.6 | Screenshots/videos of any failures — attach | |

---

## 9. Sign-off

**Tester name:** _______________________________
**Role:** _______________________________
**Device + OS:** _______________________________ (e.g. iPhone 13 / iOS 17.2, Redmi Note 12 / Android 13)
**Date:** _______________________________
**Site location:** _______________________________

**Overall verdict:** ☐ Safe to ship  ☐ Ship with fixes  ☐ Not ship-ready

**Signature:** _______________________________

---

## How to return this checklist

1. Fill in PASS/FAIL columns on your phone or paper
2. Take screenshots of any FAILs with circled problem areas
3. WhatsApp the filled sheet + screenshots to Naveen
4. Verbal debrief call within 24h of testing
