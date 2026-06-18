# nu PMC — UI Audit (3 layers)

## Method

Three static analyses run against `public/js/app.js` (9089 lines, 348 methods)
and `public/css/{app,desktop}.css` (434 rules, 37 CSS vars). Same DOM serves
desktop and mobile — `desktop.css` is additive at `@media (min-width: 1024px)`.

| Audit | Tool | Output |
|---|---|---|
| Link mapping table | `tools/audit-link-map.js` | `/tmp/link-map.md` |
| iOS HIG / Material tap-targets + typography | `tools/audit-tap-targets.js` | `/tmp/tap-targets.md` |
| WCAG AA colour contrast | `tools/audit-readability.js` | `/tmp/readability.md` |

---

## Headline counts

**Link map** — 221 clickable rows across 36 pages.
- pass = 122, skip (icon-only) = 21, investigate = 76, **incomplete = 2**, **mismatch = 0**

**Tap targets** (iOS HIG 44pt / Material 48dp).
- below iOS HIG 44px = **0** ✓
- between iOS (44) and Material (48) = 19 (passes iOS, fails Material guideline)
- font sizes below 11px (illegible) = **1**
- font sizes at 13px (below Material 14sp body) = 23 — acceptable for buttons/labels per iOS but borderline for prose

**Contrast** (WCAG AA — 4.5:1 for normal text, 3:1 for large).
- failures = **4** (all on white-or-assumed-white backgrounds)

---

## REAL BUGS (fix)

### 1. Fake-save: "Save Notes" button does not save

`public/js/app.js` line 1286, inside `renderSchedule()`:

```html
<textarea rows="3" placeholder="Work done, observations, blockers…"></textarea>
<button class="btn-primary" onclick="UI.toast('Notes saved ✓')">Save Notes</button>
```

The textarea has no `id` so it's not even reachable from the onclick. The
button just shows a toast claiming success — the user's input is lost when
the page re-renders. The button appears on **two pages** via the call
graph: `schedule` and `tasks` (renderTasks delegates to renderSchedule).

**Fix options** (need design call from Naveen):
- (A) wire to `daily_reports.overall_notes` (creates/updates draft via
  the existing `/api/site/daily-reports` endpoint), or
- (B) remove the button and the textarea — they aren't part of any
  saved flow today

### 2. Contrast regression in desktop.css — 3 occurrences of `#657B90`

The base CSS fixed this exact colour in `:root`:

```css
--steel:  #596A7E;   /* WCAG AA: was #657B90 (4.4:1) → 5.5:1 on white */
```

Then `desktop.css` re-introduced the failing colour by hard-coding it
in three rules — reversing the fix in the desktop layout:

| Line | Selector | Color | Ratio |
|---|---|---|---|
| 214 | `.sec-label`        | `#657B90` | 4.38 |
| 343 | `.signoff-slot .label`  | `#657B90` | 4.38 |
| 348 | `.signoff-slot .status` | `#657B90` | 4.38 |

**Fix**: replace the hex with `var(--steel)` (or `var(--muted2)`) in
all three rules.

### 3. Illegible font: `.signoff-slot .label` at 10px

