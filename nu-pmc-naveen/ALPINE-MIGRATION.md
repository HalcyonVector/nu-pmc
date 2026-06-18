# Alpine.js migration guide (v3+)

## Why this migration

`public/js/app.js` is 6,169 lines. Every screen is built by concatenating HTML
strings into `innerHTML`. Every state change requires a manual re-render. Two
developers can't edit it simultaneously without conflicts on every merge.

Alpine.js (22 KB, no build step) fixes this. Each screen becomes:
- One JS file with reactive state and methods (`public/js/components/<n>.js`)
- One HTML template file (`public/templates/<n>.html`)
- A thin shim in `app.js` that mounts the component

State changes trigger auto re-render. Templates are editable in plain HTML by
anyone. New screens are cheap to build.

## The three reference screens (done)

Study these before migrating anything else. They cover the main patterns.

1. **Profile** — simple form, conditional rendering by role, async action with toast
   - `public/js/components/profile.js`
   - `public/templates/profile.html`
   - Shim in `app.js`: `APP.loadProfile`

2. **Pending users** — list rendering (`x-for`), per-item busy state, refresh after action
   - `public/js/components/pending-users.js`
   - `public/templates/pending-users.html`
   - Shim in `app.js`: `APP.loadPendingUsers`

3. **Petty cash** — props from parent (projectId), money formatting, role-gated actions
   - `public/js/components/petty-cash.js`
   - `public/templates/petty-cash.html`
   - Shim in `app.js`: `APP.loadPettyCash`

## Migration recipe — steps

For each screen `APP.loadFoo` that takes `innerHTML` approach today:

### Step 1. Identify the inputs and outputs

Read the existing `APP.loadFoo` function and list:
- What it fetches (GET calls)
- What it renders (HTML blocks)
- What user actions it supports (clicks, form submits)
- Whether it's role-gated
- Any props passed to it (like `projectId`)

### Step 2. Create the component JS

Create `public/js/components/<slug>.js`. The slug is kebab-case,
matching the template name and the render map key.

```js
window.Components = window.Components || {};

window.Components['slug-here'] = function(props) {
  return {
    // ── State (reactive — templates auto-update when these change)
    loading: true,
    items: [],

    // ── Computed (getters — auto-recompute on dependency change)
    get hasItems() { return this.items.length > 0; },

    // ── Lifecycle
    async init() {
      await this.refresh();
    },

    // ── Methods (called from template via @click etc.)
    async refresh() {
      this.loading = true;
      const res = await API.call('GET', `/endpoint/${props?.projectId}`);
      this.items = res?.items || [];
      this.loading = false;
    },
  };
};
```

### Step 3. Create the HTML template

Create `public/templates/<slug>.html`. No `<html>` or `<body>`— just the
content that was previously in the innerHTML string.

Convert the patterns:
- `${variable}` → `<span x-text="variable"></span>` (or `x-text` on any tag)
- `onclick="APP.foo(...)"` → `@click="foo(...)"` (reference component methods)
- Conditional blocks (`if (role === 'x')`) → `<div x-show="isX">` or `<template x-if="isX">`
- Arrays (`.forEach`) → `<template x-for="item in items">`
- Input bindings → `<input x-model="fieldName">`

### Step 4. Add the shim in app.js

Find `APP.loadFoo` in `app.js` and replace it with:

```js
APP.loadFoo = async function(projectId) {
  if (window.Components?.mount && window.Alpine) {
    const mountFn = Components.mount('content-area', 'slug-here', { projectId });
    return mountFn();
  }
  return APP._loadFooLegacy(projectId);
};

APP._loadFooLegacy = async function(projectId) {
  // ... original implementation stays here unchanged ...
};
```

The fallback preserves the old behaviour if Alpine fails to load (e.g. during
a deploy where the CDN is unreachable).

### Step 5. Test

1. Open the screen. Confirm it renders.
2. Click every button. Confirm actions work.
3. Open DevTools Network tab. Disconnect. Try to save. Confirm offline
   queue indicator appears (from v3 offline work).
4. Reconnect. Confirm queue drains.

### Step 6. After a few weeks of stability — delete the legacy

Once the Alpine version has been in production for ~2 weeks with no rollbacks,
delete `APP._loadFooLegacy` and the fallback branch. This can be a bulk
cleanup PR.

## Gotchas

**Template fetching** — templates load from `/templates/<slug>.html`. The
`Components.mount()` helper caches them after first fetch. If you edit a
template during dev, hard-reload the page.

**Alpine needs to be loaded** — `<script defer src="/js/vendor/alpine-3.14.1.min.js">`
is in index.html. On first deploy, Guru must fetch this file (see
`public/js/vendor/README.md`).

**Component names are kebab-case** with hyphens: `pending-users`, `petty-cash`.
Access them as `window.Components['pending-users']` because JS property
access doesn't like hyphens, but the Alpine directive `x-data` handles it:
`x-data="Components['pending-users'](...)"` or use the template literal syntax
that `Components.mount` generates.

**Modals still live in legacy code** — `APP.showModal`, `APP.showAddCashTxn`,
etc. are called from Alpine components via global references. That's fine
during migration; modal-less flows can be built as sub-components later.

**Shared state** — `APP.user`, `APP.currentProject` etc. are still globals.
Alpine components can read them freely. Don't try to duplicate them inside
component state.

## Order of migration (suggested)

Easy (do first):
- `renderProfile` ✓ done
- `renderPendingUsers` ✓ done
- `renderPettyCash` ✓ done
- `renderDocuments`, `renderNotifications` — simple lists
- `renderRegister` — flat table
- `renderClients`, `renderVendors` — master-list screens

Medium:
- `renderGRN`, `renderIssues`, `renderMeetings` — with filters
- `renderPayments`, `renderPaymentsFin` — with approval actions
- `renderChanges`, `renderBudget` — with nested cards

Hard (do last — they touch everything):
- `renderDashboard` — action centre with many action types
- `renderReports`, `renderWeeklyHealth` — complex state
- `renderSchedule`, `renderGantt` — canvas/SVG rendering
