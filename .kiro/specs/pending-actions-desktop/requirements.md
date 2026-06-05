# Requirements Document

## Introduction

The Pending Actions ("Needs You") component in the nu associates Site PMC app currently renders as a
full-width stacked block that dominates the top of the Work bucket on desktop screens. This redesign
repositions the component on desktop as a compact summary card in the upper-right of the content area
while preserving the recently-updated full-width stacked layout on mobile. The goal is better
information density: approvals and operational alerts stay visible without consuming disproportionate
vertical or horizontal space.

## Glossary

- **Pending_Actions_Card**: The UI component that displays the "⚡ Needs You" and "📋 Today's Report"
  sections fetched from `/api/needs-you/me` and the daily-reports API.
- **Desktop_Layout**: The app layout active at `min-width: 1024px`, where the sidebar occupies the
  left 240 px column and the right column holds topbar, work-pinned, and content.
- **Mobile_Layout**: The app layout active at `max-width: 799px`, where all elements stack in a
  single column with no sidebar.
- **Summary_Card**: A compact, right-aligned card on desktop that shows the total pending count and
  individual line items without occupying the full content width.
- **Work_Pinned_Region**: The `.work-pinned` DOM element rendered above `#content-area` inside the
  Work bucket, controlled by `APP._renderWorkPinned()`.
- **Total_Pending_Count**: The sum of all `count` values across every approval-type item in
  `APP._needsYou.items` for the current user.
- **Approval_Row**: A `wp-row` element whose `it.kind !== 'radar'` — carries a label and a numeric
  count badge and navigates to the relevant tab.
- **Radar_Row**: A `wp-row` element whose `it.kind === 'radar'` — carries a warning label and a
  chevron and navigates to the relevant tab or project item.
- **Today_Report_Card**: The "📋 Today's Report" sub-card shown only to `site_manager` and
  `senior_site_manager` roles when a project is selected.

---

## Requirements

### Requirement 1: Desktop Summary Card Placement

**User Story:** As a PMC team member on a desktop browser, I want the Pending Actions card to sit
compactly in the upper-right corner of the content area, so that approval alerts are visible without
a wide empty stripe eating into the working area.

#### Acceptance Criteria

1. WHILE the Desktop_Layout is active and the Work bucket is open, THE Pending_Actions_Card SHALL
   be rendered as a Summary_Card floated to the right side of the Work_Pinned_Region.
2. WHILE the Desktop_Layout is active, THE Summary_Card SHALL have a fixed maximum width of 320 px
   and SHALL NOT stretch to fill the full content column.
3. WHILE the Desktop_Layout is active and the Work bucket is open, THE Pending_Actions_Card SHALL
   appear in the upper-right of the Work_Pinned_Region so that content below it begins at the top
   of the page, not below the card.
4. WHILE the Desktop_Layout is active and the Work_Pinned_Region contains no items, THE
   Work_Pinned_Region SHALL remain hidden (`:empty` rule continues to apply).

---

### Requirement 2: Total Pending Count Badge

**User Story:** As a PMC team member, I want to see the total number of pending actions at a glance
in the card header, so that I can quickly judge urgency without reading every line item.

#### Acceptance Criteria

1. THE Pending_Actions_Card SHALL display a Total_Pending_Count badge in its header, computed as
   the arithmetic sum of all Approval_Row `count` values for the current user and project.
2. WHEN the Total_Pending_Count is zero, THE Pending_Actions_Card SHALL hide the numeric badge and
   display no count label in the header.
3. WHEN the Total_Pending_Count is greater than 99, THE Pending_Actions_Card SHALL display "99+"
   instead of the exact number in the header badge.
4. THE Total_Pending_Count SHALL be recomputed each time `APP._renderWorkPinned()` executes and
   the badge SHALL reflect the latest value from `APP._needsYou`.

---

### Requirement 3: Line Items Remain Visible Without Dominating

**User Story:** As a PMC team member, I want to see all individual pending items inside the card
without the card occupying most of the screen, so that I can identify which area needs attention
while still having space to read the main content below.

#### Acceptance Criteria

1. THE Summary_Card SHALL render every Approval_Row and Radar_Row from `APP._needsYou.items` as a
   compact row inside the card body — one row per item.
2. WHEN the number of items exceeds 6, THE Summary_Card SHALL constrain its body height and display
   an internal vertical scroll within the card rather than expanding the card indefinitely.
3. THE Summary_Card body height SHALL NOT exceed 260 px before internal scrolling activates.
4. WHILE the Desktop_Layout is active, each row within the Summary_Card SHALL have a minimum
   touch/click target height of 36 px.
5. THE Summary_Card SHALL preserve the existing click behaviour: Approval_Rows call
   `APP.switchTab(tab)` and Radar_Rows call `APP._radarTap(tab, project, item)` or
   `APP.switchTab(tab)` as determined by whether `it.project` is set.

---

### Requirement 4: Mobile Layout Preserved

