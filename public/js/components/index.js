// public/js/components/index.js
// ============================================================
// Alpine.js component registry for nu-pmc v3+.
//
// This is the NEW way to build screens. Old screens in app.js
// (APP.render* functions) continue to work unchanged. As screens
// are migrated, the APP.render map in app.js points to a thin
// shim that mounts an Alpine component into the target element
// instead of setting innerHTML from a template literal.
//
// ── Pattern ─────────────────────────────────────────────────
// 1. Create public/js/components/<name>.js with an Alpine component:
//
//      // public/js/components/profile.js
//      window.Components = window.Components || {};
//      window.Components.profile = () => ({
//        user: null, loading: true,
//        async init() {
//          const res = await API.get('/auth/me');
//          this.user = res?.user || null;
//          this.loading = false;
//        },
//        // any methods callable from the template
//      });
//
// 2. In app.js, the render map entry becomes:
//
//      profile: Components.mount('profile-screen', 'profile'),
//
// 3. The template lives in /templates/<name>.html and is fetched
//    once then cached. Keeping templates out of JS keeps them
//    editable by non-JS hands (and makes diffs clear).
//
// ── Why Alpine? ─────────────────────────────────────────────
// - 45 KB, no build step (Naveen's rule: no build pipeline)
// - Directives live in HTML where they're visible
// - Reactive state per component, no global state management
// - Coexists with existing code — incremental migration
// ============================================================

window.Components = window.Components || {};

const _templateCache = new Map();

/**
 * Components.mount(containerId, componentName, props)
 * Returns an async function (render map signature) that:
 *   1. Ensures the template HTML is loaded
 *   2. Injects it into #containerId with x-data pointing at the component
 *   3. Passes props to the component factory
 */
Components.mount = function(containerId, componentName, props = {}) {
  return async function mountAlpineComponent() {
    const factory = window.Components[componentName];
    if (typeof factory !== 'function') {
      console.error(`[Alpine] No component registered: ${componentName}`);
      return;
    }

    // Fetch template (cached after first load)
    let tpl = _templateCache.get(componentName);
    if (!tpl) {
      try {
        const resp = await fetch(`/templates/${componentName}.html`, { credentials: 'include' });
        if (!resp.ok) throw new Error(`Template fetch failed: ${resp.status}`);
        tpl = await resp.text();
        _templateCache.set(componentName, tpl);
      } catch (err) {
        console.error(`[Alpine] Failed to load template for ${componentName}:`, err);
        return;
      }
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[Alpine] Container #${containerId} not found`);
      return;
    }

    // Expose props to the factory via a global stash keyed by component name
    window.__alpineProps = window.__alpineProps || {};
    window.__alpineProps[componentName] = props;

    // Inject — the x-data attribute ties it to the factory
    container.innerHTML = `<div x-data="Components.${componentName}(__alpineProps.${componentName})" x-init="init && init()">${tpl}</div>`;

    // If Alpine has already initialised the page, trigger a re-scan
    if (window.Alpine?.initTree) {
      Alpine.initTree(container);
    }
  };
};

/**
 * Components.render(containerId, html)
 * Escape hatch — render plain HTML without Alpine. Used during migration
 * for screens that aren't Alpine-based yet.
 */
Components.render = function(containerId, html) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = html;
};
