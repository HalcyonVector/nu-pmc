# NU Associates PMC - UI/UX Design Baseline (Do Not Regress)

Before implementing any new UI changes, preserve the following approved design decisions unless explicitly instructed otherwise.

## Navigation

### Desktop
* Left sidebar remains primary Work module navigation.
* Sidebar contains:
  * Issues
  * Meetings
  * Drawings
  * Register
  * Materials
  * Labour
  * Daily Reports
  * Weekly Reports

### Mobile
* Bottom navigation remains fixed:
  * Home
  * Work
  * Money
  * Pending
* Work module navigation remains visible and accessible while scrolling.
* Mobile module navigation should not disappear after scrolling.

---

## Dashboard Density
* Reduce excessive whitespace.
* Prioritize operational content over decorative widgets.
* Maximize information visible above the fold.
* Avoid large empty regions.

---

## Pending Actions
Current intent:
* Pending Actions remains visible within Work pages.
* Do not use:
  * Large right-side sidebar.
  * Full-width oversized banner.
  * Tiny chip strip with no visual emphasis.
Preferred direction:
* Compact dashboard summary component.
* Clear visibility.
* Does not consume excessive space.
* Separate from primary page actions.

---

## Action Buttons
Examples:
* Raise Issue
* New MOM
* Raise GRN
Rules:
* Primary actions should not be embedded inside Pending Actions components.
* Primary actions should remain clearly associated with their page content.

---

## Mobile Layout Rules
* Mobile layouts may differ from desktop layouts.
* Do not force desktop arrangements onto mobile.
* Prefer vertical stacking.
* Avoid placing section titles and primary buttons on the same row when space becomes constrained.
* Maintain touch-friendly spacing.

---

## Branding
Desktop and mobile must consistently display:
* nu associates
* SITE PMC
Do not allow mobile layouts to hide or clip branding.

---

## Footer
Footer branding:
* nu associates
* ARCHITECTURE · ENGINEERING · PMC
Must remain visible at page bottom and must not be obscured by fixed navigation.

---

## Responsive Requirements
Every UI change must be validated on:
* Desktop
* Tablet
* Mobile
A fix for one breakpoint must not regress another breakpoint.

---

## Regression Prevention
Before completing any UI task:
* Compare against previously approved layouts.
* Do not remove approved behavior unless explicitly requested.
* Limit changes to affected components.
* Preserve existing functionality.