`desktop.css` line 340: `font-size: 10px` — below the readable floor.
The text is uppercase letter-spaced (so somewhat more legible than 10px
prose), but Apple's HIG flags below 11pt as a deficit. Combined with
the contrast issue above (#657B90), this label is doubly hard to read.

**Fix**: bump to at least 11px (or `var(--text-xs)` = 11px), and change
the colour to `var(--steel)`.

### 4. Borderline contrast: `.btn-sm.flagged` (amber on white) = 3.62:1

`public/css/app.css` line 660: `color: var(--amber)` (`#B07D1A`) on the
default white card background. Below 4.5:1 (3.62) but is on a button
element, so passing 3:1 for "UI components" applies — this is on the
edge. Probably intentional (warning state needs to read as warning),
but flagging for review.

**Fix decision**: keep if the brand wants the amber-flag affordance to
stay visually warning-like; bump to a deeper amber if AA is required
for the button label specifically (e.g. `--amber2: #8C5F12` would give
~5.4:1).

---

## INCOMPLETE STUBS (placeholder, not buggy)

Two onclicks emit `UI.toast()` to advertise unimplemented features:

| Page | Label | Toast text |
|---|---|---|
| drawings | `History` | `History coming soon` |
| drawings | `New Rev` | `Upload new revision — use upload form above` |

These are honest stubs (the toast text reads as such), unlike the
Save-Notes case above. File as known-incomplete and decide whether to
remove or implement.

---

## PLATFORM TRADEOFFS (FYI — not a bug)

### Tap targets between 44px and 48px (19)

All major button classes (`.btn-primary`, `.btn-secondary`, `.btn-sm`,
`.btn-approve`, `.btn-reject`, `.tab`, `.acc-btn`) sit at exactly **44px**
— meeting iOS HIG cleanly but failing Android Material 3's stricter 48dp.

Cross-platform PWAs that target both typically use 48px. Up to you
whether to bump. Sites in this category at 44 today:

```
.btn-out, .tab, .btn-sm.{approve,reject,query,navy,flagged},
.btn-approve, .btn-reject, .btn-secondary, .acc-btn.{outline,email}
```

### Typography below Material 14sp (22 selectors)

These use 13px (`var(--text-sm)`):
buttons (`.btn-sm`, `.btn-approve`, `.btn-reject`, `.btn-secondary`),
tabs, breadcrumb, action-item meta, badges, field labels.

iOS uses 13pt for many UI elements (system caption is 12pt). Material
recommends 14sp+ for body text and ≥12sp for caption/secondary. Buttons
at 13px are conventional on iOS but undersized for Material body content.

Body content at 13px (`.ai-meta`, `.card-meta`) is the borderline case
— if Naveen reads dashboard meta on a phone in sun, 14px would be safer.

---

## INVESTIGATE — needs human eyes

76 link-map rows in `investigate` state. Most are:
- **Empty labels**: button content is `${dynamicVar}`, can't statically tell
- **Helper-emitted onclicks**: e.g. `(via approvalCard)` rows — the helper renders different labels per row
- **Toast-only handlers**: the toast text isn't success-claiming so my heuristic doesn't auto-classify

These aren't bugs, just rows that need a person to read the label
+ context to confirm. See `/tmp/link-map.md` for the full table.

---

## NAVIGATION PATTERN ADHERENCE

iOS HIG and Material both prefer bottom navigation for primary destinations
on phone. The app uses `.bb-item` (bottom-bar items) which sit at
`min-height: 52px` — exceeds both platforms. ✓

Sidebar appears at `≥1024px` (desktop tablets / laptops) — common
hybrid pattern for PWAs. Standard Material navigation drawer + iOS
TabBar maps reasonably onto this.

Footer is hidden on desktop (`display: none !important` at 1024px+) and
visible on phone — appropriate for PWA install context.

The breadcrumb-bar (`.bc-back`, `.bc-bucket`, `.bc-section`) is
phone-only and switches a tab + provides "← Back to bucket" navigation
when an accordion bucket has more than 5 tabs. Per the app.js comment
at line 876, this is by design.

---

## FILES PRODUCED

- `/tmp/link-map.md` — 221-row clickable→destination table per page
- `/tmp/tap-targets.md` — 50+ rule analysis with sizes and font-size sweep
- `/tmp/readability.md` — colour contrast violations against WCAG AA
- `/home/claude/work/tools/audit-link-map.js` — link audit
- `/home/claude/work/tools/audit-tap-targets.js` — tap-target/typography audit
- `/home/claude/work/tools/audit-readability.js` — contrast audit

All three tools are static-only (no runtime browser, no DOM, no rendered
pixel measurements). False positives possible on inherited backgrounds
and dynamic content; each finding is flagged with the assumption used
so it can be verified manually.