**User Story:** As a PMC team member on a mobile device, I want Pending Actions to continue showing
as full-width stacked card rows, so that the touch-friendly layout I already use is not disrupted.

#### Acceptance Criteria

1. WHILE the Mobile_Layout is active, THE Pending_Actions_Card SHALL render using the existing
   `.wp-card` / `.wp-row` full-width stacked layout with no float, no max-width constraint, and no
   summary-card positioning.
2. WHILE the Mobile_Layout is active, each Approval_Row and Radar_Row SHALL have a minimum height
   of 44 px to meet touch-target guidelines.
3. WHILE the Mobile_Layout is active, THE Today_Report_Card SHALL continue to appear as a separate
   full-width `.wp-card` above the Needs You card when visible.
4. IF the Mobile_Layout CSS breakpoint changes in the future, THEN THE Pending_Actions_Card SHALL
   require only a CSS change to adapt — no JS logic changes SHALL be needed to switch layouts.

---

### Requirement 5: Today's Report Card Co-location on Desktop

**User Story:** As a Site Manager or Senior Site Manager on desktop, I want the Today's Report card
to appear near the Needs You summary card rather than in a separate position, so that both
actionable items are co-located.

#### Acceptance Criteria

1. WHILE the Desktop_Layout is active and the current user role is `site_manager` or
   `senior_site_manager` and a project is selected, THE Today_Report_Card SHALL be rendered inside
   or adjacent to the Summary_Card in the upper-right Work_Pinned_Region.
2. WHILE the Desktop_Layout is active, THE Today_Report_Card SHALL NOT exceed the same 320 px
   maximum width as the Summary_Card.
3. WHEN only the Today_Report_Card is present and `APP._needsYou.items` is empty, THE
   Today_Report_Card SHALL render in the upper-right position and the Work_Pinned_Region SHALL NOT
   show an empty left-side region.

---

### Requirement 6: Content Layout Not Disrupted

**User Story:** As a PMC team member on desktop, I want the main content (reports list, approvals
table, etc.) to start immediately below the topbar and not be pushed down by the Pending Actions
card, so that screen real estate is used efficiently.

#### Acceptance Criteria

1. WHILE the Desktop_Layout is active and the Summary_Card is visible, the main tab content in
   `#content-area` SHALL begin at the top of the visible content region — it SHALL NOT be pushed
   below the full height of the Summary_Card.
2. THE Summary_Card SHALL use CSS float or absolute/fixed positioning within the Work_Pinned_Region
   such that surrounding content wraps alongside it rather than stacking below it.
3. WHEN the Summary_Card is taller than the first content block, the content SHALL wrap or flow
   naturally alongside the card without horizontal overflow or layout breakage.
4. WHILE the Desktop_Layout is active, THE Work_Pinned_Region SHALL clear floats after the Summary_Card
   so that subsequent page sections are not affected.

---

### Requirement 7: Visual Hierarchy and Styling Consistency

**User Story:** As a PMC team member, I want the redesigned card to look cohesive with the rest of
the desktop UI, so that the interface feels intentional and professional.

#### Acceptance Criteria

1. THE Summary_Card SHALL use the existing CSS custom properties (`--navy`, `--amber`, `--white`,
   `--border`, `--shadow`, `--r2`, `--text-sm`, `--text-xs`) so that it adapts automatically to
   any future theme changes.
2. THE Summary_Card header SHALL display the "⚡ Needs You" label using the `.wp-label` monospace
   style already defined in `app.css`.
3. THE Summary_Card SHALL carry a `border-left: 3px solid var(--navy)` accent consistent with the
   existing `.wp-card` style.
4. WHILE the Desktop_Layout is active, THE Summary_Card box-shadow, border-radius, and background
   SHALL match the desktop card styles defined under `.card` in `desktop.css`
   (`background: #FFFFFF`, `border-radius: 10px`, `box-shadow: 0 1px 2px rgba(29,61,98,.04)`).
5. THE Summary_Card SHALL NOT introduce new colour tokens or font families outside those already
   defined in the existing CSS custom property set.

---

### Requirement 8: Accessibility

**User Story:** As a user who navigates by keyboard or uses assistive technology, I want Pending
Actions to be accessible, so that I can understand and act on pending items without using a mouse.

#### Acceptance Criteria

1. THE Summary_Card SHALL include an `aria-label` attribute on its container element with the value
   "Pending actions" so that screen readers announce its purpose.
2. THE Pending_Actions_Card SHALL render each Approval_Row and Radar_Row as a `<button>` element
   (already the existing pattern) so that keyboard focus and activation work without additional
   ARIA roles.
3. WHEN the Total_Pending_Count badge is present, THE Pending_Actions_Card SHALL wrap it in a
   `<span>` with `aria-label="N pending actions"` where N is the count, so the value is announced
   by screen readers.
4. WHILE the Desktop_Layout is active, THE Summary_Card SHALL remain reachable via Tab key focus
   order before the main tab content so that keyboard users encounter it in a logical sequence.
