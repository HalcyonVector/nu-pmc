/* global API, UI, GANTT */

// app.js — Main application controller

// Raw-fetch helper for the rare case that needs to bypass API.call (none today —
// the 7 multipart upload sites that previously used this were converted to
// API.call('POST', path, fd, true) so they get the audit-role intercept and
// 401-redirect for free, see B21 in the audit). Kept here in case a future
// caller has a legitimate need for direct fetch.
function csrfHeaders() {
  const m = document.cookie.match(/(?:^|;\s*)nu_csrf=([^;]+)/);
  return m ? { 'X-Nu-CSRF': decodeURIComponent(m[1]) } : {};
}

const _TRADE_COLORS_RAW = {
  'civil':'#c8a55a','electrical':'#4a8fa8','it / networking':'#4a8a5a',
  'hvac':'#9a6ab8','fire / suppression':'#a84a3a','pa & fire alarm':'#a88a2a',
  'interior':'#7a5a9a','plumbing':'#3a8a7a','handover':'#5a5a5a',
  'architectural':'#c8a55a','structural':'#4a8fa8','finishing':'#c8a55a',
  'mep':'#4a8fa8','general':'#5a5a5a','civil & structural':'#c8a55a',
};
const TRADE_COLORS = new Proxy(_TRADE_COLORS_RAW, {
  get(t, k) { return typeof k === 'string' ? t[k.toLowerCase()] : undefined; }
});
const MAT_STATUSES = ['Requested','Ordered','Dispatched','Received','Checked & Validated'];

// ROLE_TABS removed — nav is DB-driven via /api/nav/me. Login enforces that
// the role has at least one row in role_nav before issuing a session, so the
// "no nav configured" case is caught at auth time, not here.

const TAB_LABELS = {
  dashboard:'Dashboard',    projects:'Projects',      changes:'CNs',
  monthly:'Monthly Overview',  project_detail:'Project Summary',
  budget:'Budget',          payments:'Payments',      payments_fin:'Payments',
  schedule_view:'Schedule', weekly_health:'Health',   users:'Users',
  schedule:'Schedule',
  flags:'Flags',
  reports_daily:'Daily Reports', reports_weekly:'Weekly Reports', grn:'GRNs',  issues:'Issues',
  meetings:'Meetings',       labour:'Labour',
  drawings:'Drawings',       register:'Register',
  delegations:'Delegations',  signoff:'Weekly Sign-off', phototags:'Photo Review',
  issues_site:'Field Issues', tasks:'Tasks',             photos:'Photos',
  pi:'Invoices',            petty_cash:'Petty Cash',   client_receipts:'Receipts',
  submittals:'Submittals',  notifications:'Alerts',    ncr:'NCRs',
  compliance:'Compliance',  tally:'Tally',
  gst_statement:'GST',      pending:'Pending',
  reports:'Reports',        approvals:'Approvals',    deputy:'Deputy',
  // Consolidation renames (Sprint 2 Item 4)
  boq_mapping:'Vendor Allocation',      // was "BOQ Map"
  budget_tree:'Budget Tree',            // merged into Budget tab, kept for Audit visibility
  clients:'Clients',
  vendors_master:'Vendors',             // was "Vendor Master" — now includes Clearance section
  finance_clearance:'Vendor Clearance', // kept for Audit role; main users see it inside vendors_master
  vendors:'Engagements',
  materials:'Materials',
  materials_site:'Materials',
  client_boq:'Client Contract',         // was "Client BOQ"
  nav_editor:'Nav Editor',
  boq_versions:'BOQ Versions',
  governance:'Governance',
  account_setup:'Account Setup',
  ai_settings:'AI Features',
  errors_log:'Error Log',
  library:'Knowledge Library',
  // New module tabs
  claims:'Claims',            forms:'Inspections',       labour_quick:'Labour (Quick)',
  schedule_quick:'Schedule Quick', comms:'Comms',       
  measurements:'Measurements', handover:'Handover',
 
};

const APP = {
  user: null,
  currentTab: null,
  state: {
    selectedProject: null,
    selectedDate: UI.todayIST(),
    scheduleView: 'today',
    dwgFilter: 'All',
    taskPct: {},
  },

  // ── SORT-TOGGLE HELPERS (Sprint 2 Item 7) ───────────────────────
  // Every list render tab can include a 3-mode sort toggle at the top:
  //   Default · Urgency · Age
  // User preference per-tab persists in localStorage under 'nu_sort_modes'.
  _sortModes: null,

  _loadSortModes() {
    if (APP._sortModes) return APP._sortModes;
    try {
      APP._sortModes = JSON.parse(localStorage.getItem('nu_sort_modes')) || {};
    } catch (_e) {
      APP._sortModes = {};
    }
    return APP._sortModes;
  },

  _getSortMode(tabKey, defaultMode = 'default') {
    APP._loadSortModes();
    return APP._sortModes[tabKey] || defaultMode;
  },

  _setSortMode(tabKey, mode) {
    APP._loadSortModes();
    APP._sortModes[tabKey] = mode;
    try { localStorage.setItem('nu_sort_modes', JSON.stringify(APP._sortModes)); } catch (_e) {}
    // Re-render whichever tab is currently visible
    if (APP.currentTab) APP.render(APP.currentTab);
  },

  // Build the sort-toggle pill row. `modes` is an array subset of
  // ['default','urgency','age'] — pass only modes that make sense for
  // this list (e.g. Photos doesn't have urgency).
  _sortToggleHTML(tabKey, modes = ['default','urgency','age']) {
    const current = APP._getSortMode(tabKey);
    const LABEL = { default:'Default', urgency:'Urgency', age:'Age ↓' };
    return `<div style="display:flex;gap:6px;margin-bottom:12px">${
      modes.map(m => `<button class="btn-sm ${m===current?'navy':''}"
        onclick="APP._setSortMode('${tabKey}','${m}')">${LABEL[m]||m}</button>`
      ).join('')
    }</div>`;
  },

  // Sort an array of items by the chosen mode.
  //   mode='default' — no-op (preserves server order)
  //   mode='urgency' — sorts by urgencyField (higher = more urgent), then age
  //   mode='age'     — oldest first (uses ageField as ISO date/datetime)
  _applySort(items, mode, { urgencyField = null, ageField = 'created_at' } = {}) {
    if (!Array.isArray(items) || mode === 'default') return items;
    const arr = items.slice();
    if (mode === 'urgency' && urgencyField) {
      const SEV = { critical:4, high:3, safety:3, quality:3, medium:2, rfi:2, design:2, low:1, compliance:1 };
      arr.sort((a,b) => (SEV[b[urgencyField]]||0) - (SEV[a[urgencyField]]||0));
    } else if (mode === 'age') {
      arr.sort((a,b) => new Date(a[ageField]||0) - new Date(b[ageField]||0));
    }
    return arr;
  },

  // ── HELPER: group tasks array by trade
  groupByTrade(tasks) {
    const byTrade = {};
    tasks.forEach(t => {
      if (!byTrade[t.trade]) byTrade[t.trade] = [];
      byTrade[t.trade].push(t);
    });
    return byTrade;
  },

  // ── HELPER: render trade group header + tasks
  tradeGroupHtml(trade, tasks, renderTask) {
    const col = TRADE_COLORS[trade] || '#5a5a5a';
    const done = tasks.filter(t => (APP.state.taskPct[t.id]??t.pct_complete??0) === 100).length;
    let html = `<div class="trade-group">
      <div class="trade-hdr">
        <div class="trade-dot" style="background:${col}"></div>
        <div class="trade-name">${trade}</div>
        <div class="trade-prog">${done}/${tasks.length}</div>
      </div>`;
    tasks.forEach(t => { html += renderTask(t, col); });
    html += `</div>`;
    return html;
  },

  async init() {
    // Register service worker — force update on every load to prevent stale JS
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
    );
    if ('serviceWorker' in navigator) {
      if (isLocalhost) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) reg.unregister();
        }).catch(() => {});
      } else {
        // Clear ALL caches on boot to prevent stale JS from being served
        if (window.caches) {
          caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
        }
        navigator.serviceWorker.register('/sw.js').then(reg => {
          // If a new SW is waiting, tell it to activate immediately
          if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (nw) nw.addEventListener('statechange', () => {
              if (nw.state === 'activated') location.reload();
            });
          });
          reg.update(); // Force check for new SW
        }).catch(console.error);
      }
    }

    // PWA install prompt — capture and show custom banner
    let _installPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _installPrompt = e;
      // Only show if not already installed
      if (window.matchMedia('(display-mode: standalone)').matches) return;
      const banner = document.getElementById('install-banner');
      if (banner) banner.style.display = 'flex';
    });

    // Handle install button tap
    document.addEventListener('click', async e => {
      if (e.target.id === 'install-btn' && _installPrompt) {
        _installPrompt.prompt();
        const { outcome } = await _installPrompt.userChoice;
        _installPrompt = null;
        const banner = document.getElementById('install-banner');
        if (banner) banner.style.display = 'none';
      }
      if (e.target.id === 'install-dismiss') {
        const banner = document.getElementById('install-banner');
        if (banner) banner.style.display = 'none';
      }
    });

    // Hide banner if already running as installed app
    if (window.matchMedia('(display-mode: standalone)').matches) {
      const banner = document.getElementById('install-banner');
      if (banner) banner.style.display = 'none';
    }

    // Check existing session
    const res = await API.me();
    if (res?.today) {
      APP.state.serverToday = res.today;
      APP.state.selectedDate = res.today;
    }
    if (res?.user) {
      APP.user = res.user;
      // Projects are cached on the session at login. Re-pull before first render
      // so a project created/assigned after this user logged in still appears
      // (fixes: new project not showing in the selector until logout/login).
      await APP._refreshProjects();
      APP.showApp();
      APP._bindProjectRefreshOnFocus();
    } else {
      APP.showLogin();
    }
  },

  // Re-pull the session's project list from the server and update APP.user.projects.
  // Best-effort: on any error we keep whatever we had. The /auth/refresh-projects
  // endpoint returns { projects: [...] } in the same shape as login.
  async _refreshProjects() {
    try {
      const res = await API.refreshProjects();
      if (res && Array.isArray(res.projects)) APP.user.projects = res.projects;
    } catch (_e) { /* keep existing list */ }
  },

  // Keep the project list fresh when the tab regains focus (a project may have
  // been created elsewhere while this tab was in the background). Bound once.
  _bindProjectRefreshOnFocus() {
    if (APP._projRefreshBound) return;
    APP._projRefreshBound = true;
    window.addEventListener('focus', () => { APP._refreshProjects(); });
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').classList.remove('is-visible');
  },

  showApp() {
    // Clear cached Needs You and Today's Report data to force fresh fetch on user/role swap
    APP._needsYou = null;
    APP._needsYouAt = null;
    APP._todayReport = null;
    APP._todayReportAt = null;

    // Ensure header menu is closed on load (prevents auto-open on mobile)
    const actionsEl = document.getElementById('tb-actions');
    if (actionsEl) actionsEl.classList.remove('show');

    // Force password change on first login
    if (APP.user.must_change_password) {
      APP.showForceChangePassword();
      return;
    }
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('is-visible');

    // AUDIT MODE — read-only banner, shown on every screen until logout
    const existing = document.getElementById('audit-banner');
    if (APP.user.role === 'audit') {
      if (!existing) {
        const banner = document.createElement('div');
        banner.id = 'audit-banner';
        banner.className = 'audit-banner';
        banner.textContent = 'AUDIT MODE — READ ONLY · writes are blocked · click logout when done';
        const appEl = document.getElementById('app');
        appEl.insertBefore(banner, appEl.firstChild);
      }
    } else if (existing) {
      existing.remove();
    }

    // Topbar — _updateTopbar handles who + project in one pass
    APP._updateTopbar();

    // Auto-select first project for principals and PMC (they see all projects in Health tab)
    const autoSelectRoles = ['principal','design_principal'];
    if (autoSelectRoles.includes(APP.user.role)) {
      const projects = APP.user.projects || [];
      if (projects.length > 0) APP.state.selectedProject = projects[0].id;
      APP._updateTopbar();
      APP._loadAIToggles();
      APP.buildTabs();
      return;
    }

    // Site manager with multiple projects — auto-select first project
    if (['site_manager','senior_site_manager'].includes(APP.user.role)) {
      const projects = APP.user.projects || [];
      if (projects.length === 0) {
        UI.contentEl().innerHTML = '<div class="empty"><div class="empty-icon"></div><div class="empty-text">No projects assigned yet.<br>Contact your PMC team lead.</div></div>';
        document.getElementById('tabs-bar').innerHTML = '';
        return;
      }
      // Restore last selection or default to first project
      let picked = projects[0].id;
      try {
        const saved = sessionStorage.getItem('nu_selected_project');
        if (saved) {
          const savedId = parseInt(saved, 10);
          if (projects.some(p => p.id === savedId)) picked = savedId;
        }
      } catch (_e) {}
      APP.state.selectedProject = picked;
      try { sessionStorage.setItem('nu_selected_project', String(picked)); } catch (_e) {}
      APP._updateTopbar();
      APP.buildTabs();
      return;
    }

    APP._loadAIToggles();
    APP.buildTabs();
    APP._checkNotifBadge();
    // Handle deep-link if present
    if (location.hash) setTimeout(() => APP.handleHashRoute(), 200);
  },

  async _checkNotifBadge() {
    try {
      // Debounce: don't check more than once per 20 seconds
      const now = Date.now();
      if (APP._lastNotifCheck && (now - APP._lastNotifCheck) < 20000) return;
      APP._lastNotifCheck = now;
      const data = await API.get('/notifications/log');
      const unread = (data?.notifications||[]).filter(n => !n.read_at).length;
      const dot = document.getElementById('notif-dot');
      if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
      // Schedule next check in 60s
      if (APP._notifInterval) clearTimeout(APP._notifInterval);
      APP._notifInterval = setTimeout(() => APP._checkNotifBadge(), 60000);
    } catch(_e) {}
  },

  async _loadAIToggles() {
    try {
      const toggleRes = await API.get('/ai-settings/enabled');
      APP.state.aiToggles = {};
      (toggleRes?.enabled || []).forEach(k => { APP.state.aiToggles[k] = true; });
    } catch(_e) { APP.state.aiToggles = {}; }
  },

  async buildTabs() {
    // Auto-select first project if none selected
    if (!APP.state.selectedProject) {
      const projects = APP.user.projects || [];
      if (projects.length > 0) {
        APP.state.selectedProject = projects[0].id;
        APP._updateTopbar();
      }
    }

    // Fetch nav from DB once per session. /nav/me is the sole source of
    // truth for what tabs each role sees. If it fails, we surface the error
    // rather than rendering stale hardcoded fallback tabs.
    if (!APP._nav) {
      try {
        APP._nav = await API.get('/nav/me');
      } catch (_e) { APP._nav = null; }
    }

    // AI toggles loaded via _loadAIToggles() before buildTabs is called

    if (APP._nav && APP._nav.buckets) {
      APP._renderNavFromDB();
    } else {
      APP._showNavLoadError();
      return;
    }
    APP.render(APP.currentTab);
  },

  // Couldn't load nav from the server. Two possible causes:
  //   1. /nav/me returned an error (network or 5xx) — outage, retry helps
  //   2. the role has no rows in role_nav — login should have caught this,
  //      but if a session predates the role_nav check we may land here
  // Either way, show a clear error and a retry button. Logout via topbar.
  _showNavLoadError() {
    const el = UI.contentEl();
    if (!el) return;
    el.innerHTML = `
      <div class="empty" style="padding-top:60px">
        <div class="empty-icon"></div>
        <div class="empty-text">
          Couldn't load the app for your account.<br>
          <span style="font-size:var(--text-sm);color:var(--muted)">
            Try again, or contact IT admin if this persists.
          </span><br>
          <button class="btn-primary" style="margin-top:14px;max-width:200px"
                  onclick="APP._nav=null;APP.buildTabs()">Retry</button>
        </div>
      </div>`;
  },

  // ── Nav rendered from /api/nav/me response ─────────────────────
  // Bucket order on the bottom bar is fixed: home · work · money · pending · more.
  // Empty buckets hide. Trainee/detailing (bucket='strip') get no bottom bar —
  // their tabs render as a 2-tab strip in the top tabs-bar instead.
  _renderNavFromDB() {
    const buckets = APP._nav.buckets || {};
    const BUCKET_ORDER = ['home','work','money','pending','more'];
    const BUCKET_LABELS = { home:'Home', work:'Work', money:'Money', pending:'Pending', more:'More' };

    // SVG icons — thin stroke, consistent style. Pending uses red bell.
    const BUCKET_ICONS = {
      home:    `<svg viewBox="0 0 24 24"><path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>`,
      work:    `<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>`,
      money:   `<span class="bb-icon-rupee">₹</span>`,
      pending: `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
      more:    `<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>`,
    };

    // 2-tab strip roles (trainee, detailing) — no bottom bar, just a top strip
    if (buckets.strip && buckets.strip.length) {
      document.getElementById('bottom-nav').innerHTML = '';
      APP._activeBucket = 'strip';
      APP.currentTab = buckets.strip[0].key;
      document.getElementById('tabs-bar').innerHTML = buckets.strip.map((t, i) =>
        `<button class="tab${i===0?' active':''}" data-tab="${t.key}" style="min-height:44px" onclick="APP.switchTab('${t.key}')">${TAB_LABELS[t.key]||t.key}</button>`
      ).join('');
      return;
    }

    // Regular roles — bottom bar + top tabs-bar (current bucket's tabs)
    const visibleBuckets = BUCKET_ORDER.filter(b => buckets[b] && buckets[b].length);

    if (!visibleBuckets.length) {
      // Role has no nav rows in any bucket. Login should have rejected
      // this account, but if we get here (e.g. the role had its rows
      // deleted mid-session via the nav editor), show a clear message.
      APP._showNavLoadError();
      return;
    }

    // Set initial active bucket to first visible
    if (!APP._activeBucket || !visibleBuckets.includes(APP._activeBucket)) {
      APP._activeBucket = visibleBuckets[0];
      APP.currentTab = buckets[APP._activeBucket][0].key;
    }

    // Render bottom bar with SVG icons
    document.getElementById('bottom-nav').innerHTML = visibleBuckets.map(b => {
      const isPending = b === 'pending';
      const activeClass = b === APP._activeBucket ? ' active' : '';
      const pendingClass = isPending ? ' pending' : '';
      return `<button class="bb-item${activeClass}${pendingClass}" data-bucket="${b}" style="min-height:44px" onclick="APP.switchBucket('${b}')">
         <div class="bb-icon">${BUCKET_ICONS[b]}</div>
         <div class="bb-label">${BUCKET_LABELS[b]}</div>
       </div>`;
    }).join('');

    // Render current bucket's tabs in top tabs-bar
    APP._renderBucketTabs();
  },

  // Render the current bucket's sub-tabs in the top tabs-bar
  // Buckets with >ACCORDION_THRESHOLD tabs render as accordion instead of tab strip.
  // Set high (99) so mobile always uses the scrollable chip strip — accordion
  // was hiding modules from users who didn't know to tap the bucket label.
  _renderBucketTabs() {
    const bucket = APP._nav.buckets[APP._activeBucket] || [];
    const ACCORDION_THRESHOLD = 99; // effectively disabled — use horizontal scroll instead

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const isTablet  = window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;

    if (bucket.length > ACCORDION_THRESHOLD && !isDesktop && !isTablet) {
      // Mobile only: accordion owns the content area. Write a bucket-level
      // breadcrumb to tabs-bar so the user always knows which bucket they are
      // in. Tapping the label re-renders the accordion (same as tapping the
      // bottom-bar bucket again). When the user drills into a section via
      // switchTab(), the breadcrumb is promoted to "← BucketName / SectionName".
      const bucketLabel = APP._bucketLabel(APP._activeBucket);
      document.getElementById('tabs-bar').innerHTML =
        `<button class="breadcrumb-bar" style="min-height:44px" onclick="APP.switchBucket('${APP._activeBucket}')">` +
          `<span class="bc-bucket">${bucketLabel}</span>` +
        `</button>`;
      APP._renderBucketAccordion(APP._activeBucket, bucket);
      return;
    }

    // ≤5 tabs — keep existing tab strip behaviour
    document.getElementById('tabs-bar').innerHTML = bucket.map(t =>
      `<button class="tab${t.key===APP.currentTab?' active':''}" data-tab="${t.key}" style="min-height:44px" onclick="APP.switchTab('${t.key}')">${TAB_LABELS[t.key]||t.key}</button>`
    ).join('');
    APP._renderWorkPinned();
  },

  // ── ACCORDION BUCKET RENDERER ─────────────────────────────────────────
  // Called when a bucket has >5 tabs. Replaces the tab strip + content
  // with a scrollable list of accordion items. Each item shows:
  //   - SVG icon + title + badge + caret
  //   - Expanded: up to 3 mini cards (preview) + "View all" + primary action
  //
  // "View all" navigates to the existing renderXxx function for that tab.
  // Back navigation: re-tap the same bottom-bar bucket OR browser back.
  //
  // Email / WA to client principle: no action button silently sends a
  // message. External communication buttons are explicitly labelled.
  async _renderBucketAccordion(bucketKey, tabs) {
    const el = UI.contentEl();
    const project = APP.state.selectedProject;
    const user = APP.user;

    // SVG icons per tab key — same thin-stroke style as bottom nav
    const TAB_ICONS = {
      reports:      `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      issues:       `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      labour:       `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
      grn:          `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      tasks:        `<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
      drawings:     `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
      register:     `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
      meetings:     `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      schedule:     `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="15" x2="16" y2="15"/></svg>`,
      payments:     `<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
      engagements:  `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
      vendors:      `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      vendors_master:`<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      budget:       `<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      materials:    `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
      client_boq:   `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`,
      boq_mapping:  `<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
      approvals:    `<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
      needs_you:    `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
      pending:      `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
      finance_clearance:`<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    };

    const DEFAULT_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    // Context line above bucket name
    const ctxLine = project
      ? `${user?.full_name?.split(' ')[0] || ''} · ${APP._projectName(project)}`
      : `${user?.full_name?.split(' ')[0] || ''} · All Projects`;

    let html = `
      <div class="bucket-header">
        <div class="bh-ctx">${UI.escapeText(ctxLine)}</div>
        <div class="bh-name">${UI.escapeText(APP._bucketLabel(bucketKey))}</div>
        <div class="bh-section-count">${tabs.length} sections — tap to expand</div>
      </div>
      <div id="acc-list">`;

    tabs.forEach((tab, i) => {
      const icon = TAB_ICONS[tab.key] || DEFAULT_ICON;
      const label = TAB_LABELS[tab.key] || tab.key;
      html += `
        <div class="acc-item" id="acc-${tab.key}" data-tab="${tab.key}">
          <button class="acc-hdr" style="min-height:44px" onclick="APP._accToggle('${tab.key}')">
            <div class="acc-icon">${icon}</div>
            <div class="acc-body">
              <div class="acc-title">${UI.escapeText(label)}</div>
              <div class="acc-meta" id="acc-meta-${tab.key}">Loading…</div>
            </div>
            <div class="acc-badge grey" id="acc-badge-${tab.key}">—</div>
            <div class="acc-caret">
              <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="acc-content" id="acc-content-${tab.key}">
            <div class="acc-empty">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Tap to load
            </div>
          </div>
        </div>`;
    });

    html += `</div>`;
    el.innerHTML = html;

    // Load badges async — don't block render
    APP._loadAccordionBadges(tabs, project);
  },

  // Returns human label for a bucket key
  _bucketLabel(bucketKey) {
    return { home:'Home', work:'Work', money:'Money', pending:'Pending', more:'More' }[bucketKey] || bucketKey;
  },

  // Returns project name for the current selected project
  _projectName(projectId) {
    if (!APP.user?.projects) return '';
    const p = APP.user.projects.find(x => x.id === projectId);
    return p ? (p.code || p.name || '') : '';
  },

  // Load status counts into accordion item badges
  async _loadAccordionBadges(tabs, project) {
    if (!project) return;
    try {
      const data = await API.get(`/needs-you/acc-summary/${project}`);
      if (!data?.items) return;
      data.items.forEach(item => {
        const metaEl  = document.getElementById(`acc-meta-${item.key}`);
        const badgeEl = document.getElementById(`acc-badge-${item.key}`);
        if (metaEl)  metaEl.textContent  = item.meta  || '';
        if (badgeEl) {
          badgeEl.textContent = item.badge_text || '—';
          badgeEl.className = `acc-badge ${item.badge_colour || 'grey'}`;
        }
      });
    } catch (_e) { /* badges stay as "—" — non-blocking */ }
  },

  // Toggle accordion item open/closed
  // If opening, load preview content for that tab
  _accToggle(tabKey) {
    const item = document.getElementById(`acc-${tabKey}`);
    if (!item) return;
    const wasOpen = item.classList.contains('open');

    // Collapse all items
    document.querySelectorAll('.acc-item.open').forEach(i => i.classList.remove('open'));

    if (!wasOpen) {
      item.classList.add('open');
      APP._loadAccordionPreview(tabKey);
    }
  },

  // Load 3-item preview into an expanded accordion item
  async _loadAccordionPreview(tabKey) {
    const contentEl = document.getElementById(`acc-content-${tabKey}`);
    if (!contentEl) return;
    const project = APP.state.selectedProject;

    contentEl.innerHTML = `<div class="acc-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Loading…</div>`;

    try {
      const data = project
        ? await API.get(`/needs-you/acc-preview/${tabKey}/${project}`)
        : await API.get(`/needs-you/acc-preview/${tabKey}`);

      if (!data) { contentEl.innerHTML = `<div class="acc-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>Nothing here yet</div>`; return; }

      const items = data.items || [];
      const primaryAction = data.primary_action;  // { label, tab } — tab to navigate to
      const emailAction = data.email_action;       // { label } — explicit client email button

      let html = '';
      if (!items.length) {
        html = `<div class="acc-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/></svg>Nothing pending</div>`;
      } else {
        items.slice(0,3).forEach(it => {
          html += `<div class="acc-mini">
            <div class="acc-mini-title">${UI.escapeText(it.title||'')}</div>
            <div class="acc-mini-meta">${UI.escapeText(it.meta||'')}</div>
            ${it.tag ? `<span class="acc-mini-tag ${it.tag_colour||'grey'}">${UI.escapeText(it.tag)}</span>` : ''}
          </div>`;
        });
      }

      // Actions — View all + primary action (if any)
      html += `<div class="acc-actions">
        <button class="acc-btn outline" style="min-height:44px" onclick="APP.switchTab('${tabKey}')">View all</button>
        ${primaryAction ? `<button class="acc-btn" style="min-height:44px" onclick="APP.switchTab('${primaryAction.tab||tabKey}')">${UI.escapeText(primaryAction.label)}</button>` : ''}
      </div>`;

      // Email/WA to client — ALWAYS a deliberate separate action, never inline with status buttons
      if (emailAction) {
        html += `<div style="margin-top:8px">
          <button class="acc-btn email" style="min-height:44px" onclick="APP._clientNotifyPrompt('${tabKey}')">
            <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            ${UI.escapeText(emailAction.label)}
          </div>
        </div>`;
      }

      contentEl.innerHTML = html;
    } catch (_e) {
      contentEl.innerHTML = `<div class="acc-empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>Tap "View all" to open</div>
        <div class="acc-actions"><button class="acc-btn outline" style="min-height:44px" onclick="APP.switchTab('${tabKey}')">View all</button></div>`;
    }
  },

  // Client notification prompt — shows a confirmation before sending.
  // Email/WA to client is NEVER auto-triggered by a status change.
  _clientNotifyPrompt(context) {
    UI.openModal('Notify client', `
      <p style="font-size:15px;color:var(--text2);margin-bottom:18px;line-height:1.5">
        This will send an email to the client contact on record.<br>
        Review the message before sending.
      </p>
      <div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:18px;font-size:13px;color:var(--text2);line-height:1.5">
        <b>To:</b> Client (from project contacts)<br>
        <b>Subject:</b> Update from nu associates PMC<br>
        <b>Body:</b> Status update for your project. Please log in to the nu PMC portal for details.
      </div>
      <button class="btn-primary" style="width:100%" onclick="APP._sendClientNotify('${context}');UI.closeModal()">Send email</button>
      <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="UI.closeModal()">Cancel — don't send</button>
    `);
  },

  async _sendClientNotify(context) {
    const pid = APP.state.selectedProject;
    if (!pid) { UI.toast('No project selected'); return; }
    const res = await API.post(`/projects/${pid}/notify-client`, { context });
    if (res?.ok) UI.toast('Client notified ✓');
    else UI.toast(res?.error || 'Failed to send');
  },

  // Fetch + render pinned cards at top of Work bucket.
  // Two types of pinned sections (Items 5 + 10):
  //   ⚡ Needs You    — for PMC Head, Design/Services Head, Team Lead, Jr
  //                     Arch, Services Eng, Coordinator, Senior Site
  //   📋 Today's Report — for Site Manager + Senior Site Manager
  // Both appear only on Work bucket and hide when no content.
  async _renderWorkPinned() {
    const pinEl = document.getElementById('work-pinned');
    if (!pinEl) return;
    if (APP._activeBucket !== 'work') { pinEl.innerHTML = ''; return; }

    const role = APP.user?.role;
    const isSiteManager = ['site_manager','senior_site_manager'].includes(role);

    // Fetch both in parallel with short cache
    const now = Date.now();
    if (!APP._needsYouAt || (now - APP._needsYouAt) > 30000) {
      try {
        APP._needsYou = await API.get(`/needs-you/me?_cb=${Date.now()}`);
        APP._needsYouAt = now;
      } catch (_e) { APP._needsYou = null; }
    }

    // Today's Report — only fetched for site roles and only when a project
    // is selected (endpoint is project-scoped).
    let todayCard = '';
    const siteProjects = (APP.user?.projects || []).filter(p => p.status === 'active' || !p.status);
    // Auto-pick first active project for site managers if nothing selected
    if (isSiteManager && !APP.state.selectedProject && siteProjects.length) {
      APP.state.selectedProject = siteProjects[0].id;
      APP._updateTopbar();
    }
    if (isSiteManager && APP.state.selectedProject) {
      if (!APP._todayReportAt || (now - APP._todayReportAt) > 30000) {
        try {
          APP._todayReport = await API.get(`/daily-reports/${APP.state.selectedProject}/today?_cb=${Date.now()}`);
          APP._todayReportAt = now;
        } catch (_e) { APP._todayReport = null; }
      }
      const t = APP._todayReport;
      if (t) {
        let statusBadge, buttonLabel, buttonAction;
        if (t.state === 'not_submitted') {
          statusBadge = '<span style="background:rgba(218,165,32,0.12);color:var(--amber);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;border:1px solid rgba(218,165,32,0.30)">Not submitted</span>';
          buttonLabel = 'Submit today\'s report';
          buttonAction = 'APP.showTodayReportForm()';
        } else if (t.state === 'pending_review') {
          statusBadge = '<span style="background:rgba(128,128,128,0.10);color:var(--muted);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;border:1px solid rgba(128,128,128,0.22)">Awaiting PMC review</span>';
          buttonLabel = 'Edit / resubmit';
          buttonAction = 'APP.showTodayReportForm()';
        } else if (t.state === 'approved') {
          statusBadge = '<span style="background:rgba(12,166,120,0.12);color:var(--green);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;border:1px solid rgba(12,166,120,0.30)">Approved ✓</span>';
          buttonLabel = '';
          buttonAction = '';
        } else if (t.state === 'flagged') {
          statusBadge = '<span class="badge b-red">Flagged</span>';
          buttonLabel = 'View + resubmit';
          buttonAction = 'APP.showTodayReportForm()';
        }
        const flagNote = (t.state === 'flagged' && t.flag_reason)
          ? `<div style="font-size:11px;color:var(--red);margin-top:4px">Flag: ${UI.escapeText(t.flag_reason)}</div>`
          : '';
        const projPickerHtml = siteProjects.length > 1
          ? `<div style="position:relative;width:100%;margin-bottom:8px">
              <select style="width:100%;padding:5px 30px 5px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:12px;background:var(--white);cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;color:var(--text)"
                onchange="APP.state.selectedProject=parseInt(this.value);APP._todayReportAt=0;APP._updateTopbar();APP._renderWorkPinned()">
                ${siteProjects.map(p => `<option value="${p.id}" ${String(p.id)===String(APP.state.selectedProject)?'selected':''}>${UI.escapeText(p.name)}</option>`).join('')}
              </select>
              <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--muted);font-size:11px">▼</div>
            </div>`
          : '';
        todayCard = `<div class="wp-card" style="border-left-color:var(--amber)">
          ${projPickerHtml}
          <div class="wp-label">Today's Report</div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
            <span class="wp-row-label">${UI.escapeText(t.date || '')}</span>
            ${statusBadge}
          </div>
          ${flagNote}
          ${buttonLabel ? `<button class="btn-sm navy" style="margin-top:6px;width:100%" onclick="${buttonAction}">${buttonLabel}</button>` : ''}
        </div>`;
      }
    }

    // Needs You card — merged approval queue + operational radar
    const nyData = APP._needsYou;
    let needsYouCard = '';
    if (nyData && nyData.items && nyData.items.length) {
      // Total count (approval rows only, radar items don't have a numeric count)
      const totalCount = nyData.items
        .filter(it => it.kind !== 'radar')
        .reduce((acc, it) => acc + (it.count || 0), 0);

      const chips = nyData.items.map(it => {
        const onclick = it.kind === 'radar'
          ? (it.project ? `APP._radarTap('${it.tab}',${it.project},${it.item || 'null'})` : `APP.switchTab('${it.tab}')`)
          : `APP.openPendingChip('${it.tab}','${it.type}')`;
        const badge = it.kind === 'radar' ? '⚠' : it.count;
        return `<button class="pa-chip" onclick="${onclick}">
          <span class="pa-chip-label">${UI.escapeText(it.label)}</span>
          <span class="pa-chip-count">${badge}</span>
        </button>`;
      }).join('');

      const countStr = totalCount > 99 ? '99+' : totalCount;
      needsYouCard = `<div class="pa-strip" aria-label="Pending actions">
        <div class="pa-strip-inner">
          <span class="pa-strip-title">Pending Actions <span class="pa-total-badge" aria-label="${countStr} pending actions">${countStr}</span></span>
          <div class="pa-strip-chips">${chips}</div>
        </div>
      </div>`;
    }

    pinEl.innerHTML = todayCard + needsYouCard;
  },

  switchBucket(b) {
    if (!APP._nav || !APP._nav.buckets[b] || !APP._nav.buckets[b].length) return;
    APP._activeBucket = b;
    APP.currentTab = APP._nav.buckets[b][0].key;
    // Update bottom bar active states
    document.querySelectorAll('.bb-item').forEach(el =>
      el.classList.toggle('active', el.dataset.bucket === b)
    );
    // Rebuild the tabs-bar for this bucket and render the first tab
    APP._renderBucketTabs();
    APP.render(APP.currentTab);
  },

  showProjectPicker() {
    const projects = APP.user.projects || [];
    document.getElementById('tabs-bar').innerHTML = '';
    UI.contentEl().innerHTML = `
      <div style="padding:8px 0">
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px">Select Project</div>
        ${projects.map(p => `
          <button onclick="APP.pickProject(${p.id})" style="min-height:44px;
            background:var(--white);border:1px solid var(--border);border-radius:var(--r2);
            padding:16px;margin-bottom:8px;cursor:pointer;transition:border-color .15s;"
            onmouseover="this.style.borderColor='var(--navy)'"
            onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${p.name}</div>
            <div style="font-size:11px;color:var(--muted)">${p.client}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:2px;font-family:var(--mono)">📍 ${p.location}</div>
          </button>`).join('')}
      </div>`;
  },

  pickProject(id) {
    APP.state.selectedProject = id;
    try { sessionStorage.setItem('nu_selected_project', String(id)); } catch (_e) {}
    APP._updateTopbar();
    APP.buildTabs();
  },

  async login() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    if (!u || !p) { errEl.textContent = 'Enter username and password'; return; }

    // Dev role switcher — probe the dev-login route for every login attempt.
    // In production the route returns 404 (caught below) and we fall through
    // to normal login. No credentials are hardcoded in the client.
    try {
      const devRes = await API.post('/auth/dev-login', { username: u, password: p });
      if (devRes?.dev && Array.isArray(devRes.users)) {
        APP._openDevPicker(devRes.users);
        return;
      }
    } catch (e) {
      // dev-login route not present (production) or errored — proceed with normal login
    }

    const res = await API.login(u, p);
    if (res?.success) {
      if (res.today) {
        APP.state.serverToday = res.today;
        APP.state.selectedDate = res.today;
      }
      APP.user = res.user;
      APP.showApp();
    } else {
      errEl.textContent = res?.error || 'Login failed';
    }
  },

  // Open a modal presenting the list of users returned by /api/auth/dev-login
  _openDevPicker(users) {
    const body = users.map(u =>
      `<div style="margin-bottom:8px"><button class="btn-primary" style="width:100%" onclick="APP._devSwitch(${u.id})">${UI.escapeText(u.full_name)} — ${UI.escapeText(u.username)}</button></div>`
    ).join('') + '<div style="margin-top:12px"><button class="btn-secondary" onclick="UI.closeModal()">Cancel</button></div>';
    UI.openModal('Dev role switcher — pick a user', body);
  },

  // Call /api/auth/dev-switch to assume the selected user. On success show app.
  async _devSwitch(user_id) {
    UI.closeModal();
    const res = await API.post('/auth/dev-switch', { user_id });
    if (res?.success) {
      if (res.today) {
        APP.state.serverToday = res.today;
        APP.state.selectedDate = res.today;
      }
      APP.user = res.user;
      // Clear cached nav + project state so showApp() refetches for the new role.
      // Without this, nav from the previous user bleeds through (bug C6).
      APP._nav = null;
      APP.currentTab = null;
      APP.showApp();
    } else {
      UI.toast(res?.error || 'Dev switch failed');
    }
  },

  confirmLogout() {
    return new Promise(resolve => {
      UI.openModal('Confirm Sign Out', `
        <div style="text-align: center; padding: 12px 0 20px;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--red-bg); color: var(--red); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg viewBox="0 0 24 24" style="width: 28px; height: 28px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round;">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </div>
          <div style="font-size: 15px; font-weight: 600; color: var(--navy); margin-bottom: 8px;">Sign Out of nu PMC</div>
          <div style="font-size: 13px; color: var(--text2); line-height: 1.6;">
            You will be signed out of your account and returned to the login screen.
          </div>
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn-secondary" style="flex:1" onclick="UI.closeModal();">Cancel</button>
          <button class="btn-primary" style="flex:1;background:var(--red);margin-top:0;" onclick="UI.closeModal();document.dispatchEvent(new CustomEvent('logout-confirmed'))">Sign Out</button>
        </div>
      `);
      document.addEventListener('logout-confirmed', async () => {
        await APP.logout();
        resolve(true);
      }, { once: true });
    });
  },

  async logout() {
    await API.logout();
    APP.user = null;
    APP._nav = null;
    APP._activeBucket = null;
    APP._needsYou = null;
    APP._needsYouAt = null;
    APP._todayReport = null;
    APP._todayReportAt = null;
    APP.showLogin();
  },

  // ── TODAY'S REPORT SUBMISSION (Sprint 3 Item 10) ─────────────────
  // Modal opened from the Work-bucket pinned card. Preloaded with any
  // notes from a previously-submitted-but-unapproved row.
  showTodayReportForm() {
    const t = APP._todayReport || {};
    const isFlagged = t.state === 'flagged';
    const flagBanner = isFlagged && t.flag_reason
      ? `<div style="background:rgba(200,112,96,0.12);border:1px solid rgba(200,112,96,0.35);color:#C87060;padding:10px;border-radius:6px;margin-bottom:12px;font-size:13px">
           <b>Flagged by PMC:</b> ${UI.escapeText(t.flag_reason)}
         </div>` : '';
    UI.openModal('Today\'s Report', `
      ${flagBanner}
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px;line-height:1.5">
        Notes about today — what was achieved, blockers, upcoming. Tasks, photos,
        labour, and issues you've already logged today are included automatically.
      </div>
      <textarea id="today-report-notes" rows="6" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;resize:vertical"
        placeholder="Example: Completed slab casting at grid A-C. 12 labour on site.
Delay: cement delivery slipped by 2 hrs.
Tomorrow: start formwork on next bay."
      >${t.notes ? UI.escapeText(t.notes) : ''}</textarea>
      <div class="field-row" style="margin-top:12px">
        <label class="field-label">Site Photo / Attachment (optional)</label>
        <input type="file" id="today-report-photo" accept="image/*,.pdf">
      </div>
      <button class="btn-primary" style="width:100%;margin-top:14px" onclick="APP.submitTodayReport()">Submit Today's Report</button>
    `);
  },

  async submitTodayReport() {
    const pid = APP.state.selectedProject;
    if (!pid) { UI.toast('No project selected'); return; }
    const notes = (document.getElementById('today-report-notes')?.value || '').trim();
    const photoFile = document.getElementById('today-report-photo')?.files?.[0];
    let res;
    if (photoFile) {
      const fd = new FormData();
      fd.append('notes', notes);
      fd.append('photo', photoFile);
      res = await API.call('POST', `/daily-reports/${pid}/submit`, fd, true);
    } else {
      res = await API.post(`/daily-reports/${pid}/submit`, { notes });
    }
    if (res?.ok) {
      UI.closeModal();
      UI.toast('Report submitted ✓');
      APP._todayReportAt = 0;  // invalidate cache
      APP._renderWorkPinned();
    } else {
      UI.toast(res?.error || 'Submit failed');
    }
  },

  // _radarTap — handles a tap on a radar row in Needs You.
  // Sets project context and optional item highlight, then switches tab.
  _radarTap(tab, projectId, itemId) {
    if (projectId && APP.state) {
      APP.state.selectedProject = projectId;
      if (APP._updateTopbar) APP._updateTopbar();
    }
    if (itemId && APP.state) APP.state.highlightItemId = itemId;
    APP.switchTab(tab);
  },

  // Try multiple tab keys in order — uses the first one that exists in the user's nav
  _tryNav(tabList) {
    const tabs = tabList.split(',');
    for (const tab of tabs) {
      if (APP._nav && APP._nav.buckets) {
        for (const [, items] of Object.entries(APP._nav.buckets)) {
          if (items.some(t => t.key === tab)) {
            APP.switchTab(tab);
            return;
          }
        }
      }
    }
  },

  switchTab(id) {
    APP.currentTab = id;
    // Clear portfolio mode when navigating away from its originating tab
    if (APP.state.portfolioMode && APP.state.portfolioMode !== id) {
      APP.state.portfolioMode = null;
      APP.state.portfolioPendingOnly = false;
    }
    const ca = document.getElementById('content-area'); if (ca) ca.scrollTop = 0;

    // If DB-driven nav is active, ensure the bucket containing this tab is
    // set as the active bucket. Handles deep-links and any switchTab call
    // that jumps across buckets (e.g. dashboard Action Centre → Issues).
    if (APP._nav && APP._nav.buckets) {
      let targetBucket = null;
      for (const [bucket, tabs] of Object.entries(APP._nav.buckets)) {
        if (tabs.some(t => t.key === id)) { targetBucket = bucket; break; }
      }
      // Tab not in user's nav — ignore silently except for global utilities
      if (!targetBucket) {
        if (id !== 'notifications' && id !== 'profile') {
          return;
        }
      }
      if (targetBucket && targetBucket !== APP._activeBucket) {
        APP._activeBucket = targetBucket;
        document.querySelectorAll('.bb-item').forEach(el =>
          el.classList.toggle('active', el.dataset.bucket === targetBucket)
        );
        APP._renderBucketTabs();
      }

      // Accordion breadcrumb only applies when accordion is actually active (threshold > 99 disables it)
      const ACCORDION_THRESHOLD = 99;
      const activeBucket = APP._nav.buckets[APP._activeBucket] || [];
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      const isTablet  = window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;
      if (activeBucket.length > ACCORDION_THRESHOLD && !isDesktop && !isTablet) {
        const bucketLabel  = APP._bucketLabel(APP._activeBucket);
        const sectionLabel = TAB_LABELS[id] || id;
        document.getElementById('tabs-bar').innerHTML =
          `<div class="breadcrumb-bar">` +
            `<button class="bc-back" style="min-height:44px" onclick="APP.switchBucket('${APP._activeBucket}')">` +
              `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>` +
              `${bucketLabel}` +
            `</span>` +
            `<span class="bc-sep">/</span>` +
            `<span class="bc-section">${sectionLabel}</span>` +
          `</div>`;
        APP.render(id);
        return;
      }
    }

    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === id)
    );
    APP.render(id);
  },

  switchProject() {
    // Only site managers with multiple projects can switch via picker
    const role = APP.user?.role;
    if (!['site_manager','senior_site_manager'].includes(role)) return;
    const projects = APP.user.projects || [];
    if (projects.length <= 1) return;
    APP.showProjectPicker();
  },

  render(id) {
    const el = UI.contentEl();
    UI.loading(el);
    const map = {
      dashboard:     APP.renderDashboard,
      projects:      APP.renderProjects,
      approvals:     APP.renderApprovals,
      drawings:      APP.renderDrawings,
      register:      APP.renderRegister,
      delegations:   APP.renderDelegations,
      signoff:       APP.renderWeeklySignoff,
      phototags:     APP.renderPhotoTagReview,
      schedule:      APP.renderSchedule,
      schedule_view: APP.renderScheduleView,
      photos:        APP.renderPhotos,
      // queries folded into issues in v3
      issues_site:   APP.renderQueriesSite,  // site-manager field-issues screen (implementation still named renderQueriesSite)
      materials:     APP.renderMaterials,
      materials_site:APP.renderMaterialsSite,
      monthly:       APP.renderMonthly,
      vendors:       APP.renderVendors,
      gantt:         APP.renderGantt,
      reports:        () => APP.renderWeeklyReports(),
      reports_daily:  () => APP.renderDailyReports(),
      reports_weekly: () => APP.renderWeeklyReports(),
      changes:       APP.renderChanges,
      grn:           APP.renderGRN,
      issues:        APP.renderIssues,
      meetings:      APP.renderMeetings,  // unified site visits + MOMs (Fold B)
      labour:        APP.renderLabour,
      
      tasks:         APP.renderTasks,
      budget:        APP.renderBudget,
      payments:      APP.renderPayments,
      payments_fin:  APP.renderPaymentsFin,
      pi:            APP.renderPI,
      petty_cash:    APP.renderPettyCash,
      users:         APP.renderUsers,
      clients:       APP.renderClients,
      vendors_master:    () => APP.renderVendorsMaster(),
      finance_clearance: () => APP.renderFinanceClearance(),
      client_boq:        () => APP.renderClientBOQ(),
      pending:           () => APP.renderPending(),
      flags:             () => APP.renderFlags(),
      nav_editor:        () => APP.renderNavEditor(),
      governance:        () => APP.renderGovernance(),
      boq_versions:      () => APP.renderBOQVersions(),
      deputy:            () => APP.loadProfile(),
      account_setup:     () => APP.renderAccountSetup(),
      ai_settings:       () => APP.renderAISettings(),
      errors_log:        () => APP.renderErrorsLog(),
      library:           () => APP.renderKnowledgeLibrary(),
      profile:           () => APP.loadProfile(),
      notifications:     () => APP.renderNotifications(),
      // New module tabs
      claims:            () => APP.renderClaims(),
      forms:             () => APP.renderForms(),
      labour_quick:      () => APP.renderLabourQuick(),
      schedule_quick:    () => APP.renderScheduleQuick(),
      comms:             () => APP.renderComms(),
      measurements:      () => APP.renderMeasurements(),
      handover:          () => APP.renderHandover(),
    };
    (map[id] || (() => el.innerHTML = UI.empty('','Coming soon')))();
  },

  // ── DASHBOARD
  async renderDashboard() {
    const el = UI.contentEl();
    const data = await API.getDashboard();
    if (!data) return;
    const ac = data.action_centre;
    // Stash items for triage modal to read without another API call
    APP._dashAC = ac;

    // Morning Brief — fetch overnight activity summary
    let briefHtml = '';
    try {
      const brief = await API.get('/dashboard/morning-brief');
      if (brief) {
        const items = brief.items || [];
        const total = brief.total_activity || 0;

        // Build metric boxes from the raw counts
        const metrics = [];
        if (brief.drawings > 0)    metrics.push({ val: brief.drawings, lbl: 'Drawings' });
        if (brief.payments > 0)    metrics.push({ val: brief.payments, lbl: 'Payments' });
        if (brief.flags > 0)       metrics.push({ val: brief.flags, lbl: 'Flags' });
        if (brief.issues > 0)      metrics.push({ val: brief.issues, lbl: 'Issues' });
        if (brief.reports > 0)     metrics.push({ val: brief.reports, lbl: 'Reports' });
        if (brief.task_updates > 0) metrics.push({ val: brief.task_updates, lbl: 'Updates' });

        // Narrative line
        const narrative = total === 0
          ? 'No activity since yesterday evening. All quiet across projects.'
          : brief.summary;

        // Status indicator
        const statusColor = brief.flags > 0 ? 'var(--amber)' : 'var(--green)';
        const statusLabel = brief.flags > 0 ? 'Needs attention' : 'All healthy';

        briefHtml = `<div class="morning-brief" style="margin-bottom:20px;background:var(--navy);border-radius:var(--r2);padding:20px 18px;color:var(--white)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55)">Morning Brief</div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:8px;height:8px;border-radius:50%;background:${statusColor}"></div>
              <span style="font-size:11px;color:rgba(255,255,255,.7)">${statusLabel}</span>
            </div>
          </div>
          ${metrics.length ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(metrics.length, 4)},1fr);gap:8px;margin-bottom:14px">
            ${metrics.slice(0, 4).map(m => `<div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:var(--r);padding:12px 8px;text-align:center">
              <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--white);line-height:1">${m.val}</div>
              <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:4px;letter-spacing:.04em">${m.lbl}</div>
            </div>`).join('')}
          </div>` : ''}
          <div style="font-size:13px;color:rgba(255,255,255,.85);line-height:1.5">${narrative}</div>
        </div>`;
      }
    } catch (_e) {}

    let html = briefHtml + `<div class="sec-label">Action Centre</div>`;

    const addItem = (icon, title, meta, c, b, badge, fn) =>
      `<div class="action-item c-${c}" style="min-height:44px;cursor:pointer;width:100%" onclick="${fn}">
        <div class="ai-icon">${icon}</div>
        <div class="ai-body"><div class="ai-title">${title}</div><div class="ai-meta">${meta}</div></div>
        <span class="badge b-${b}">${badge}</span>
      </div>`;

    // Helper: check if user has a specific tab in their nav
    const hasTab = (tab) => {
      if (!APP._nav?.buckets) return true; // no nav loaded yet, show all
      return Object.values(APP._nav.buckets).some(tabs => tabs.some(t => t.key === tab));
    };

    // Only show action items if user has the relevant tab to act on them
    if (ac.overdue_queries.length && hasTab('issues'))
      html += addItem('','Drawing queries — overdue',`${ac.overdue_queries.length} unanswered 3+ days`,'red','red','OVERDUE',"APP.showActionTriage('overdue_queries')");
    if (ac.open_flags.length && hasTab('flags'))
      html += addItem('','Site flags open',`${ac.open_flags.length} unresolved flags`,'red','red','OPEN',"APP.showActionTriage('open_flags')");
    if (ac.overdue_materials.length && hasTab('materials'))
      html += addItem('','Materials overdue',`${ac.overdue_materials.length} past needed-by date`,'red','red','OVERDUE',"APP.showActionTriage('overdue_materials')");
    if (ac.pending_approvals.length && hasTab('pending'))
      html += addItem('','Approvals pending',`${ac.pending_approvals.length} awaiting Principal / Design Principal`,'amber','amber','PENDING',"APP.showActionTriage('pending_approvals')");
    if (ac.fresh_queries.length && hasTab('issues'))
      html += addItem('','Drawing queries — open',`${ac.fresh_queries.length} within 3 days`,'amber','amber','OPEN',"APP.showActionTriage('fresh_queries')");
    if (ac.pending_changes.length && hasTab('changes'))
      html += addItem('','Change notices — signatures pending',`${ac.pending_changes.length} need sign-off`,'blue','blue','ACTION',"APP.showActionTriage('pending_changes')");

    if (!Object.values(ac).some(a => a.length))
      html += `<div class="action-item c-green" style="width:100%"><div class="ai-icon"></div><div class="ai-body"><div class="ai-title">All clear</div><div class="ai-meta">No urgent actions</div></div></div>`;

    const projects = data.projects || [];
    if (!projects.length) {
      html += `<div class="sec-label">Projects</div>`;
      html += UI.empty('','No projects yet');
    } else {
      const active = [];
      const completed = [];

      projects.forEach(p => {
        if (['completed', 'on_hold'].includes(p.status)) {
          completed.push(p);
        } else if (p.status === 'initialising') {
          // Skip initialising projects on the dashboard
        } else {
          active.push(p);
        }
      });

      if (active.length) {
        html += `<div class="sec-label" style="margin-top:16px; margin-bottom:8px">Active Projects (${active.length})</div>`;
        html += `<div class="projects-grid">`;
        active.forEach(p => { html += APP.projectCard(p, true); });
        html += `</div>`;
      }
      if (completed.length) {
        html += `<div class="sec-label" style="margin-top:24px; margin-bottom:8px">Completed & Archived Projects (${completed.length})</div>`;
        html += `<div class="projects-grid">`;
        completed.forEach(p => { html += APP.projectCard(p, true); });
        html += `</div>`;
      }
    }

    el.innerHTML = html;
  },

  // ── PROJECTS
  async renderProjects() {
    const el = UI.contentEl();
    const data = await API.getProjects();
    if (!data) return;
    const isPrincipal = ['principal','design_principal'].includes(APP.user.role);

    let html = `<div class="projects-page">`;
    html += `<div class="projects-head">
      <div class="sec-label">Projects</div>
      ${isPrincipal ? `<button class="btn-primary projects-new-btn" onclick="APP.showCreateProject()">+ New Project</button>` : ''}
    </div>`;

    const projects = data.projects || [];
    if (!projects.length) {
      html += UI.empty('','No projects yet');
    } else {
      const initialising = [];
      const active = [];
      const completed = [];

      projects.forEach(p => {
        if (['completed', 'on_hold'].includes(p.status)) {
          completed.push(p);
        } else if (p.status === 'initialising') {
          initialising.push(p);
        } else {
          active.push(p);
        }
      });

      if (active.length) {
        html += `<div class="sec-label" style="margin-top:16px; margin-bottom:8px">Active Projects (${active.length})</div>`;
        html += `<div class="projects-grid">`;
        active.forEach(p => { html += APP.projectCard(p, false); });
        html += `</div>`;
      }
      if (initialising.length) {
        html += `<div class="sec-label" style="margin-top:24px; margin-bottom:8px">Initialising Projects (${initialising.length})</div>`;
        html += `<div class="projects-grid">`;
        initialising.forEach(p => { html += APP.projectCard(p, false); });
        html += `</div>`;
      }
      if (completed.length) {
        html += `<div class="sec-label" style="margin-top:24px; margin-bottom:8px">Completed & Archived Projects (${completed.length})</div>`;
        html += `<div class="projects-grid">`;
        completed.forEach(p => { html += APP.projectCard(p, false); });
        html += `</div>`;
      }
    }
    html += `</div>`;
    el.innerHTML = html;
  },

  projectCard(p, compact) {
    const trades = Object.entries(p.trades || {});
    const statusHtml = UI.statusBadge(p.status);
    const checklist  = p.checklist_project_created && p.checklist_design_register &&
                       p.checklist_services_register && p.checklist_design_boq &&
                       p.checklist_services_boq && p.checklist_schedule && p.checklist_site_manager;

    let html = `<div class="proj-card fade-in" style="min-height:44px; text-align:center; width:100%; cursor:pointer" onclick="APP.selectProject('${p.id}')">
      <div class="pc-top" style="flex-direction:column; align-items:center; text-align:center; gap:8px">
        <div style="width:100%">
          <div class="pc-name" style="text-align:center">${p.name}</div>
          <div class="pc-client" style="text-align:center">${p.client || p.client_name || '—'}</div>
          <div class="pc-loc" style="text-align:center">📍 ${p.location || '—'}</div>
        </div>
        <div>${statusHtml}</div>
      </div>`;

    if (p.status === 'initialising' && !checklist) {
      const steps = [
        ['Project created',                  p.checklist_project_created],
        ['Design drawing register',          p.checklist_design_register],
        ['Services drawing register',        p.checklist_services_register],
        ['Design BOQ uploaded',              p.checklist_design_boq],
        ['Services BOQ uploaded',            p.checklist_services_boq],
        ['Schedule uploaded',                p.checklist_schedule],
        ['Roles assigned',                   p.checklist_site_manager],
      ];
      const done = steps.filter(s => s[1]).length;
      html += `<div style="padding:0 16px 16px; width:100%; text-align:center">
        <div style="font-size:10px;color:#60a8c8;font-family:var(--mono);margin-bottom:8px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">INITIALISING — ${done}/7 complete</div>
        <div style="display:flex; flex-direction:column; gap:6px; text-align:center">
          ${steps.map(([l, v]) => `
            <div class="check-item${v ? ' done' : ''}" style="justify-content:center">
              <div class="ci-icon">${v ? '✓' : '○'}</div>
              <div class="ci-label" style="flex:none">${l}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
    } else {
      const stats = p.stats || {};
      const navTo = (tab) => `onclick="event.stopPropagation();APP.state.selectedProject=${p.id};${tab === 'issues' ? 'APP.state.issuesViewMode=\'all\';APP.state.selectedProjectFilter=' + p.id + ';' : ''}APP._tryNav('${tab}')"`;
      const navToFlags = `onclick="event.stopPropagation();APP.state.selectedProject=${p.id};APP.state.flagFilterProject=${p.id};APP._tryNav('flags')"`;
      html += `<div class="pc-stats">
        <div class="pc-stat" style="cursor:pointer" ${navTo('tasks,schedule')}><span class="pc-stat-val">${p.avg_pct||0}%</span><span class="pc-stat-lbl">Progress</span></div>
        <div class="pc-stat" style="cursor:pointer" ${navTo('issues')}><span class="pc-stat-val${stats.open_queries>0?' amber':''}">${stats.open_queries||0}</span><span class="pc-stat-lbl">Queries</span></div>
        <div class="pc-stat" style="cursor:pointer" ${navToFlags}><span class="pc-stat-val${stats.flagged_tasks>0?' red':''}">${stats.flagged_tasks||0}</span><span class="pc-stat-lbl">Flags</span></div>
        <div class="pc-stat"><span class="pc-stat-val${stats.overdue_materials>0?' red':''}">${stats.overdue_materials||0}</span><span class="pc-stat-lbl">Overdue</span></div>
      </div>`;

      if (!compact && trades.length) {
        html += `<div class="pc-progress" style="padding:12px 16px; border-top:1px solid var(--border)">`;
        trades.forEach(([trade, pct]) => {
          const col = TRADE_COLORS[trade] || '#5a5a5a';
          const pctDisplay = parseFloat(pct).toFixed(2).replace(/\.?0+$/, '') || '0';
          const tradeLabel = trade.split(' ')[0];
          const tradeFmt = tradeLabel.charAt(0).toUpperCase() + tradeLabel.slice(1).toLowerCase();
          html += `<div class="prog-row">
            <div class="prog-label">${tradeFmt}</div>
            <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${col}"></div></div>
            <div class="prog-pct">${pctDisplay}%</div>
          </div>`;
        });
        html += `</div>`;
      }
    }
    html += `</div>`;
    return html;
  },

  selectProject(id) {
    APP.state.selectedProject = id;
    if (APP._updateTopbar) APP._updateTopbar();
    UI.toast('Project selected');
  },

  async showCreateProject() {
    // Pre-fetch clients list to populate dropdown — fall back to text input if unauthorised
    let clientOptionsHtml = '';
    try {
      const res = await API.call('GET', '/clients');
      const clients = (res && res.clients) ? res.clients : [];
      if (clients.length) {
        clientOptionsHtml = clients.map(c =>
          `<option value="${UI.escapeAttr(c.client_name||'')}">`
        ).join('');
      }
    } catch (_) { /* use free text */ }

    UI.openModal('New Project', `
      <div class="field-row"><label class="field-label" for="np-code">Project Code</label><input type="text" id="np-code" placeholder="e.g. PV90"></div>
      <div class="field-row"><label class="field-label" for="np-name">Project Name</label><input type="text" id="np-name" placeholder="Full project name"></div>
      <div class="field-row"><label class="field-label" for="np-client">Client</label>
        <input type="text" id="np-client" list="np-client-list" placeholder="Type to match existing, or enter new">
        <datalist id="np-client-list">${clientOptionsHtml}</datalist>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">
          New client name → stub created, finance completes master before first PI.
        </div>
      </div>
      <div class="field-row"><label class="field-label" for="np-location">Location</label><input type="text" id="np-location"></div>
      <div class="field-row"><label class="field-label" for="np-type">Type</label>
        <select id="np-type"><option value="industrial">Industrial</option><option value="institutional">Institutional</option>
        <option value="residential">Residential</option><option value="commercial">Commercial</option>
        <option value="interior">Interior</option><option value="infrastructure">Infrastructure</option></select>
      </div>
      <div class="field-row"><label class="field-label" for="np-start">R0 Start Date</label><input type="date" id="np-start"></div>
      <div class="field-row"><label class="field-label" for="np-end">R0 End Date (locked forever)</label><input type="date" id="np-end"></div>
      <button class="btn-primary" onclick="APP.createProject()">Create Project</button>
    `);
  },

  async createProject() {
    const data = {
      code: document.getElementById('np-code').value.trim().toUpperCase(),
      name: document.getElementById('np-name').value.trim(),
      client: document.getElementById('np-client').value.trim(),
      location: document.getElementById('np-location').value.trim(),
      project_type: document.getElementById('np-type').value,
      r0_start_date: document.getElementById('np-start').value,
      r0_end_date: document.getElementById('np-end').value,
    };
    if (!data.code || !data.name || !data.client || !data.r0_start_date || !data.r0_end_date) {
      UI.toast('Fill all required fields'); return;
    }
    const res = await API.createProject(data);
    if (res?.success) {
      UI.closeModal();
      if (res.client_stub_created) {
        UI.toast('Project created ⚠ — finance must complete client master before first PI');
      } else {
        UI.toast('Project created ✓');
      }
      // Pull the new project into this session's cached list so it appears in
      // the selector immediately (no logout/login needed).
      await APP._refreshProjects();
      APP.renderProjects();
    } else {
      UI.toast(res?.error || 'Failed to create project');
    }
  },

  // ── SCHEDULE (site manager)
  async renderSchedule() {
    const el = UI.contentEl();
    const today = APP.state.serverToday || UI.todayIST();
    const date  = APP.state.selectedDate;
    const sub   = APP.state.scheduleView;
    const pid   = APP._ensurePid();

    if (!pid) { el.innerHTML = UI.empty('','No project assigned yet'); return; }
    if (APP._guardInitialisingProject(el, pid)) return;

    const subTabs = `<div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;">
      <button style="min-height:44px;flex:1;text-align:center;padding:10px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--mono);background:${sub==='today'?'var(--navy)':'var(--white)'};color:${sub==='today'?'var(--white)':'var(--muted)'}" onclick="APP.state.scheduleView='today';APP.renderSchedule()">TODAY</button>
      <button style="min-height:44px;flex:1;text-align:center;padding:10px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--mono);background:${sub==='ahead'?'var(--navy)':'var(--white)'};color:${sub==='ahead'?'var(--white)':'var(--muted)'}" onclick="APP.state.scheduleView='ahead';APP.renderSchedule()">LOOK AHEAD</button>
    </div>`;

    if (sub === 'ahead') {
      await APP.renderLookaheadWorkspace(pid, subTabs, el);
      return;
    }

    // Load dates with notes — aggregate across all visible projects so the
    // date-strip dots light up whenever any project has a note on that date.
    const allPidsForNotes = APP._visibleProjects().map(p => p.id);
    const datesWithNotes = new Set();
    try {
      const noteResults = await Promise.all(
        allPidsForNotes.map(p => API.call('GET', `/daily-reports/${p}`).catch(() => null))
      );
      noteResults.forEach(listRes => {
        (listRes?.reports || []).forEach(r => {
          if (r.overall_notes && r.overall_notes.trim()) {
            let dStr = r.report_date;
            if (dStr) {
              datesWithNotes.add(typeof dStr === 'string' ? dStr.slice(0, 10) : dStr.toISOString().slice(0, 10));
            }
          }
        });
      });
    } catch (e) {
      console.warn('Failed to load daily reports list:', e);
    }

    // Pre-fetch site notes for today's date
    APP.state._scheduleNotesPrefill = '';
    const isSiteRoleForNotes = ['site_manager','senior_site_manager'].includes(APP.user?.role);
    // Use allPidsForNotes.length (not multiProject which is defined later) to avoid TDZ error
    const notesFetchPid = (isSiteRoleForNotes && allPidsForNotes.length > 1)
      ? (APP.state._notesProjectId || allPidsForNotes[0])
      : (allPidsForNotes.length === 1 ? pid : null);
    if (notesFetchPid) {
      APP.state._notesProjectId = notesFetchPid;
      try {
        const dr = await API.call('GET', `/daily-reports/${notesFetchPid}/today?date=${date}`);
        APP.state._scheduleNotesPrefill = dr?.notes || '';
      } catch (e) { /* ignore */ }
    }

    // Date strip (past 3 days, today, future 3 days)
    let strip = '<div class="date-strip">';
    for (let i = -3; i <= 3; i++) {
      const d = UI.addDays(today, i);
      const sel = d === date;
      
      let stateClass = '';
      if (i < 0) {
        stateClass = 'past';
      } else if (i === 0) {
        stateClass = 'today';
      } else {
        stateClass = 'future';
      }
      
      const hasNotes = datesWithNotes.has(d);
      
      strip += `<button class="date-chip ${stateClass}${sel ? ' sel' : ''}" onclick="APP.state.selectedDate='${d}';APP.renderSchedule()">
        <div class="dc-day">${i === 0 ? 'Today' : UI.fmtDay(d)}</div>
        <div class="dc-num">${new Date(d + 'T00:00:00').getDate()}</div>
        <div class="dc-dot${hasNotes ? ' has-notes' : ''}"></div>
      </button>`;
    }
    strip += '</div>';

    const projects = APP._visibleProjects();
    const multiProject = projects.length > 1;

    // Fetch today's tasks — all projects in parallel when user has multiple projects,
    // single fetch otherwise.
    let projectResults; // [{project, tasks}]
    if (multiProject) {
      const fetches = await Promise.all(
        projects.map(p => API.getSchedule(p.id, date).catch(() => null))
      );
      projectResults = projects.map((p, i) => ({ project: p, tasks: fetches[i]?.tasks || [] }));
    } else {
      const data = await API.getSchedule(pid, date);
      projectResults = [{ project: projects[0] || { id: pid, name: '' }, tasks: data?.tasks || [] }];
    }

    // Aggregate totals for header label
    const allTasks = projectResults.flatMap(r => r.tasks);

    // Build final HTML — no project selector in TODAY (we show all projects together)
    let finalHtml = subTabs + strip;

    // Flagged tasks — principals/PMC see these at the top
    const isPrincipalView = ['principal','design_principal','pmc_head'].includes(APP.user?.role || APP.user?.real_role);
    if (isPrincipalView) {
      // Check for pending schedule versions that need PMC acknowledgement
      if (APP.user?.role === 'pmc_head') {
        const versionsData = await API.get(`/schedule/${pid}/versions`).catch(() => null);
        const pendingVer = (versionsData?.versions || []).find(v => v.status === 'pending_approval' && v.drift_days > 0 && !v.drift_acknowledged);
        if (pendingVer) {
          finalHtml += `<div class="card" style="background:#FFF8E1;border-left:3px solid var(--amber);margin-bottom:12px;padding:12px">
            <div style="font-weight:600;color:var(--amber);margin-bottom:6px">⚠ Schedule drift requires your acknowledgement</div>
            <div class="card-meta" style="margin-bottom:8px">+${pendingVer.drift_days} days drift from R0 — document mitigation steps before Principal reviews</div>
            <textarea id="drift-mit-note" rows="2" placeholder="Mitigation steps / explanation…" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-size:13px"></textarea>
            <button class="btn-sm approve" onclick="APP.acknowledgeDrift(${pid}, ${pendingVer.id}, ${pendingVer.row_version||0})" style="width:100%">Acknowledge Drift & Notify Principal</button>
          </div>`;
        }
      }
      // Fetch flags for each project and merge
      const flagResults = await Promise.all(
        projects.map(p => API.get(`/schedule/${p.id}/flags`).catch(() => null))
      );
      const allFlags = flagResults.flatMap((r, i) => (r?.flags || []).map(f => ({ ...f, _projectName: projects[i].name, _pid: projects[i].id })));
      if (allFlags.length) {
        finalHtml += `<div class="sec-label" style="color:var(--red)">Flagged Tasks (${allFlags.length})</div>`;
        allFlags.forEach(t => {
          const projLabel = multiProject ? `<span style="font-size:10px;color:var(--muted);font-family:var(--mono)"> · ${UI.escapeText(t._projectName)}</span>` : '';
          finalHtml += `<div class="action-item c-red" style="margin-bottom:6px">
            <div class="ai-body">
              <div class="ai-title">${UI.escapeText(t.task_name)} (${t.trade || '—'})${projLabel}</div>
              <div class="ai-meta">${t.flag_note || 'Auto-flagged: behind plan'} · ${t.pct_complete || 0}% · ${t.flagged_by_name || ''}</div>
            </div>
            <button class="btn-sm" onclick="APP.resolveFlag(${t._pid},${t.update_id})">Resolve</button>
          </div>`;
        });
      }
    }

    if (!allTasks.length) {
      finalHtml += UI.empty('','No tasks scheduled today');
    } else {
      const totalDone = allTasks.filter(t => (APP.state.taskPct[t.id] ?? t.pct_complete ?? 0) === 100).length;
      finalHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Tasks — ${date===today?'Today':UI.fmtDate(date)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${totalDone}/${allTasks.length} done</span>
      </div>`;

      projectResults.forEach(({ project: proj, tasks }) => {
        if (!tasks.length) return;
        if (multiProject) {
          finalHtml += `<div style="font-family:var(--mono);font-size:9px;font-weight:700;color:var(--navy);letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border)">${UI.escapeText(proj.name)}</div>`;
        }
        const byTrade = APP.groupByTrade(tasks);
        Object.entries(byTrade).forEach(([trade, tlist]) => {
          const col = TRADE_COLORS[trade] || '#5a5a5a';
          const tdone = tlist.filter(t => (APP.state.taskPct[t.id] ?? t.pct_complete ?? 0) === 100).length;
          finalHtml += `<div class="trade-group"><div class="trade-hdr">
            <div class="trade-dot" style="background:${col}"></div>
            <div class="trade-name">${trade}</div>
            <div class="trade-prog">${tdone}/${tlist.length}</div>
          </div>`;
          tlist.forEach(t => {
            const pct2 = APP.state.taskPct[t.id] ?? t.pct_complete ?? 0;
            const isDone2 = pct2 === 100;
            // Due date chip — only show if task started before today (in-progress)
            const todayForDue = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const isInProgress = t.start_date && t.start_date < todayForDue && t.end_date && t.end_date >= todayForDue;
            const daysLeft = isInProgress ? Math.ceil((new Date(t.end_date + 'T00:00:00') - new Date(todayForDue + 'T00:00:00')) / 86400000) : null;
            const dueSoon = daysLeft !== null && daysLeft <= 3;
            const dueChip = isInProgress
              ? `<span style="font-size:10px;font-family:var(--mono);color:${dueSoon?'var(--amber)':'var(--muted)'};background:${dueSoon?'rgba(218,165,32,0.10)':'rgba(128,128,128,0.08)'};border:1px solid ${dueSoon?'rgba(218,165,32,0.25)':'rgba(128,128,128,0.15)'};padding:1px 7px;border-radius:4px;white-space:nowrap">Due ${UI.fmtDate(t.end_date)}${daysLeft===0?' · today':daysLeft===1?' · tomorrow':daysLeft<=3?` · ${daysLeft}d left`:''}</span>`
              : '';
            finalHtml += `<div class="task-item${isDone2?' task-done':pct2>0?' task-progress':''}">
              <div class="task-dot"></div>
              <div style="flex:1">
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
                  <div class="task-name" style="flex:1;min-width:0">${UI.escapeText(t.task_name)}</div>
                  ${dueChip}
                </div>
                <div class="pct-wrap">
                  <input type="range" class="pct-slider" min="0" max="100" step="5" value="${pct2}"
                    oninput="APP.liveUpdatePct(${t.id},${proj.id},'${date}',this)">
                  <div class="pct-val" id="pv-${t.id}">${pct2}%</div>
                </div>
                <div class="task-actions">
                  <button class="btn-sm${t.is_flagged?' flagged':''}" onclick="APP.toggleFlag(${t.id},${proj.id},'${date}',${t.update_id||'null'})">${t.is_flagged?'Flagged':'Flag'}</button>
                </div>
              </div>
            </div>`;
          });
          finalHtml += `</div>`;
        });
      });
    }

    // Site notes — always show for site roles (they enter notes per project).
    // For non-site roles in multi-project mode, hide (notes are project-specific).
    const isSiteRole = ['site_manager','senior_site_manager'].includes(APP.user?.role);
    if (!multiProject || isSiteRole) {
      const isPast = date < today;
      if (multiProject && isSiteRole) {
        // Multi-project: show project picker so it's clear which project the notes belong to
        const notesPid = APP.state._notesProjectId || pid;
        const projectOpts = APP._visibleProjects().map(p =>
          `<option value="${p.id}"${p.id === notesPid ? ' selected' : ''}>${UI.escapeText(p.name)}</option>`
        ).join('');
        finalHtml += `<div style="margin-top:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <label class="field-label" style="margin-bottom:0;white-space:nowrap">Site Notes for</label>
            <div style="position:relative;flex:1;min-width:0">
              <select id="schedule-notes-project" onchange="APP.switchNotesProject(parseInt(this.value))" style="width:100%;font-size:13px;padding:4px 28px 4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);-webkit-appearance:none;-moz-appearance:none;appearance:none;cursor:pointer">
                ${projectOpts}
              </select>
              <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--muted);font-size:11px">▼</div>
            </div>
          </div>
          <textarea id="schedule-site-notes" rows="3" placeholder="Work done, observations, blockers…"${isPast ? ' disabled' : ''}>${UI.escapeText(APP.state._scheduleNotesPrefill || '')}</textarea>
          ${!isPast
            ? `<button class="btn-primary" style="margin-top:6px" onclick="APP.saveScheduleNotes(APP.state._notesProjectId)">Save Notes</button>`
            : `<div class="field-help" style="color:var(--muted);font-size:12px;margin-top:4px">Notes cannot be edited for past dates.</div>`}
        </div>`;
      } else {
        finalHtml += `<div style="margin-top:16px">
          <div class="field-row"><label class="field-label" for="schedule-site-notes">Site Notes</label>
            <textarea id="schedule-site-notes" rows="3" placeholder="Work done, observations, blockers…"${isPast ? ' disabled' : ''}>${UI.escapeText(APP.state._scheduleNotesPrefill || '')}</textarea>
          </div>
          ${!isPast
            ? `<button class="btn-primary" onclick="APP.saveScheduleNotes(${pid})">Save Notes</button>`
            : `<div class="field-help" style="color:var(--muted);font-size:12px">Notes cannot be edited for past dates.</div>`}
        </div>`;
      }
    }

    // Past notes history — site roles only
    if (['site_manager','senior_site_manager'].includes(APP.user?.role)) {
      finalHtml += `<div style="margin-top:20px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <span>Past Notes</span>
          <button onclick="APP.togglePastNotes(${pid})" style="background:none;border:none;color:var(--navy);font-size:11px;cursor:pointer;text-decoration:underline" id="past-notes-toggle">Show</button>
        </div>
        <div id="past-notes-panel" style="display:none"></div>
      </div>`;
    }

    el.innerHTML = finalHtml;
  },

  async saveScheduleNotes(pid) {
    const ta = document.getElementById('schedule-site-notes');
    if (!ta) { UI.toast('Notes field not found'); return; }
    const notes = (ta.value || '').trim();
    if (notes.length > 5000) {
      UI.toast('Notes must be under 5000 characters');
      return;
    }
    const date = APP.state.selectedDate;
    const res = await API.call('POST', `/daily-reports/${pid}/submit`, { notes, date });
    if (res?.ok) {
      APP.state._scheduleNotesPrefill = notes;
      UI.toast('Notes saved ✓');
      APP.renderSchedule();
    } else {
      UI.toast(res?.error || 'Could not save notes');
    }
  },

  // Switch which project's notes are shown in the multi-project site notes selector
  async switchNotesProject(pid) {
    APP.state._notesProjectId = pid;
    const date = APP.state.selectedDate;
    try {
      const dr = await API.call('GET', `/daily-reports/${pid}/today?date=${date}`);
      const ta = document.getElementById('schedule-site-notes');
      if (ta) ta.value = dr?.notes || '';
      APP.state._scheduleNotesPrefill = dr?.notes || '';
    } catch (e) {
      /* leave textarea as-is if fetch fails */
    }
  },

  // ── Pending Actions chip tap ──────────────────────────────────────────────
  // For tabs that support cross-project portfolio view (drawings, submittals),
  // set portfolioMode so renderDrawings/renderSubmittals show pending items
  // across all projects instead of the last-selected single project.
  openPendingChip(tab, type) {
    const portfolioTabs = ['drawings', 'submittals'];
    if (portfolioTabs.includes(tab) && APP._visibleProjects().length > 1) {
      APP.state.portfolioMode = tab;   // e.g. 'drawings'
      APP.state.portfolioPendingOnly = true;
    } else {
      APP.state.portfolioMode = null;
      APP.state.portfolioPendingOnly = false;
    }
    APP.switchTab(tab);
  },

  liveUpdatePct(taskId, pid, date, input) {
    const val = parseInt(input.value);
    APP.state.taskPct[taskId] = val;
    const pvEl = document.getElementById(`pv-${taskId}`);
    if (pvEl) pvEl.textContent = val + '%';
    clearTimeout(APP._pctTimer);
    APP._pctTimer = setTimeout(() => {
      API.updateTask(pid, { task_id: taskId, pct_complete: val, report_date: date });
    }, 800);
  },

  async toggleFlag(taskId, pid, date, updateId) {
    await API.updateTask(pid, { task_id: taskId, pct_complete: APP.state.taskPct[taskId]||0, is_flagged: true });
    UI.toast('Flagged ✓');
    APP.renderSchedule();
  },

  async resolveFlag(pid, updateId) {
    const note = await UI.prompt('Resolution note (what action was taken?)');
    if (note === null) return; // cancelled
    const res = await API.call('POST', `/schedule/${pid}/flags/${updateId}/resolve`, { resolution_note: note || '' });
    if (res?.success) {
      UI.toast('Flag resolved');
      // Re-render whichever view is active
      if (APP.currentTab === 'flags') APP.renderFlags();
      else APP.renderSchedule();
    } else {
      UI.toast(res?.error || 'Failed to resolve');
    }
  },

  buildAhead(data) {
    const tasks = data?.tasks || [];
    const days  = data?.days  || 7;
    if (!tasks.length) return UI.empty('', `No tasks in next ${days} days`);

    // ── Plan banner: AI plan if present, otherwise deterministic fallback summary
    const byTrade = APP.groupByTrade(tasks);
    let planHtml;
    if (data.plan) {
      // AI plan — render as paragraphs
      const safeText = data.plan.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      planHtml = `<div style="background:#f4f7fa;border:1px solid #d4dce5;border-left:3px solid var(--navy);border-radius:var(--r);padding:12px;margin-bottom:14px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--navy);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">✨ AI Plan — Next ${days} Days</div>
        <div style="font-size:12px;line-height:1.55;white-space:pre-wrap;color:var(--text)">${safeText}</div>
      </div>`;
    } else {
      // Fallback: deterministic summary by trade
      const tradeBullets = Object.entries(byTrade).map(([trade, list]) =>
        `<li style="margin-bottom:4px"><b>${trade}</b>: ${list.length} task${list.length>1?'s':''} — ${list.slice(0,3).map(t=>t.task_name).join(', ')}${list.length>3?'…':''}</li>`
      ).join('');
      planHtml = `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:14px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Summary — Next ${days} Days</div>
        <ul style="font-size:12px;line-height:1.5;color:var(--text);margin:0;padding-left:18px">${tradeBullets}</ul>
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:8px">Use the planning notes below for material call-up, manpower, and site readiness.</div>
      </div>`;
    }

    let html = planHtml + `<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px">Tasks — Add Planning Notes</div>`;
    Object.entries(byTrade).forEach(([trade, tlist]) => {
      const col = TRADE_COLORS[trade] || '#5a5a5a';
      html += `<div class="trade-group"><div class="trade-hdr">
        <div class="trade-dot" style="background:${col}"></div>
        <div class="trade-name">${trade}</div>
      </div>`;
      tlist.forEach(t => {
        html += `<div style="padding:10px 12px;background:var(--white);border:1px solid var(--border);border-top:none">
          <div class="task-name">${t.task_name}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:3px">${UI.fmtDate(t.start_date)} → ${UI.fmtDate(t.end_date)}</div>
          <textarea
            data-task-id="${t.id}"
            data-pid="${pid}"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--sans);font-size:11px;padding:6px 10px;margin-top:7px;outline:none;resize:none"
            rows="2"
            placeholder="Planning note — material, vendor, access…"
            onblur="APP.savePlanningNote(this)"
          >${UI.escapeText(t.planning_note || '')}</textarea>
        </div>`;
      });
      html += `</div>`;
    });
    return html;
  },

  async renderLookaheadWorkspace(pid, subTabs, el) {
    el.innerHTML = subTabs + `<div style="text-align:center;padding:40px;color:var(--muted)"><span class="spinner"></span> Loading Planning Workspace...</div>`;
    
    try {
      const data = await API.getLookaheadWorkspace(pid);
      const tasks = data?.tasks || [];
      const assignees = data?.assignees || [];
      const metrics = data?.metrics || { upcoming: 0, dueThisWeek: 0, overdue: 0, completedThisWeek: 0 };
      
      if (!tasks.length) {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        let emptyHtml = APP._projectSelectHtml('APP.state.scheduleView=\'ahead\';APP.renderSchedule()') + `
          <div style="text-align:center;padding:40px;color:var(--muted)">
            <p style="margin-bottom:16px;">No tasks scheduled yet. Upload a schedule to see look-ahead tasks.</p>
            <button class="btn-primary" style="padding:10px 20px;font-size:13px;" onclick="document.getElementById('task-create-dialog').style.display='flex'">
              + Schedule Task
            </button>
          </div>
          <!-- Task Creation Dialog -->
          <div id="task-create-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center;padding:16px;">
            <div style="background:var(--white);width:100%;max-width:480px;border-radius:var(--r);box-shadow:var(--shadow2);overflow:hidden;animation:fadeIn .2s;">
              <div style="padding:16px;background:var(--navy);color:var(--white);display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:14px;font-weight:600;">Schedule Future Task</h3>
                <button type="button" style="background:none;border:none;color:var(--white);font-size:18px;cursor:pointer;" onclick="document.getElementById('task-create-dialog').style.display='none'">×</button>
              </div>
              <form id="task-create-form" style="padding:16px;display:flex;flex-direction:column;gap:12px;" onsubmit="event.preventDefault();APP.submitLookaheadTask(event, ${pid})">
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Task Name *</label>
                  <input type="text" name="task_name" required style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
                </div>
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Description</label>
                  <textarea name="description" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;resize:none;"></textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Start Date *</label>
                    <input type="date" name="start_date" required min="${todayStr}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
                  </div>
                  <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Due Date *</label>
                    <input type="date" name="end_date" required min="${todayStr}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <div>
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Trade</label>
                    <select name="trade" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;background:var(--white);outline:none;">
                      <option value="General">General</option>
                      <option value="Civil">Civil</option>
                      <option value="Structural">Structural</option>
                      <option value="HVAC">HVAC</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Finishes">Finishes</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Priority</label>
                  <select name="priority" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;background:var(--white);outline:none;">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input type="hidden" name="assignee_id" value="">
                <div style="display:flex;justify-content:end;gap:8px;margin-top:8px;">
                  <button type="button" class="btn-secondary" style="padding:8px 16px;font-size:12px;" onclick="document.getElementById('task-create-dialog').style.display='none'">Cancel</button>
                  <button type="submit" class="btn-primary" style="padding:8px 16px;font-size:12px;">Save Task</button>
                </div>
              </form>
            </div>
          </div>
        `;
        el.innerHTML = subTabs + emptyHtml;
        return;
      }
      
      if (!APP.state.lookaheadMonthFilter) {
        APP.state.lookaheadMonthFilter = 'all';
      }
      
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const todayObj = new Date(todayStr + 'T00:00:00');
      const dayOfWeek = todayObj.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfWeek = new Date(todayObj.getTime() + diffToMon * 86400000);
      const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
      const startOfWeekStr = startOfWeek.toLocaleDateString('en-CA');
      const endOfWeekStr = endOfWeek.toLocaleDateString('en-CA');
      
      // "Active" = not yet complete and end_date hasn't passed (includes in-progress tasks
      // that have already started but whose end_date is today or in the future).
      // This ensures tasks like "started Jun 2, ends Aug 1" aren't lost in a gap between
      // "upcoming" (start_date >= today) and "overdue" (end_date < today).
      const dynMetrics = {
        upcoming: tasks.filter(t => t.pct_complete < 100 && t.end_date >= todayStr).length,
        dueThisWeek: tasks.filter(t => t.end_date >= startOfWeekStr && t.end_date <= endOfWeekStr && t.pct_complete < 100).length,
        overdue: tasks.filter(t => t.end_date < todayStr && t.pct_complete < 100).length,
        completedThisWeek: metrics?.completedThisWeek || 0
      };
      
      // Filter tasks by selected month if not 'all'
      let filteredTasks = tasks;
      if (APP.state.lookaheadMonthFilter !== 'all') {
        filteredTasks = tasks.filter(t => t.start_date && t.start_date.startsWith(APP.state.lookaheadMonthFilter));
      } else {
        // Show all tasks: future tasks, overdue incomplete tasks, and recently
        // completed tasks (completed within the last day). Tasks completed more
        // than 1 day ago are hidden to keep the view focused.
        const yesterdayObj = new Date(todayObj.getTime() - 86400000);
        const yesterdayStr = yesterdayObj.toLocaleDateString('en-CA');
        filteredTasks = tasks.filter(t => {
          if (t.pct_complete >= 100) {
            // Completed: show only if end_date is recent (within last day)
            return t.end_date >= yesterdayStr;
          }
          // All incomplete tasks (future, current, or overdue) always show
          return true;
        });
      }
      
      // Group tasks by date
      const grouped = {};
      filteredTasks.forEach(t => {
        if (!t.start_date) return;
        const dStr = t.start_date.slice(0, 10);
        if (!grouped[dStr]) grouped[dStr] = [];
        grouped[dStr].push(t);
      });
      
      // Sort dates chronologically
      const sortedDates = Object.keys(grouped).sort();
      
      // Build Months options for navigation filter
      const monthsSet = new Set();
      tasks.forEach(t => {
        if (t.start_date) monthsSet.add(t.start_date.slice(0, 7)); // YYYY-MM
      });
      const currYm = todayStr.slice(0, 7);
      monthsSet.add(currYm);
      const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      const nextYm = nextMonth.getFullYear() + '-' + String(nextMonth.getMonth() + 1).padStart(2, '0');
      monthsSet.add(nextYm);
      
      const sortedMonths = Array.from(monthsSet).sort();
      
      const monthOptions = sortedMonths.map(ym => {
        const [y, m] = ym.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `<option value="${ym}" ${APP.state.lookaheadMonthFilter === ym ? 'selected' : ''}>${label}</option>`;
      }).join('');
      
      // Build Assignee options
      const assigneeOptions = assignees.map(u => 
        `<option value="${u.id}">${u.full_name} (${APP._roleLabel(u.role)})</option>`
      ).join('');
      
      // Render layout HTML
      let html = APP._projectSelectHtml('APP.state.scheduleView=\'ahead\';APP.renderSchedule()') + `
        <!-- Metrics Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:20px;">
          <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px;">${dynMetrics.upcoming}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Upcoming Tasks</div>
          </div>
          <div style="background:rgba(218,165,32,0.12);border:1px solid rgba(218,165,32,0.3);border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--amber);margin-bottom:4px;">${dynMetrics.dueThisWeek}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Due This Week</div>
          </div>
          <div style="background:rgba(200,112,96,0.12);border:1px solid rgba(200,112,96,0.3);border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#C87060;margin-bottom:4px;">${dynMetrics.overdue}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Overdue Tasks</div>
          </div>
          <div style="background:rgba(12,166,120,0.12);border:1px solid rgba(12,166,120,0.3);border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--green);margin-bottom:4px;">${dynMetrics.completedThisWeek}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Completed This Week</div>
          </div>
        </div>
        
        <!-- Header Controls Row -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;font-weight:600;color:var(--text)">Filter Month:</span>
            <select style="padding:6px 12px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;background:var(--white);color:var(--text);outline:none;cursor:pointer;" 
              onchange="APP.state.lookaheadMonthFilter=this.value; APP.renderSchedule()">
              <option value="all" ${APP.state.lookaheadMonthFilter === 'all' ? 'selected' : ''}>All Future Months</option>
              ${monthOptions}
            </select>
          </div>
          
          <button class="btn-primary" style="display:flex;align-items:center;gap:6px;padding:8px 16px;font-size:12px;" onclick="document.getElementById('task-create-dialog').style.display='flex'">
            Schedule Task
          </button>
        </div>
        
        <!-- Task Creation Dialog (Modal overlay style) -->
        <div id="task-create-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center;padding:16px;">
          <div style="background:var(--white);width:100%;max-width:480px;border-radius:var(--r);box-shadow:var(--shadow2);overflow:hidden;animation:fadeIn .2s;">
            <div style="padding:16px;background:var(--navy);color:var(--white);display:flex;justify-content:space-between;align-items:center;">
              <h3 style="margin:0;font-size:14px;font-weight:600;">Schedule Future Task</h3>
              <button type="button" style="background:none;border:none;color:var(--white);font-size:18px;cursor:pointer;" onclick="document.getElementById('task-create-dialog').style.display='none'">×</button>
            </div>
            <form id="task-create-form" style="padding:16px;display:flex;flex-direction:column;gap:12px;" onsubmit="event.preventDefault();APP.submitLookaheadTask(event, ${pid})">
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Task Name *</label>
                <input type="text" name="task_name" required style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
              </div>
              
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Description</label>
                <textarea name="description" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;resize:none;"></textarea>
              </div>
              
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Start Date *</label>
                  <input type="date" name="start_date" required min="${todayStr}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
                </div>
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Due Date *</label>
                  <input type="date" name="end_date" required min="${todayStr}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Trade</label>
                  <select name="trade" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;background:var(--white);outline:none;">
                    <option value="General">General</option>
                    <option value="Civil">Civil</option>
                    <option value="Structural">Structural</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Finishes">Finishes</option>
                  </select>
                </div>
              </div>
              
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Assignee</label>
                  <select name="assignee_id" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;background:var(--white);outline:none;">
                    <option value="">Unassigned</option>
                    ${assigneeOptions}
                  </select>
                </div>
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Priority</label>
                  <select name="priority" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;background:var(--white);outline:none;">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div style="display:flex;justify-content:end;gap:8px;margin-top:8px;">
                <button type="button" class="btn-secondary" style="padding:8px 16px;font-size:12px;" onclick="document.getElementById('task-create-dialog').style.display='none'">Cancel</button>
                <button type="submit" class="btn-primary" style="padding:8px 16px;font-size:12px;">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      // Render Chronological Feed
      if (!sortedDates.length) {
        html += UI.empty('', 'No scheduled future tasks for this month filter');
      } else {
        html += `<div style="display:flex;flex-direction:column;gap:16px;">`;
        sortedDates.forEach(date => {
          const dayTasks = grouped[date];
          const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
          const isToday = date === todayStr;
          
          html += `
            <div>
              <div style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--navy);letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;">
                <span>${dateLabel}</span>
                ${isToday ? `<span class="badge b-blue" style="font-size:9px;padding:1px 6px;">Today</span>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
          `;
          
          dayTasks.forEach(t => {
            const isOverdue = t.end_date < todayStr && t.pct_complete < 100;
            const isDone = t.pct_complete >= 100;
            const borderColor = isOverdue ? 'rgba(200,112,96,0.35)' : isDone ? 'rgba(12,166,120,0.35)' : 'var(--border)';
            html += `
              <div style="background:var(--white);border:1px solid ${borderColor};border-radius:var(--r);padding:12px;display:flex;flex-direction:column;gap:6px;box-shadow:var(--shadow-sm);">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
                  <div style="font-weight:600;font-size:13px;color:var(--text);">${t.task_name}</div>
                  ${isOverdue ? '<span class="badge b-red" style="font-size:9px">Overdue</span>' : ''}
                  ${isDone ? '<span class="badge b-green" style="font-size:9px">Done</span>' : ''}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;flex-wrap:wrap;gap:8px;">
                  <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:10px;font-family:var(--mono);color:var(--text);text-transform:uppercase;background:rgba(29,61,98,0.10);border:1px solid rgba(29,61,98,0.20);padding:2px 6px;border-radius:4px;">${t.trade}</span>
                    <span style="font-size:10px;font-family:var(--mono);color:var(--navy);text-transform:uppercase;background:rgba(12,100,180,0.12);border:1px solid rgba(12,100,180,0.25);padding:2px 6px;border-radius:4px;">${t.pct_complete}% Done</span>
                  </div>
                </div>
                ${!isDone ? `<div class="pct-wrap" style="margin-top:6px;">
                  <input type="range" class="pct-slider" min="0" max="100" step="5" value="${t.pct_complete}"
                    oninput="APP.liveUpdatePct(${t.id},${pid},'${todayStr}',this)">
                  <div class="pct-val" id="pv-${t.id}">${t.pct_complete}%</div>
                </div>` : ''}
              </div>
            `;
          });
          
          html += `</div></div>`;
        });
        html += `</div>`;
      }
      
      el.innerHTML = subTabs + html;
    } catch(err) {
      console.error(err);
      el.innerHTML = subTabs + UI.empty('️', 'Error loading Look Ahead workspace: ' + err.message);
    }
  },

  async submitLookaheadTask(event, pid) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const start_date = formData.get('start_date');
    const end_date   = formData.get('end_date');
    if (end_date && start_date && end_date < start_date) {
      UI.toast('Due date cannot be before start date', 'error');
      return;
    }
    const data = {
      task_name: formData.get('task_name'),
      description: formData.get('description'),
      assignee_id: formData.get('assignee_id') || null,
      priority: formData.get('priority') || 'medium',
      start_date,
      end_date,
      trade: formData.get('trade') || 'General'
    };
    
    try {
      UI.toast('Saving task...', 'info');
      const res = await API.createTask(pid, data);
      if (res.success) {
        UI.toast('Task scheduled successfully!', 'success');
        document.getElementById('task-create-dialog').style.display = 'none';
        APP.renderSchedule();
      } else {
        UI.toast(res.error || 'Failed to create task', 'error');
      }
    } catch(err) {
      console.error(err);
      UI.toast(err.message || 'Error creating task', 'error');
    }
  },

  async togglePastNotes(pid) {
    const panel  = document.getElementById('past-notes-panel');
    const toggle = document.getElementById('past-notes-toggle');
    if (!panel || !toggle) return;
    if (panel.style.display !== 'none') {
      panel.style.display = 'none';
      toggle.textContent = 'Show';
      return;
    }
    toggle.textContent = 'Loading…';
    try {
      const data = await API.getDailyReportsHistory(pid);
      const reports = (Array.isArray(data) ? data : data?.reports || [])
        .filter(r => r.overall_notes && r.overall_notes.trim());
      if (!reports.length) {
        panel.innerHTML = `<div style="color:var(--muted);font-size:12px;font-style:italic;padding:8px 0">No notes found yet.</div>`;
      } else {
        panel.innerHTML = reports.slice(0, 14).map(r => `
          <div style="border:1px solid var(--border);border-radius:var(--r);padding:10px 12px;margin-bottom:8px;background:var(--white)">
            <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:4px;display:flex;gap:8px;align-items:center">
              <span>${UI.fmtDate(r.report_date)}</span>
              <span class="badge ${r.status==='approved'?'b-green':r.status==='flagged'?'b-red':'b-amber'}" style="font-size:9px">${r.status.replace('_',' ')}</span>
            </div>
            <div style="font-size:12px;color:var(--text);white-space:pre-wrap">${UI.escapeText(r.overall_notes)}</div>
          </div>`).join('');
      }
      panel.style.display = 'block';
      toggle.textContent = 'Hide';
    } catch(e) {
      panel.innerHTML = `<div style="color:var(--amber);font-size:12px">Could not load past notes.</div>`;
      panel.style.display = 'block';
      toggle.textContent = 'Hide';
    }
  },

  async savePlanningNote(textarea) {
    const taskId = textarea.dataset.taskId;
    const pid    = textarea.dataset.pid;
    const note   = (textarea.value || '').trim();
    if (!taskId || !pid) return;
    try {
      await API.saveTaskPlanningNote(pid, taskId, note);
    } catch(e) { /* silent — non-critical */ }
  },

  // ── SCHEDULE VIEW (PMC / Admin)
  async renderScheduleView() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
    if (APP._guardInitialisingProject(el, pid)) return;

    const data = await API.getSchedule(pid);
    const ver  = data?.version;
    const tasks = data?.tasks || [];
    const byTrade = APP.groupByTrade(tasks);

    let html = APP._projectSelectHtml('APP.renderScheduleView()');
    const isPMCHead = APP.user?.role === 'pmc_head';
    // Also fetch versions to find any pending one needing acknowledgement
    const versionsData = await API.get(`/schedule/${pid}/versions`).catch(() => null);
    const pendingVer = (versionsData?.versions || []).find(v => v.status === 'pending_approval');
    const isPrincipal = ['principal','design_principal'].includes(APP.user?.role);
    if (pendingVer && isPMCHead && !pendingVer.drift_acknowledged) {
      html += `<div class="card" style="background:#FFF8E1;border-left:3px solid var(--amber);margin-bottom:12px;padding:12px">
        <div style="font-weight:600;color:var(--amber);margin-bottom:6px">⚠ Schedule drift requires your acknowledgement</div>
        <div class="card-meta" style="margin-bottom:8px">+${pendingVer.drift_days} days drift from R0 — document mitigation before Principal reviews</div>
        <textarea id="drift-mit-note" rows="2" placeholder="Mitigation steps / explanation…" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-size:13px"></textarea>
        <button class="btn-sm approve" onclick="APP.acknowledgeDrift(${pid}, ${pendingVer.id}, ${pendingVer.row_version||0})" style="width:100%">Acknowledge Drift & Notify Principal</button>
      </div>`;
    }
    if (pendingVer && isPrincipal) {
      const ackNote = pendingVer.drift_mitigation ? `<div style="font-size:12px;background:var(--surface);border-radius:4px;padding:8px;margin-bottom:8px;color:var(--text)"><strong>PMC mitigation note:</strong> ${UI.escapeText(pendingVer.drift_mitigation)}</div>` : '';
      const ackPending = !pendingVer.drift_acknowledged ? '<div style="font-size:12px;color:var(--amber);margin-bottom:8px">⏳ Awaiting PMC Head acknowledgement</div>' : '';
      html += `<div class="card" style="background:#F0F7FF;border-left:3px solid var(--navy);margin-bottom:12px;padding:12px">
        <div style="font-weight:600;color:var(--navy);margin-bottom:6px">📋 Schedule ${pendingVer.label} pending your approval</div>
        <div class="card-meta" style="margin-bottom:8px">+${pendingVer.drift_days} days drift from R0</div>
        ${ackPending}${ackNote}
        ${pendingVer.drift_acknowledged
          ? `<button class="btn-sm approve" onclick="APP.approveScheduleVersion(${pid}, ${pendingVer.id})" style="width:100%">Approve Schedule ✓</button>`
          : `<button class="btn-sm" disabled style="width:100%;opacity:0.5">Waiting for PMC acknowledgement…</button>`}
      </div>`;
    }
    if (ver) {
      html += `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <span class="badge b-blue">Schedule ${ver.label}</span>
        ${ver.drift_days > 0 ? `<span class="badge b-${ver.drift_days>3?'red':'amber'}">+${ver.drift_days} days drift</span>` : '<span class="badge b-green">On R0 track</span>'}
      </div>`;
    }

    html += `<div class="sec-label">Today — Validate Site Updates</div>`;

    if (!tasks.length) {
      html += UI.empty('','No tasks today');
    } else {
      Object.entries(byTrade).forEach(([trade, tlist]) => {
        const col = TRADE_COLORS[trade] || '#5a5a5a';
        html += `<div class="trade-group"><div class="trade-hdr">
          <div class="trade-dot" style="background:${col}"></div>
          <div class="trade-name">${trade}</div>
        </div>`;
        tlist.forEach(t => {
          const pct = t.pct_complete || 0;
          const vStatus = t.validation_status;
          html += `<div class="task-item${pct===100?' task-done':''}">
            <div class="task-dot"></div>
            <div style="flex:1">
              <div class="task-name">${t.task_name}</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
                <div class="prog-bar" style="flex:1"><div class="prog-fill" style="width:${pct}%;background:${col}"></div></div>
                <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${pct}%</span>
              </div>
              ${pct===100 && t.update_id ? `<div style="display:flex;gap:6px;margin-top:8px">
                ${vStatus==='validated'
                  ? '<span class="badge b-green">✓ Validated</span>'
                  : vStatus==='rejected'
                  ? '<span class="badge b-red">✗ Rejected</span>'
                  : `<button class="btn-sm approve" onclick="APP.validateTask(${t.update_id},'validated',${pid})">Validate ✓</button>
                     <button class="btn-sm reject" onclick="APP.validateTask(${t.update_id},'rejected',${pid})">Reject ✗</button>`}
              </div>` : ''}
            </div>
          </div>`;
        });
        html += `</div>`;
      });
    }

    // Upload schedule
    html += `<div style="margin-top:16px">
      <div class="field-row"><label class="field-label" for="sched-file">Upload Revised Schedule</label></div>
      <input type="file" id="sched-file" accept=".xlsx,.xls" style="display:none" onchange="APP.uploadSchedule(${pid},this)">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn-sm gold" onclick="document.getElementById('sched-file').click()">Upload New Schedule Version</button>
        <a href="${API.scheduleTemplateUrl(pid)}" download="schedule_template.xlsx"
           style="font-size:12px;color:var(--navy);text-decoration:underline;display:flex;align-items:center;gap:4px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download Template
        </a>
      </div>
    </div>`;

    el.innerHTML = html;
  },

  async validateTask(updateId, status, pid) {
    const note = status === 'rejected' ? await UI.prompt('Reason for rejection') : null;
    await API.validateTask(pid, { task_update_id: updateId, status, rejection_note: note });
    UI.toast(status === 'validated' ? 'Validated ✓' : 'Rejected — sent back to site manager');
    APP.renderScheduleView();
  },

  async acknowledgeDrift(pid, versionId, rowVersion) {
    const mitigation_note = document.getElementById('drift-mit-note')?.value?.trim();
    if (!mitigation_note) { UI.toast('Please enter mitigation steps first'); return; }
    const res = await API.patch(`/schedule/${pid}/drift-acknowledge`, { version_id: versionId, mitigation_note, row_version: rowVersion });
    if (res?.success) { UI.toast('Drift acknowledged ✓ — Principal notified'); APP.renderScheduleView(); }
    else UI.toast(res?.error || 'Failed');
  },

  async approveScheduleVersion(pid, versionId) {
    const ok = await UI.confirm('Approve this schedule version? It will become the active schedule.');
    if (!ok) return;
    const res = await API.post(`/schedule/${pid}/versions/${versionId}/approve`, {});
    if (res?.success) { UI.toast(res.message || 'Schedule approved ✓'); APP.renderScheduleView(); }
    else UI.toast(res?.error || 'Approval failed');
  },

  async uploadSchedule(pid, input) {
    const file = input.files[0];
    if (!file) return;
    // Only ask for a reason if there's already an existing schedule version
    const existing = await API.get(`/schedule/${pid}`).catch(() => null);
    const isFirstUpload = !existing?.version;
    const reason = isFirstUpload ? '' : await UI.prompt('Reason for schedule revision');
    const fd = new FormData();
    fd.append('schedule', file);
    fd.append('reason', reason || '');
    const res = await API.uploadSchedule(pid, fd);
    if (res?.success) {
      UI.toast(res.message || 'Schedule uploaded ✓');
      APP.renderScheduleView();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
  },

  // ── DRAWINGS
  async renderDrawings() {
    const el  = UI.contentEl();
    // Portfolio mode: show pending drawings across all projects
    if (APP.state.portfolioMode === 'drawings') {
      return APP._renderDrawingsPortfolio(el);
    }
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
    if (APP._guardInitialisingProject(el, pid)) return;

    const data = await API.getDrawings(pid);
    const drawings = data?.drawings || [];
    const role = APP.user.role;

    const canUpload = ['team_lead','jr_architect','jr_engineer','services_engineer',
                       'design_head','services_head','principal','design_principal'].includes(role);

    let html = '<div class="drawings-page">';
    html += APP._projectSelectHtml('APP.renderDrawings()');

    if (canUpload) {
      html += `<div style="margin-bottom:16px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">

        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Drawing Type</div>
        <div style="display:flex;gap:6px;margin-bottom:16px" id="dwg-type-chips">
          <button onclick="APP.setDwgType('main')" id="dwg-type-main" style="min-height:44px;flex:1;padding:10px 8px;text-align:center;font-size:13px;font-weight:600;
                      background:#1a2e44;color:#faf8f3;border:1.5px solid #1a2e44;border-radius:8px;cursor:pointer">
            Main
            <div style="font-size:10px;font-weight:400;opacity:0.8;margin-top:2px">on register</div>
          </button>
          <button onclick="APP.setDwgType('detail')" id="dwg-type-detail" style="min-height:44px;flex:1;padding:10px 8px;text-align:center;font-size:13px;font-weight:600;
                      background:var(--white);color:var(--muted);border:1.5px solid var(--border);border-radius:8px;cursor:pointer">
            Detail
            <div style="font-size:10px;font-weight:400;opacity:0.7;margin-top:2px">any number</div>
          </button>
          <button onclick="APP.setDwgType('rfi_response')" id="dwg-type-rfi" style="min-height:44px;flex:1;padding:10px 8px;text-align:center;font-size:13px;font-weight:600;
                      background:var(--white);color:var(--muted);border:1.5px solid var(--border);border-radius:8px;cursor:pointer">
            RFI Reply
            <div style="font-size:10px;font-weight:400;opacity:0.7;margin-top:2px">links to RFI</div>
          </button>
        </div>
        <input type="hidden" id="dwg-type" value="main">

        <div id="dwg-type-info" style="font-size:12px;color:#666;background:var(--bg);padding:10px 12px;border-radius:8px;margin-bottom:14px;line-height:1.5">
          <strong style="color:#1a2e44">Main drawing</strong> — must match a drawing number on the approved register. PMC Head or Services Head pre-registers every main drawing at project start.
        </div>

        <div class="field-row"><label class="field-label">Project</label>
          <input type="hidden" id="dwg-proj" value="${pid}">
          <div style="padding:10px 12px;background:var(--surface,#f8f9fa);border:1px solid var(--border);border-radius:var(--r);font-size:13px;color:var(--text)">${(APP.user?.projects||[]).find(p=>String(p.id)===String(pid))?.name||'Project '+pid}</div>
        </div>
        <div class="field-row"><label class="field-label" for="dwg-cat">Category</label>
          <select id="dwg-cat">
            <option value="">— Select —</option>
            ${['Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT'].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field-row" id="dwg-num-row"><label class="field-label" for="dwg-num">Drawing Number</label><input type="text" id="dwg-num" placeholder="e.g. A-101"></div>
        <div class="field-row" id="dwg-name-row"><label class="field-label" for="dwg-name">Drawing Name</label><input type="text" id="dwg-name" placeholder="Ground Floor Plan"></div>

        <div class="field-row" id="dwg-parent-row" style="display:none"><label class="field-label" for="dwg-parent">Parent Drawing (optional)</label>
          <input type="text" id="dwg-parent" placeholder="e.g. 42 (drawing ID of A-101)">
        </div>
        <div class="field-row" id="dwg-rfi-row" style="display:none"><label class="field-label" for="dwg-rfi">RFI Number <span style="color:#a84a3a">*</span></label>
          <input type="text" id="dwg-rfi" placeholder="Issue ID of the RFI">
        </div>

        <div class="field-row"><label class="field-label" for="dwg-notes">Notes</label><textarea id="dwg-notes" rows="2" placeholder="Revision notes…"></textarea></div>
        <input type="file" id="dwg-file" accept=".pdf,.dwg,.dxf" style="display:none" onchange="APP.uploadDrawing(${pid},this)">
        <button class="btn-sm gold" style="width:100%;padding:10px" onclick="APP.triggerDrawingUpload()">Upload Drawing / PDF</button>
      </div>`;
    }

    // Category filters
    const cats = [...new Set(drawings.map(d => d.category))];
    if (cats.length > 1) {
      html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">
        ${['All',...cats].map(c => `<button style="min-height:44px;
          padding:4px 10px;border-radius:3px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--mono);
          background:${APP.state.dwgFilter===c?'var(--navy)':'var(--white)'};
          color:${APP.state.dwgFilter===c?'#0a0a0a':'var(--muted)'};
          border:1px solid ${APP.state.dwgFilter===c?'var(--navy)':'var(--border)'}" onclick="APP.state.dwgFilter='${c}';APP.renderDrawings()">${c}</button>`).join('')}
      </div>`;
    }

    let filtered = APP.state.dwgFilter === 'All' ? drawings : drawings.filter(d => d.category === APP.state.dwgFilter);
    filtered = APP._applySort(filtered, APP._getSortMode('drawings'), { ageField:'uploaded_at' });

    if (!filtered.length) {
      html += UI.empty('','No drawings yet');
    } else {
      html += APP._sortToggleHTML('drawings', ['default','age']);
      filtered.forEach(d => { html += APP.drawingCard(d, role, pid); });
    }
    html += '</div>';

    el.innerHTML = html;
    // Always start on Main type after a fresh render
    if (canUpload) APP.setDwgType('main');
  },

  // ── Cross-project pending drawings portfolio ─────────────────────────────
  async _renderDrawingsPortfolio(el) {
    UI.loading(el);
    const role = APP.user.role;
    const projects = APP._visibleProjects();
    const pendingStatuses = new Set(['pending_l1','pending_l2']);

    // Determine which status this role cares about
    const myStatuses = role === 'design_head'   ? ['pending_l2'] :
                       role === 'services_head' ? ['pending_l1'] :
                       role === 'team_lead'      ? ['pending_l1'] :
                       ['pending_l1','pending_l2'];

    // Fetch all projects in parallel
    const results = await Promise.all(
      projects.map(p => API.getDrawings(p.id).then(d => ({ p, drawings: d?.drawings || [] })))
    );

    const role_stream = role === 'services_head' ? 'services' : 'design';
    let totalPending = 0;
    let html = '<div class="drawings-page">';

    // Header row with exit button
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px">
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--navy)">Pending Review — All Projects</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Drawings awaiting your action across all projects</div>
      </div>
      <button class="btn-sm" onclick="APP.state.portfolioMode=null;APP.state.portfolioPendingOnly=false;APP.renderDrawings()" style="flex-shrink:0">View by Project ▾</button>
    </div>`;

    for (const { p, drawings } of results) {
      // Filter to pending drawings this role can act on
      const pending = drawings.filter(d => {
        if (!myStatuses.includes(d.version_status)) return false;
        // Stream-scoped roles only see their stream
        if (['design_head','services_head','team_lead'].includes(role) && d.stream !== role_stream) return false;
        return true;
      });
      if (!pending.length) continue;
      totalPending += pending.length;

      html += `<div style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 6px">
        <div class="sec-label" style="margin:0">${UI.escapeText(p.name)}</div>
        <button class="btn-sm" onclick="APP.state.portfolioMode=null;APP.state.portfolioPendingOnly=false;APP.state.selectedProject=${p.id};APP._updateTopbar();APP.renderDrawings()" style="font-size:11px">All drawings →</button>
      </div>`;
      pending.forEach(d => { html += APP.drawingCard(d, role, p.id); });
    }

    if (!totalPending) {
      html += UI.empty('✓', 'No pending drawings across any project');
    }

    html += '</div>';
    el.innerHTML = html;
  },

  drawingCard(d, role, pid) {
    const isPending = d.version_status?.startsWith('pending');
    const isIssued  = d.version_status === 'issued';
    const isSite    = role === 'site_manager';

    const myTurn = isPending && (
      (role === 'team_lead' && d.stream === 'design' && d.version_status === 'pending_l1') ||
      (role === 'design_head'    && d.stream === 'design'    && d.version_status === 'pending_l2') ||
      (role === 'services_head'  && d.stream === 'services'  && d.version_status === 'pending_l1') ||
      ['principal','design_principal'].includes(role)
    );

    const awaiting = d.version_status === 'pending_l1'
      ? (d.stream === 'design' ? 'Team Lead' : 'Services Head')
      : d.version_status === 'pending_l2' ? 'Design Head' : '';

    const canFlag = !isIssued && isPending && ['principal','design_principal','pmc_head','design_head','services_head'].includes(role);
    const drawingViewUrl = d.view_url || (d.version_id ? `/api/drawings/view/${d.version_id}` : null);
    const hasFooter = drawingViewUrl || isIssued || myTurn || (isSite && isIssued) || canFlag ||
      (!isIssued && ['principal','design_principal','design_head','services_head'].includes(role));
    return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px${myTurn?';border-color:var(--steel)':''}">
      <div style="padding:14px 16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--navy)">${UI.escapeText(d.drawing_number)}</div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(d.drawing_name)}</div>
            <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:4px">${UI.escapeText(d.category)} · ${d.uploaded_at?.split('T')[0]||''} · ${UI.escapeText(d.uploaded_by_name||'')}</div>
          </div>
          <span class="di-rev ${isIssued?'rev-issued':isPending?'rev-pending':'rev-superseded'}" style="flex-shrink:0;white-space:nowrap">${UI.escapeText(d.revision)}${isPending?' · pending':''}</span>
        </div>
        ${d.notes ? `<div style="font-size:12px;color:var(--muted);font-style:italic;margin-top:8px;padding:7px 10px;background:var(--bg);border-radius:6px;border-left:2px solid var(--border)">${UI.escapeText(d.notes)}</div>` : ''}
        ${awaiting && !myTurn ? `<div style="font-size:11px;color:var(--muted);margin-top:7px;display:flex;align-items:center;gap:4px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Awaiting ${awaiting}
        </div>` : ''}
      </div>
      ${hasFooter ? `<div style="border-top:1px solid var(--border);padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:var(--bg)">
        ${drawingViewUrl ? `<a class="btn-sm" href="${drawingViewUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;text-decoration:none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>View PDF</a>` : ''}
        ${isIssued ? '<span class="btn-sm approve" style="cursor:default;pointer-events:none;text-transform:uppercase;letter-spacing:.05em">Issued</span>' : ''}
        ${myTurn ? `<button class="btn-sm approve" onclick="APP.approveDrawing(${d.version_id})">${role === 'team_lead' ? 'Mark Reviewed' : 'Approve & Issue'}</button>
          <button class="btn-sm reject" onclick="APP.rejectDrawing(${d.version_id})">Reject</button>` : ''}
        ${isSite && isIssued ? `<button class="btn-sm query" onclick="APP.raiseQueryForDrawing(${d.version_id},'${UI.escapeAttr(d.drawing_number)} ${UI.escapeAttr(d.revision)}',${pid})">Raise Query</button>` : ''}
        ${canFlag && !myTurn ? `<button class="btn-sm" style="color:var(--amber)" onclick="APP.flagDrawingVersion(${d.version_id})">⚑ Flag</button>` : ''}
        ${!isIssued && ['principal','design_principal','design_head','services_head'].includes(role) ? `<button class="btn-sm" style="color:var(--red)" onclick="APP.deleteDrawing(${d.version_id})">Delete</button>` : ''}
      </div>` : ''}
    </div>`;
  },

  triggerDrawingUpload() {
    const cat = document.getElementById('dwg-cat')?.value;
    const num = document.getElementById('dwg-num')?.value.trim();
    const name= document.getElementById('dwg-name')?.value.trim();
    const type= document.getElementById('dwg-type')?.value || 'main';
    if (!cat)  { UI.toast('Select a category'); return; }
    if (!num)  { UI.toast('Enter drawing number'); return; }
    if (!name) { UI.toast('Enter drawing name'); return; }
    if (type === 'rfi_response') {
      const rfiId = document.getElementById('dwg-rfi')?.value.trim();
      if (!rfiId) { UI.toast('RFI number is required for RFI reply'); return; }
    }
    document.getElementById('dwg-file').click();
  },

  setDwgType(t) {
    const hidden = document.getElementById('dwg-type');
    if (hidden) hidden.value = t;

    const types = ['main','detail','rfi'];
    const ids   = { main:'dwg-type-main', detail:'dwg-type-detail', rfi_response:'dwg-type-rfi' };
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const activeBg = '#1a2e44';
    const activeFg = '#faf8f3';
    const inactiveBg = isDark ? '#0F1419' : '#fff';
    const inactiveFg = isDark ? '#AAB8C8' : '#666';
    const inactiveBorder = isDark ? '#3A4A5A' : '#e8e4dc';
    Object.entries(ids).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const active = key === t;
      el.style.background = active ? activeBg : inactiveBg;
      el.style.color      = active ? activeFg : inactiveFg;
      el.style.borderColor= active ? activeBg : inactiveBorder;
    });

    const parentRow = document.getElementById('dwg-parent-row');
    const rfiRow    = document.getElementById('dwg-rfi-row');
    const info      = document.getElementById('dwg-type-info');
    const numRow    = document.getElementById('dwg-num-row');
    const nameRow   = document.getElementById('dwg-name-row');

    if (parentRow) parentRow.style.display = (t === 'detail') ? 'block' : 'none';
    if (rfiRow)    rfiRow.style.display    = (t === 'rfi_response') ? 'block' : 'none';

    // For detail/rfi_response: convert drawing number + name to dropdowns from existing drawings
    if ((t === 'detail' || t === 'rfi_response') && numRow && nameRow) {
      // Replace text inputs with a single dropdown that populates both
      if (!document.getElementById('dwg-parent-select')) {
        const pid = document.getElementById('dwg-proj')?.value;
        numRow.innerHTML = `<label class="field-label" for="dwg-parent-select">Parent Drawing</label>
          <select id="dwg-parent-select" onchange="APP._fillFromParentDrawing(this.value)" style="width:100%">
            <option value="">— Select existing drawing —</option>
          </select>`;
        nameRow.innerHTML = `<label class="field-label">Drawing Number</label>
          <input type="text" id="dwg-num" placeholder="Auto-fills from selection, or type freely">
          <input type="hidden" id="dwg-name" value="">`;
        // Load drawings list
        if (pid) {
          API.get('/drawings/' + pid).then(data => {
            const sel = document.getElementById('dwg-parent-select');
            if (!sel || !data?.drawings) return;
            data.drawings.forEach(d => {
              sel.innerHTML += `<option value="${d.id}" data-num="${UI.escapeAttr(d.drawing_number)}" data-name="${UI.escapeAttr(d.drawing_name)}">${d.drawing_number} — ${d.drawing_name}</option>`;
            });
          }).catch(() => {});
        }
      }
    } else if (t === 'main' && numRow && nameRow) {
      // Restore text inputs for main type
      if (document.getElementById('dwg-parent-select')) {
        numRow.innerHTML = `<label class="field-label" for="dwg-num">Drawing Number</label><input type="text" id="dwg-num" placeholder="e.g. A-101">`;
        nameRow.innerHTML = `<label class="field-label" for="dwg-name">Drawing Name</label><input type="text" id="dwg-name" placeholder="Ground Floor Plan">`;
      }
    }

    if (info) {
      if (t === 'main') {
        info.innerHTML = '<strong style="color:#1a2e44">Main drawing</strong> — must match a drawing number on the approved register. PMC Head or Services Head pre-registers every main drawing at project start.';
      } else if (t === 'detail') {
        info.innerHTML = '<strong style="color:#1a2e44">Detail drawing</strong> — select the parent drawing this detail belongs to. You can also type a custom number.';
      } else {
        info.innerHTML = '<strong style="color:#1a2e44">RFI Reply</strong> — select the drawing this reply relates to. RFI number is required below.';
      }
    }
  },

  _fillFromParentDrawing(drawingId) {
    const sel = document.getElementById('dwg-parent-select');
    if (!sel) return;
    const opt = sel.selectedOptions[0];
    const num = opt?.dataset?.num || '';
    const name = opt?.dataset?.name || '';
    const numInput = document.getElementById('dwg-num');
    const nameInput = document.getElementById('dwg-name');
    if (numInput) numInput.value = num ? num + '-D1' : '';
    if (nameInput) nameInput.value = name;
    // Also fill the parent_drawing_id field
    const parentInput = document.getElementById('dwg-parent');
    if (parentInput) parentInput.value = drawingId;
  },

  async uploadDrawing(pid, input) {
    const file  = input.files[0];
    if (!file) return;
    const drawingType = document.getElementById('dwg-type')?.value || 'main';
    const fd = new FormData();
    fd.append('drawing', file);
    fd.append('drawing_number', document.getElementById('dwg-num').value.trim());
    fd.append('drawing_name',   document.getElementById('dwg-name').value.trim());
    fd.append('category',       document.getElementById('dwg-cat').value);
    fd.append('notes',          document.getElementById('dwg-notes')?.value || '');
    fd.append('drawing_type',   drawingType);
    const parentId = document.getElementById('dwg-parent')?.value;
    const rfiId    = document.getElementById('dwg-rfi')?.value;
    if (parentId) fd.append('parent_drawing_id', parentId);
    if (rfiId)    fd.append('rfi_issue_id', rfiId);

    const res = await API.uploadDrawing(pid, fd);
    if (res?.success) {
      UI.toast(res.message || 'Drawing uploaded ✓');
      APP.renderDrawings();
    } else if (res?.error === 'drawing_not_on_register') {
      // Special handling — show prescriptive error with valid register list
      const validList = (res.hint?.valid_drawing_numbers_on_register || []).slice(0, 50);
      UI.openModal('Drawing not on register',
        `<div style="font-size:15px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap;margin-bottom:16px">
           ${(res.message || '').replace(/</g,'&lt;')}
         </div>
         ${validList.length ? `
         <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px">
           Valid drawings on register (${res.hint?.stream || ''})
         </div>
         <div style="max-height:180px;overflow-y:auto;background:var(--bg);border-radius:8px;padding:12px;
                     font-family:monospace;font-size:13px;color:#1a2e44;line-height:1.8">
           ${validList.join(', ')}
         </div>` : ''}
         <button class="btn-primary" style="margin-top:16px;width:100%"
                 onclick="UI.closeModal()">Got it</button>`
      );
    } else {
      UI.toast(res?.error || res?.message || 'Upload failed');
    }
  },

  async approveDrawing(versionId) {
    const res = await API.approveDrawing(versionId);
    if (res?.success) { UI.toast(res.message || 'Approved ✓'); APP.renderDrawings(); }
    else UI.toast(res?.error || 'Failed');
  },

  async rejectDrawing(versionId) {
    const note = await UI.prompt('Reason for rejection');
    if (note === null) return;
    const res = await API.rejectDrawing(versionId, note);
    if (res?.success) { UI.toast('Rejected — sent back'); APP.renderDrawings(); }
    else UI.toast(res?.error || 'Failed');
  },

  async flagDrawingVersion(versionId) {
    const comment = await UI.prompt('Flag comment (what issue did you find?):');
    if (comment === null) return;
    if (!comment?.trim()) { UI.toast('Comment required to flag'); return; }
    const res = await API.flagDrawingVersion(versionId, { comment: comment.trim() });
    if (res?.success) { UI.toast('Drawing flagged — uploader notified'); APP.renderDrawings(); }
    else UI.toast(res?.error || 'Failed to flag');
  },

  async deleteDrawing(versionId) {
    const ok = await UI.confirm('Delete this drawing? This cannot be undone.');
    if (!ok) return;
    const res = await API.call('DELETE', `/drawings/version/${versionId}`);
    if (res?.success) { UI.toast('Drawing deleted'); APP.renderDrawings(); }
    else UI.toast(res?.error || 'Delete failed');
  },

  raiseQueryForDrawing(versionId, label, pid) {
    UI.openModal(`Query — ${label}`, `
      <div class="field-row"><label class="field-label" for="q-text">Your Question</label>
        <textarea id="q-text" rows="4" placeholder="Be specific — include location, dimensions, reference…"></textarea>
      </div>
      <button class="btn-primary" onclick="APP.submitQuery(${versionId},${pid})">Submit Query</button>
    `);
  },

  async submitQuery(versionId, pid) {
    const q = document.getElementById('q-text')?.value.trim();
    if (!q) { UI.toast('Enter your question'); return; }
    const res = await API.raiseQuery(pid, { drawing_version_id: versionId, question: q });
    if (res?.success) { UI.closeModal(); UI.toast('Query raised — PMC notified ✓'); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── DRAWING REGISTER
  async renderRegister() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    // Design Head / Services Head must upload registers to complete initialisation — skip guard
    if (!['design_head','services_head'].includes(APP.user?.role) && APP._guardInitialisingProject(el, pid)) return;
    const role = APP.user?.role;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getRegister(pid);
    if (!data) return;

    // Per Sprint 2 Item 9: Principal + Design Principal see Register in the
    // More bucket as a READ-ONLY summary — counts + list + sign-off only.
    // They no longer upload or amend the register (that's design_head /
    // services_head territory — PMC Head and Services Head). Removing them from
    // canUpload auto-hides the Upload block and per-row Remove buttons.
    const canUpload = ['design_head','services_head'].includes(role);
    const canSignOff = ['principal','design_principal'].includes(role);
    const rows = data.register || [];
    const sum  = data.summary || {};

    const statusPill = s => {
      const cfg = {
        pending:     { cls:'b-silver', label:'Pending' },
        in_progress: { cls:'b-amber',  label:'In progress' },
        issued:      { cls:'b-green',  label:'Issued' },
      }[s] || { cls:'b-silver', label:s };
      return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
    };

    const designRows   = rows.filter(r => r.stream === 'design');
    const servicesRows = rows.filter(r => r.stream === 'services');

    let html = `
      <div class="drawings-page">
      ${APP._projectSelectHtml('APP.renderRegister()')}
      <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Drawing Register</div>
        <div style="font-size:13px;color:#666;line-height:1.5">Master list of every main drawing expected on this project. Uploaded at project initiation by PMC Head (design) and Services Head (services). Only drawings on the register can be uploaded as <strong>main</strong>.</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#1a2e44;line-height:1">${sum.total||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Total</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#666;line-height:1">${sum.pending||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Pending</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#d4761f;line-height:1">${sum.in_progress||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">In Prog</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#2a7d4f;line-height:1">${sum.issued||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Issued</div>
          </div>
        </div>
      </div>`;

    if (canUpload) {
      html += `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Upload / Amend Register</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="/api/register/${pid}/template" style="flex:1;padding:10px;text-align:center;background:var(--bg);color:#1a2e44;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;min-width:140px">
            Download Template
          </a>
          <button class="btn-sm gold" style="flex:1;padding:10px;min-width:140px" onclick="APP.openRegisterUpload(${pid},'design')">Upload Design</button>
          <button class="btn-sm gold" style="flex:1;padding:10px;min-width:140px" onclick="APP.openRegisterUpload(${pid},'services')">Upload Services</button>
          <button class="btn-sm" style="flex:1;padding:10px;min-width:140px;background:#fff;color:#1a2e44;border:1.5px solid #1a2e44" onclick="APP.openAddRegisterEntry(${pid})">+ Add single entry</button>
        </div>
      </div>`;
    }

    const renderSection = (title, list, stream) => {
      if (!list.length) return `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:16px;text-align:center">
          <div style="font-size:14px;color:#999">No ${title.toLowerCase()} drawings registered yet</div>
        </div>`;

      const unsigned = list.some(r => !r.signed_off_by);
      return `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:0;margin-bottom:16px;overflow:hidden">
          <div style="padding:14px 16px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:14px;font-weight:700;color:#1a2e44">${title} — ${list.length} drawings</div>
              ${unsigned && canSignOff ? `<div style="font-size:11px;color:#8a6320;margin-top:2px">${list.filter(r=>!r.signed_off_by).length} awaiting your sign-off</div>` : ''}
              ${unsigned && !canSignOff ? `<div style="font-size:11px;color:#888;margin-top:2px">Awaiting Principal/Design Principal sign-off</div>` : ''}
            </div>
            ${unsigned && canSignOff ? `<button class="btn-sm gold" style="padding:8px 14px" onclick="APP.signOffRegister(${pid},'${stream}')">Sign off all</button>` : ''}
          </div>
          <div style="max-height:420px;overflow-y:auto">
            ${list.map(r => `
              <div style="padding:12px 16px;border-bottom:1px solid #f0ecdf;display:flex;align-items:center;gap:12px">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                    <span style="font-family:monospace;font-size:14px;font-weight:700;color:#1a1a1a">${r.drawing_number}</span>
                    ${statusPill(r.status)}
                    ${r.signed_off_by ? '<span title="Signed off" style="color:#2a7d4f;font-size:13px">✓</span>' : ''}
                  </div>
                  <div style="font-size:13px;color:#444;line-height:1.3">${r.drawing_name}</div>
                  <div style="font-size:11px;color:#888;margin-top:3px">${r.category}${r.expected_revision?' · Expected '+r.expected_revision:''}</div>
                </div>
                ${r.status === 'pending' && canUpload ? `
                  <button onclick="APP.deleteRegisterEntry(${pid},${r.id})" style="background:#fff;border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;color:#a84a3a;cursor:pointer">Remove</button>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>`;
    };

    html += renderSection('Design stream',   designRows,   'design');
    html += renderSection('Services stream', servicesRows, 'services');
    html += '</div>';

    el.innerHTML = html;
  },

  openRegisterUpload(pid, stream) {
    const label = stream === 'design' ? 'Design' : 'Services';
    UI.openModal(`Upload ${label} Register`, `
      <div style="font-size:13px;color:#666;margin-bottom:14px;line-height:1.5">
        Upload an Excel (.xlsx) file with columns: <strong>Drawing No</strong>, <strong>Drawing Name</strong>, <strong>Category</strong>, optional Expected Rev, Notes.
        <br><br>
        Download the template from the Register screen if needed.
      </div>
      <input type="file" id="reg-file" accept=".xlsx,.xls" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:#fff">
      <button class="btn-primary" style="width:100%;margin-top:14px" onclick="APP.doUploadRegister(${pid},'${stream}')">Upload Register</button>
    `);
  },

  async doUploadRegister(pid, stream) {
    const input = document.getElementById('reg-file');
    const file  = input?.files?.[0];
    if (!file) { UI.toast('Choose a file first'); return; }
    const fd = new FormData();
    fd.append('register', file);
    fd.append('stream', stream);
    const res = await API.uploadRegister(pid, fd);
    if (res?.success) {
      UI.closeModal();
      UI.toast(`${res.imported_count} drawings imported · ${res.error_count||0} errors`);
      APP.renderRegister();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
  },

  openAddRegisterEntry(pid) {
    UI.openModal('Add Single Register Entry', `
      <div class="field-row"><label class="field-label" for="reg-num">Drawing Number</label>
        <input type="text" id="reg-num" placeholder="e.g. A-101">
      </div>
      <div class="field-row"><label class="field-label" for="reg-name">Drawing Name</label>
        <input type="text" id="reg-name" placeholder="Ground Floor Plan">
      </div>
      <div class="field-row"><label class="field-label" for="reg-stream">Stream</label>
        <select id="reg-stream">
          <option value="design">Design</option>
          <option value="services">Services</option>
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="reg-cat">Category</label>
        <select id="reg-cat">
          ${['Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT'].map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="reg-rev">Expected Revision (optional)</label>
        <input type="text" id="reg-rev" placeholder="e.g. R2">
      </div>
      <button class="btn-primary" style="width:100%;margin-top:14px" onclick="APP.doAddRegisterEntry(${pid})">Add to Register</button>
    `);
  },

  async doAddRegisterEntry(pid) {
    const d = {
      drawing_number: document.getElementById('reg-num').value.trim(),
      drawing_name:   document.getElementById('reg-name').value.trim(),
      stream:         document.getElementById('reg-stream').value,
      category:       document.getElementById('reg-cat').value,
      expected_revision: document.getElementById('reg-rev').value.trim()
    };
    if (!d.drawing_number || !d.drawing_name) { UI.toast('Number and name required'); return; }
    const res = await API.addRegisterEntry(pid, d);
    if (res?.success) {
      UI.closeModal();
      UI.toast('Added to register ✓');
      APP.renderRegister();
    } else UI.toast(res?.error || 'Failed');
  },

  async signOffRegister(pid, stream) {
    if (!confirm(`Sign off ${stream} drawing register? This locks it as the approved master list.`)) return;
    const res = await API.signOffRegister(pid, { stream });
    if (res?.success) {
      UI.toast(`Signed off ${res.signed_count} entries ✓`);
      APP.renderRegister();
    } else UI.toast(res?.error || 'Failed');
  },

  async deleteRegisterEntry(pid, entryId) {
    if (!confirm('Remove this drawing from the register?')) return;
    const res = await API.deleteRegisterEntry(pid, entryId);
    if (res?.success) {
      UI.toast('Removed ✓');
      APP.renderRegister();
    } else UI.toast(res?.error || 'Failed');
  },

  // ── DELEGATIONS
  async renderDelegations() {
    const el = UI.contentEl();
    el.innerHTML = '<div class="sec-label">Delegations</div><div>Loading…</div>';

    const [delegs, delegable] = await Promise.all([
      API.get('/delegations').catch(() => null),
      API.get('/delegations/delegable-users').catch(() => null),
    ]);
    if (!delegs) { el.innerHTML = UI.empty('','Failed to load delegations'); return; }

    const fromMe = delegs.delegations_from_me || [];
    const toMe   = delegs.delegations_to_me   || [];
    const can    = (delegable?.users || []).length > 0;

    let html = `
      <div class="sec-label">Delegations</div>
      <div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="font-size:13px;color:#3D5068;line-height:1.5;margin-bottom:12px">
          Delegate your role to a teammate when you're on leave or unavailable. The delegate acts with your authority during the window you set — every action is logged and auditable.
        </div>
        ${can ? `<button class="btn-primary" style="width:auto" onclick="APP.openCreateDelegation()">+ Create Delegation</button>` : `<div style="font-size:12px;color:#93A3B4">No delegate-eligible users for your role.</button>`}
      </div>

      <div class="sec-label">Active — delegated by you</div>
      ${fromMe.length ? fromMe.map(d => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div style="font-size:15px;font-weight:600;color:#1A2332">${d.to_name} <span style="font-size:11px;color:#93A3B4;font-weight:400;text-transform:uppercase;letter-spacing:1px;margin-left:6px">${d.to_role||''}</span></div>
            <div style="font-size:12px;color:#657B90;margin-top:4px">
              ${d.project_name ? 'Project: ' + d.project_name : 'All projects'} · ${d.scope} ·
              ${d.end_at ? ('Until ' + new Date(d.end_at).toLocaleDateString('en-IN')) : 'Permanent'}
            </div>
            ${d.reason ? `<div style="font-size:12px;color:#3D5068;margin-top:6px">${d.reason}</div>` : ''}
          </div>
          <button onclick="APP.revokeDelegation(${d.id})"
            style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:12px;color:#C0392B;cursor:pointer">Revoke</button>
        </div>`).join('')
        : `<div style="color:#93A3B4;font-size:13px;margin-bottom:16px">No active delegations from you.</div>`}

      <div class="sec-label" style="margin-top:24px">Active — delegated to you</div>
      ${toMe.length ? toMe.map(d => `
        <div class="card">
          <div style="font-size:15px;font-weight:600;color:#1A2332">Acting for ${d.from_name}
            <span style="font-size:11px;color:#93A3B4;font-weight:400;text-transform:uppercase;letter-spacing:1px;margin-left:6px">${d.from_role||''}</span>
          </div>
          <div style="font-size:12px;color:#657B90;margin-top:4px">
            ${d.project_name ? 'Project: ' + d.project_name : 'All projects'} · ${d.scope} ·
            ${d.end_at ? ('Until ' + new Date(d.end_at).toLocaleDateString('en-IN')) : 'Permanent'}
          </div>
          ${d.reason ? `<div style="font-size:12px;color:#3D5068;margin-top:6px">${d.reason}</div>` : ''}
        </div>`).join('')
        : `<div style="color:#93A3B4;font-size:13px">No one has delegated to you.</div>`}
    `;
    el.innerHTML = html;
  },

  async openCreateDelegation() {
    const [delegable, projects] = await Promise.all([
      API.get('/delegations/delegable-users').catch(() => null),
      API.getProjects().catch(() => null),
    ]);
    const users = delegable?.users || [];
    const projs = projects?.projects || [];
    const me    = APP.user;

    const isPrincipalPair = (toRole) => ['principal','design_principal'].includes(me.role) && ['principal','design_principal'].includes(toRole);

    UI.openModal('Create Delegation', `
      <div class="field-row"><label class="field-label" for="dg-to">Delegate to</label>
        <select id="dg-to">
          <option value="">— Select —</option>
          ${users.map(u => `<option value="${u.id}" data-role="${u.role}">${UI.escapeText(u.full_name)} (${u.role})</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="dg-proj">Project (or All)</label>
        <select id="dg-proj">
          <option value="">All projects</option>
          ${projs.map(p => `<option value="${p.id}">${UI.escapeText(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="dg-end">End date</label>
        <input type="date" id="dg-end">
        <div style="font-size:11px;color:#93A3B4;margin-top:4px">Leave blank only for permanent delegations (Principal ↔ Principal)</div>
      </div>
      <div class="field-row"><label class="field-label" for="dg-reason">Reason (optional)</label>
        <textarea id="dg-reason" rows="2" placeholder="e.g. On leave 12-16 April"></textarea>
      </div>
      <button class="btn-primary" style="margin-top:14px" onclick="APP.doCreateDelegation()">Create Delegation</button>
    `);
  },

  async doCreateDelegation() {
    const toSel = document.getElementById('dg-to');
    const body = {
      to_user_id: parseInt(toSel.value) || null,
      project_id: parseInt(document.getElementById('dg-proj').value) || null,
      end_at:     document.getElementById('dg-end').value || null,
      reason:     document.getElementById('dg-reason').value.trim(),
    };
    if (!body.to_user_id) { UI.toast('Select a delegate'); return; }
    const res = await API.post('/delegations', body);
    if (res?.success) {
      UI.closeModal();
      UI.toast(res.message || 'Delegation created ✓');
      APP.renderDelegations();
    } else UI.toast(res?.error || 'Failed');
  },

  async revokeDelegation(id) {
    if (!confirm('Revoke this delegation? The delegate will lose authority immediately.')) return;
    const res = await API.post(`/delegations/${id}/revoke`);
    if (res?.success) { UI.toast('Delegation revoked'); APP.renderDelegations(); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── NAV EDITOR (Sprint 2 Item 8) — IT Admin only.
  // Proposes nav changes for another role. Submits as a draft that Principal
  // approves in their Pending tab.
  async renderNavEditor() {
    const el = UI.contentEl();
    if (APP.user.role !== 'it_admin') {
      el.innerHTML = UI.empty('','Nav Editor is restricted to IT Admin');
      return;
    }

    // Editable roles (must match backend EDITABLE_ROLES list in routes/nav-admin.js)
    const EDITABLE_ROLES = [
      'principal','design_principal','pmc_head','design_head','services_head',
      'team_lead','jr_architect','jr_engineer','services_engineer','coordinator',
      'site_manager','senior_site_manager','finance_admin','trainee',
    ];
    const role = APP.state.navEditorRole || 'principal';

    // Load current nav for the selected role
    const data = await API.get(`/nav-admin/current/${role}`);
    const items = data?.items || [];

    // Work on a mutable draft copy in-memory
    if (!APP.state.navEditorDraft || APP.state.navEditorRoleLoaded !== role) {
      APP.state.navEditorDraft = items.map(i => ({ ...i }));
      APP.state.navEditorRoleLoaded = role;
    }
    const draft = APP.state.navEditorDraft;

    const BUCKETS = ['home','work','money','pending','more','strip'];

    // Ensure draft is sorted correctly by bucket and then sort_order
    draft.sort((a, b) => {
      const bIdxA = BUCKETS.indexOf(a.bucket);
      const bIdxB = BUCKETS.indexOf(b.bucket);
      if (bIdxA !== bIdxB) return bIdxA - bIdxB;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    const roleOpts = EDITABLE_ROLES.map(r =>
      `<option value="${r}" ${r===role?'selected':''}>${r.replace(/_/g,' ').toUpperCase()}</option>`
    ).join('');

    const tabOpts = tabSel => {
      const entries = Object.entries(TAB_LABELS);
      if (tabSel && !TAB_LABELS[tabSel]) {
        entries.push([tabSel, tabSel]);
      }
      return entries.map(([k, label]) =>
        `<option value="${k}" ${k===tabSel?'selected':''}>${label} (${k})</option>`
      ).join('');
    };

    let html = `
      <div class="sec-label">Nav Editor</div>
      <div class="card" style="margin-bottom:16px; padding:16px; border-left: 4px solid var(--navy)">
        <div style="font-size:12px; font-weight:bold; color:var(--navy); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px">Select Role to Administer</div>
        <select onchange="APP.setNavEditorRole(this.value)" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-size:14px; background:var(--card); color:var(--text); outline:none">
          ${roleOpts}
        </select>
      </div>

      <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center">
        <div class="sec-label" style="margin:0">Navigation Groups for <b>${role.replace(/_/g,' ')}</b></div>
      </div>
    `;

    // Group items by bucket for display
    const groups = {};
    draft.forEach((it, idx) => {
      if (!groups[it.bucket]) groups[it.bucket] = [];
      groups[it.bucket].push({ item: it, globalIndex: idx });
    });

    BUCKETS.forEach(bucket => {
      const bucketItems = groups[bucket] || [];
      if (bucketItems.length === 0) return; // Only render active groups

      html += `
        <div class="sec-label" style="margin-top:16px; text-transform:capitalize; color:var(--text); font-weight:600">${bucket} Module</div>
        <div class="card" style="margin-bottom:16px; padding:16px; display:flex; flex-direction:column; gap:12px">
          <div style="display:flex; flex-direction:column; gap:8px">
      `;

      bucketItems.forEach(({ item, globalIndex }, subIdx) => {
        const isFirst = subIdx === 0;
        const isLast = subIdx === bucketItems.length - 1;

        html += `
          <div style="display:flex; gap:8px; align-items:center; background:rgba(0,0,0,0.02); padding:6px; border-radius:6px; border:1px solid rgba(0,0,0,0.03)">
            <select onchange="APP.updateNavDraft(${globalIndex},'tab_key',this.value)"
                    style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px; font-size:13px; background:var(--card)">
              ${tabOpts(item.tab_key)}
            </select>
            <div style="display:flex; gap:4px; align-items:center">
              <button class="btn-sm" style="padding:6px 10px; font-size:11px" onclick="APP.moveNavDraftItem(${globalIndex}, 'up')" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed"' : ''}>▲</button>
              <button class="btn-sm" style="padding:6px 10px; font-size:11px" onclick="APP.moveNavDraftItem(${globalIndex}, 'down')" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed"' : ''}>▼</button>
              <button class="btn-sm reject" style="padding:6px 10px; font-size:12px; margin-left:4px" onclick="APP.removeNavRow(${globalIndex})">×</button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
          <button class="btn-secondary" style="border-style:dashed; margin-top:4px; width:100%; padding:8px" onclick="APP.addNavItem('${bucket}')">+ Add Navigation Item</button>
        </div>
      `;
    });

    // Check if any buckets are unused, so the admin can add them as a new group
    const unusedBuckets = BUCKETS.filter(b => !groups[b] || groups[b].length === 0);
    if (unusedBuckets.length > 0) {
      const groupOptions = unusedBuckets.map(b => `<option value="${b}">${b.toUpperCase()}</option>`).join('');
      html += `
        <div class="card" style="margin-top:20px; padding:16px; border: 1px dashed var(--border)">
          <div style="font-size:13px; font-weight:bold; color:var(--muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px">Add Navigation Group</div>
          <div style="display:flex; gap:8px">
            <select id="new-group-bucket-select" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:var(--card)">
              <option value="">-- Select Module Group --</option>
              ${groupOptions}
            </select>
            <button class="btn-secondary" onclick="APP.addNavGroupFromSelect()" style="margin:0; white-space:nowrap">+ Add Group</button>
          </div>
        </div>
      `;
    }

    html += `
      <div style="margin-top:20px">
        <div style="font-size:12px; color:var(--muted); margin-bottom:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px">Note to Principal (optional)</div>
        <textarea id="nav-edit-note" rows="2" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-size:13px"
          placeholder="e.g. Site managers requested GRN move from Work to Money"></textarea>
      </div>

      <div style="display:flex; gap:12px; margin-top:20px">
        <button class="btn-primary" onclick="APP.submitNavDraft()" style="flex:1; padding:12px; font-size:14px; font-weight:bold">Save Changes (Submit for Approval)</button>
        <button class="btn-secondary" onclick="APP.resetNavDraft()" style="padding:12px; font-size:14px">Reset</button>
      </div>
    `;

    el.innerHTML = `<div class="fade-in">${html}</div>`;
  },

  setNavEditorRole(r) {
    APP.state.navEditorRole = r;
    APP.state.navEditorDraft = null;   // force reload for new role
    APP.renderNavEditor();
  },
  updateNavDraft(idx, field, value) {
    if (!APP.state.navEditorDraft) return;
    APP.state.navEditorDraft[idx][field] = value;
  },
  addNavItem(bucket) {
    if (!APP.state.navEditorDraft) APP.state.navEditorDraft = [];
    const bucketItems = APP.state.navEditorDraft.filter(r => r.bucket === bucket);
    const nextOrder = bucketItems.length
      ? Math.max(...bucketItems.map(r => r.sort_order||0)) + 1
      : 1;
    // Find first unused tab key, or default to first valid tab key
    const usedKeys = new Set(APP.state.navEditorDraft.map(r => r.tab_key));
    const nextTabKey = Object.keys(TAB_LABELS).find(k => !usedKeys.has(k)) || 'dashboard';

    APP.state.navEditorDraft.push({ bucket, tab_key: nextTabKey, sort_order: nextOrder, is_visible: 1 });
    APP.renderNavEditor();
  },
  addNavGroupFromSelect() {
    const sel = document.getElementById('new-group-bucket-select');
    if (!sel || !sel.value) {
      UI.toast('Please select a module group to add');
      return;
    }
    APP.addNavItem(sel.value);
  },
  removeNavRow(idx) {
    if (!APP.state.navEditorDraft) return;
    APP.state.navEditorDraft.splice(idx, 1);
    APP.renderNavEditor();
  },
  moveNavDraftItem(idx, direction) {
    if (!APP.state.navEditorDraft) return;
    const item = APP.state.navEditorDraft[idx];
    if (!item) return;

    // Filter items in the same bucket
    const bucketItems = APP.state.navEditorDraft.filter(r => r.bucket === item.bucket);
    const subIdx = bucketItems.findIndex(r => r === item);

    if (direction === 'up' && subIdx > 0) {
      const other = bucketItems[subIdx - 1];
      // Swap order
      const temp = item.sort_order;
      item.sort_order = other.sort_order;
      other.sort_order = temp;
    } else if (direction === 'down' && subIdx < bucketItems.length - 1) {
      const other = bucketItems[subIdx + 1];
      // Swap order
      const temp = item.sort_order;
      item.sort_order = other.sort_order;
      other.sort_order = temp;
    }

    APP.renderNavEditor();
  },
  resetNavDraft() {
    APP.state.navEditorDraft = null;
    APP.renderNavEditor();
  },
  async submitNavDraft() {
    const role = APP.state.navEditorRole || 'principal';
    const items = (APP.state.navEditorDraft || []).filter(r => r.tab_key && r.tab_key.trim());
    if (!items.length) { UI.toast('No tabs to submit'); return; }
    const note = document.getElementById('nav-edit-note')?.value || null;

    const res = await API.post('/nav-admin/propose', { role, items, note });
    if (res?.success) {
      UI.toast(`Proposal sent for ${role} — awaiting principal approval`);
      APP.state.navEditorDraft = null;
      APP.renderNavEditor();
    } else {
      UI.toast(res?.error || 'Failed to submit proposal');
    }
  },

  // ── PENDING TAB (Sprint 2 Item 6) — Blocked + Needs You for Principal /
  // Design Principal / PMC Head / Audit. Data comes from /api/pending/me
  // which applies per-project SLA defaults to find overdue items.
  async renderPending() {
    const el = UI.contentEl();
    const data = await API.get('/pending/me');
    if (!data) { el.innerHTML = UI.empty('','Failed to load'); return; }

    const blocked  = data.blocked  || [];
    const needsYou = data.needsYou || [];

    // Principal / Design Principal / IT Admin see WA failures + pending Nav drafts
    let navDrafts = [];
    let waFails   = [];
    const isAdmin = ['principal','design_principal','it_admin'].includes(APP.user.role);
    if (isAdmin) {
      const [navRes, waRes] = await Promise.all([
        API.get('/nav-admin/drafts').catch(() => null),
        API.get('/admin-reset/wa-failures').catch(() => null),
      ]);
      navDrafts = navRes?.drafts  || [];
      waFails   = waRes?.failures || [];
    } else if (APP.user.role === 'principal') {
      const navRes = await API.get('/nav-admin/drafts').catch(() => null);
      navDrafts = navRes?.drafts || [];
    }

    let html = '';

    // ── WA failure alert (IT Admin / Principal) — shown FIRST if present
    if (waFails.length) {
      html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;border-left:3px solid var(--red)">
        <div style="padding:12px 16px;display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:rgba(200,112,96,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">📵</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px;color:var(--red)">WhatsApp delivery failures</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">Users won't receive notifications until resolved. The app still works normally.</div>
          </div>
        </div>
        ${waFails.slice(0,5).map(f => `<div style="border-top:1px solid var(--border);padding:8px 16px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:12px;color:var(--text);font-weight:500">${f.count} messages failed${f.oldest ? ` — oldest ${f.oldest}` : ''}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${f.message_type || 'various'}</span>
        </div>`).join('')}
        <div style="border-top:1px solid var(--border);padding:8px 16px;background:var(--bg)">
          <span style="font-size:11px;color:var(--muted)">Check Twilio dashboard to resolve</span>
        </div>
      </div>`;
    }

    // Fetch open flags for summary display
    let openFlagsData = null;
    if (['principal','pmc_head','design_principal','audit'].includes(APP.user.role)) {
      openFlagsData = await API.get('/schedule/flags/all').catch(() => null);
    }
    const openFlagsAll = openFlagsData?.flags || [];

    // Summary stat row (include flags in the count)
    const pendingTotal = blocked.length + needsYou.length + navDrafts.length;
    html += `<div class="stat-row" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px">
      <div class="stat-card" style="${blocked.length ? 'cursor:pointer' : ''}" onclick="${blocked.length ? "document.getElementById('pending-blocked-section')?.scrollIntoView({behavior:'smooth'})" : ''}">
        <span class="stat-val ${blocked.length?'red':''}">${blocked.length}</span>
        <span class="stat-lbl">Blocked</span>
      </div>
      <div class="stat-card" style="${(needsYou.length+navDrafts.length) ? 'cursor:pointer' : ''}" onclick="${(needsYou.length+navDrafts.length) ? "document.getElementById('pending-needs-you-section')?.scrollIntoView({behavior:'smooth'})" : ''}">
        <span class="stat-val ${(needsYou.length+navDrafts.length)?'navy':''}">${needsYou.length + navDrafts.length}</span>
        <span class="stat-lbl">Needs You</span>
      </div>
      <div class="stat-card" style="cursor:pointer" onclick="APP.state.flagFilterProject=null;APP.switchTab('flags')">
        <span class="stat-val ${openFlagsAll.length?'red':''}">${openFlagsAll.length}</span>
        <span class="stat-lbl">Open Flags</span>
      </div>
    </div>`;

    // ── Open Flags summary (shown in Pending tab as a call-to-action)
    if (openFlagsAll.length) {
      html += `<div class="sec-label" style="margin-bottom:8px">
        <span style="color:var(--red);margin-right:4px">⚑</span> Open Site Flags
        <span style="background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;font-family:var(--mono);margin-left:6px">${openFlagsAll.length}</span>
      </div>`;
      const flagsByProject = {};
      openFlagsAll.forEach(f => {
        if (!flagsByProject[f.project_id]) flagsByProject[f.project_id] = { name: f.project_name, flags: [] };
        flagsByProject[f.project_id].flags.push(f);
      });
      Object.values(flagsByProject).forEach(grp => {
        const first = grp.flags[0];
        html += `<button class="card" style="padding:0;overflow:hidden;margin-bottom:8px;border-left:3px solid var(--red);width:100%;text-align:left;cursor:pointer"
                     onclick="APP.state.flagFilterProject=${grp.flags[0].project_id};APP.switchTab('flags')">
          <div style="padding:12px 16px">
            <div style="font-weight:600;font-size:13px;color:var(--red)">${UI.escapeText(grp.name)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">${grp.flags.length} open flag${grp.flags.length===1?'':'s'}${first.flag_note ? ' · ' + UI.escapeText((first.flag_note).substring(0,60)) + ((first.flag_note).length>60?'…':'') : ''}</div>
          </div>
        </button>`;
      });
      html += `<button class="btn-sm" style="width:100%;margin-bottom:16px;justify-content:center" onclick="APP.state.flagFilterProject=null;APP.switchTab('flags')">View all flags →</button>`;
    }

    // ── Nav change drafts (Principal only) — shown first since they're rare + urgent
    if (navDrafts.length) {
      html += `<div class="sec-label" style="margin-bottom:8px">Nav change proposals</div>`;
      navDrafts.forEach(d => {
        const cur  = (d.current || []).map(r => `${r.bucket}.${r.tab_key}`);
        const next = (d.items  || []).map(r => `${r.bucket}.${r.tab_key}`);
        const added   = next.filter(k => !cur.includes(k));
        const removed = cur.filter(k => !next.includes(k));
        const summary = (added.length || removed.length) ? `+${added.length} / −${removed.length} tabs` : 'Reorder only';

        html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px;border-left:3px solid var(--navy)">
          <div style="padding:14px 16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
              <div>
                <div style="font-weight:700;font-size:13px;color:var(--navy)">Nav for <span style="text-transform:capitalize">${d.role.replace(/_/g,' ')}</span></div>
                <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:3px">Proposed by ${UI.escapeText(d.proposed_by)} · ${UI.fmtDate(d.proposed_at)}</div>
              </div>
              <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(29,61,98,0.10);color:var(--navy);font-family:var(--mono);flex-shrink:0;border:1px solid rgba(29,61,98,0.20)">${summary}</span>
            </div>
            ${d.note ? `<div style="font-size:12px;color:var(--text);font-style:italic;padding:7px 10px;background:var(--bg);border-radius:6px;border-left:2px solid var(--border);margin-bottom:6px">${UI.escapeText(d.note)}</div>`:''}
            ${added.length ? `<div style="font-size:11px;color:var(--green);font-family:var(--mono);margin-top:4px">+ ${added.join(', ')}</div>`:''}
            ${removed.length ? `<div style="font-size:11px;color:var(--red);font-family:var(--mono);margin-top:2px">− ${removed.join(', ')}</div>`:''}
          </div>
          <div style="border-top:1px solid var(--border);padding:10px 16px;background:var(--bg);display:flex;gap:8px">
            <button class="btn-sm approve" onclick="APP.approveNavDraft(${d.draft_group_id})">Approve</button>
            <button class="btn-sm reject" onclick="APP.rejectNavDraft(${d.draft_group_id})">Reject</button>
          </div>
        </div>`;
      });
    }

    // ── Blocked section — items overdue in others' queues
    if (blocked.length) {
      html += `<div class="sec-label" id="pending-blocked-section" style="margin-bottom:8px">Waiting on others</div>`;
      blocked.forEach(b => {
        const isOld = b.age_days >= 7;
        const isMid = b.age_days >= 3 && !isOld;
        const ageColor = isOld ? 'var(--red)' : isMid ? 'var(--amber)' : 'var(--muted)';
        html += `<button class="card" style="padding:12px 16px;margin-bottom:8px;cursor:pointer;width:100%;text-align:left;border-left:3px solid var(--border)"
                     onclick="APP._tryNav('${b.tab}')">
          <div style="font-weight:600;font-size:13px;color:var(--text)">${UI.escapeText(b.label)}</div>
          <div style="font-family:var(--mono);font-size:11px;color:${ageColor};margin-top:4px">${UI.escapeText(b.sub)}</div>
        </button>`;
      });
    }

    // ── Needs You section — items routed to you
    if (needsYou.length) {
      html += `<div class="sec-label" id="pending-needs-you-section" style="margin-top:16px;margin-bottom:8px">Needs your action</div>`;
      needsYou.forEach(n => {
        const onclick = n.project_id
          ? `APP.state.selectedProject=${n.project_id};APP.switchTab('${n.tab}')`
          : `APP.switchTab('${n.tab}')`;
        html += `<button class="card" style="padding:0;overflow:hidden;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--navy);width:100%;text-align:left"
                     onclick="${onclick}">
          <div style="padding:12px 16px;display:flex;align-items:center;gap:12px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--navy);flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px;color:var(--navy)">${UI.escapeText(n.label)}</div>
              <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:3px">${UI.escapeText(n.sub)}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>`;
      });
    }

    if (!pendingTotal) {
      html += UI.empty('','Nothing pending. Inbox zero.');
    }

    el.innerHTML = `<div class="fade-in">${html}</div>`;
  },

  async approveNavDraft(id) {
    const res = await API.post(`/nav-admin/${id}/approve`);
    if (res?.success) { UI.toast('Approved — nav updated for role'); APP.renderPending(); }
    else UI.toast(res?.error || 'Failed');
  },
  async rejectNavDraft(id) {
    const reason = prompt('Reject reason (optional):') || null;
    const res = await API.post(`/nav-admin/${id}/reject`, { reason });
    if (res?.success) { UI.toast('Rejected'); APP.renderPending(); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── FLAGS MODULE — dedicated tab for reviewing flagged tasks across all projects
  async renderFlags() {
    const el = UI.contentEl();
    UI.loading(el);

    // Support filtering to a specific project (set by project card click)
    const filterPid = APP.state.flagFilterProject || null;

    // Load all flags from the global endpoint
    const data = await API.get('/schedule/flags/all').catch(() => null);
    if (!data) { el.innerHTML = UI.empty('⚠', 'Failed to load flags'); return; }

    let allFlags = data?.flags || [];

    // Get list of unique projects from flags
    const projectMap = {};
    allFlags.forEach(f => { projectMap[f.project_id] = f.project_name; });
    const projects = Object.entries(projectMap).map(([id, name]) => ({ id: parseInt(id), name }));

    // Apply project filter if set
    const displayFlags = filterPid
      ? allFlags.filter(f => f.project_id === filterPid)
      : allFlags;

    // Build project filter — "All" pill + dropdown for individual projects (scales to any count)
    const totalCount = allFlags.length;
    const selectedName = filterPid ? (projectMap[filterPid] || '') : '';
    const filterHtml = `<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
      <button style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid ${!filterPid?'var(--navy)':'var(--border)'};background:${!filterPid?'var(--navy)':'var(--bg)'};border-radius:20px;cursor:pointer;font-size:12px;font-weight:${!filterPid?'700':'500'};color:${!filterPid?'var(--white)':'var(--text)'};white-space:nowrap"
        onclick="APP.state.flagFilterProject=null;APP.renderFlags()">All <span style="background:${!filterPid?'rgba(255,255,255,0.25)':'var(--navy)'};color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;font-family:var(--mono)">${totalCount}</span>
      </button>
      ${projects.length > 0 ? `<div style="position:relative;display:inline-flex;align-items:center">
        <select onchange="const v=this.value;APP.state.flagFilterProject=v?parseInt(v):null;APP.renderFlags()"
          style="appearance:none;-webkit-appearance:none;padding:5px 32px 5px 12px;border:1px solid ${filterPid?'var(--navy)':'var(--border)'};background:${filterPid?'var(--navy)':'var(--bg)'};color:${filterPid?'var(--white)':'var(--text)'};border-radius:20px;font-size:12px;font-weight:${filterPid?'700':'500'};cursor:pointer;font-family:var(--sans);min-width:0;max-width:180px">
          <option value="">Project…</option>
          ${projects.map(p => {
            const cnt = allFlags.filter(f => f.project_id === p.id).length;
            return `<option value="${p.id}" ${filterPid===p.id?'selected':''}>${UI.escapeText(p.name)} (${cnt})</option>`;
          }).join('')}
        </select>
        <span style="position:absolute;right:10px;pointer-events:none;font-size:10px;color:${filterPid?'var(--white)':'var(--muted)'}">▾</span>
      </div>` : ''}
    </div>`;

    // Header
    let html = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--navy);display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Open Flags${displayFlags.length ? ` <span style="background:var(--red);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;font-family:var(--mono)">${displayFlags.length}</span>` : ''}
          </div>
          ${filterPid ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">${UI.escapeText(projectMap[filterPid] || '')}</div>` : ''}
        </div>
        ${filterHtml}
      </div>`;

    if (!displayFlags.length) {
      html += UI.empty('✓', filterPid ? 'No open flags for this project' : 'No open flags — all clear');
    } else {
      // Group by project
      const grouped = {};
      displayFlags.forEach(f => {
        if (!grouped[f.project_id]) grouped[f.project_id] = { name: f.project_name, flags: [] };
        grouped[f.project_id].flags.push(f);
      });

      Object.values(grouped).forEach(grp => {
        // Only show project header if showing multiple projects
        if (!filterPid && projects.length > 1) {
          html += `<div class="sec-label" style="margin:16px 0 8px">${UI.escapeText(grp.name)}</div>`;
        }

        grp.flags.forEach(f => {
          const daysAgo = f.report_date ? Math.round((Date.now() - new Date(f.report_date)) / 86400000) : null;
          const ageStr = daysAgo !== null ? (daysAgo === 0 ? 'Today' : `${daysAgo}d ago`) : '';
          const isOld = daysAgo !== null && daysAgo >= 3;

          html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px;border-left:3px solid var(--red)">
            <div style="padding:14px 16px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:14px;color:var(--text);line-height:1.35">${UI.escapeText(f.task_name)}</div>
                  <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
                    ${f.trade ? `<span style="font-size:10px;background:rgba(200,112,96,0.15);color:var(--red);padding:2px 7px;border-radius:20px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px">${UI.escapeText(f.trade)}</span>` : ''}
                    <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">${f.pct_complete || 0}% complete</span>
                    ${ageStr ? `<span style="font-family:var(--mono);font-size:11px;color:${isOld?'var(--red)':'var(--muted)'};font-weight:${isOld?'700':'400'}">${ageStr}</span>` : ''}
                  </div>
                </div>
                <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:${isOld?'rgba(200,112,96,0.12)':'rgba(255,193,7,0.12)'};color:${isOld?'var(--red)':'var(--amber)'};font-family:var(--mono);flex-shrink:0;white-space:nowrap">FLAG</span>
              </div>
              ${f.flag_note ? `<div style="font-size:12px;color:var(--text);font-style:italic;padding:7px 10px;background:var(--bg);border-radius:6px;border-left:2px solid var(--red);line-height:1.5">${UI.escapeText(f.flag_note)}</div>` : ''}
              ${f.flagged_by_name ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-family:var(--mono)">Flagged by ${UI.escapeText(f.flagged_by_name)}${f.project_name && !filterPid ? ' · ' + UI.escapeText(f.project_name) : ''}</div>` : ''}
            </div>
            <div style="border-top:1px solid var(--border);padding:10px 16px;background:var(--bg)">
              <button class="btn-sm approve" onclick="APP.resolveFlag(${f.project_id},${f.update_id})">Mark Resolved</button>
            </div>
          </div>`;
        });
      });
    }

    el.innerHTML = `<div class="fade-in">${html}</div>`;
  },

  // ── WEEKLY SIGN-OFF (3-way)
  async renderWeeklySignoff() {
    const el = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.get(`/reports/${pid}`).catch(() => null);
    const reports = data?.reports || [];
    const drafts = reports.filter(r => r.status === 'draft' || r.status === 'pending_approval');

    let html = APP._projectSelectHtml('APP.renderWeeklySignoff()') + `<div class="sec-label">Weekly Client Report — Sign-off</div>`;

    if (!drafts.length) {
      html += `<div style="color:#93A3B4;font-size:13px;padding:20px;text-align:center;border:1px dashed #CDD3DC;border-radius:10px">
        No active draft for this project. PMC starts by drafting the report.</div>`;
      el.innerHTML = html;
      return;
    }

    for (const r of drafts) {
      const detail = await API.get(`/weekly-signoff/${r.id}`).catch(() => null);
      if (!detail?.report) continue;
      const rep = detail.report;

      const slot = (label, name, ts, signedBy, role) => {
        const signed = !!signedBy;
        return `<div class="signoff-slot ${signed ? 'signed':'pending'}">
          <div class="label">${label}</div>
          <div class="who">${signed ? name : 'Awaiting ' + role}</div>
          <div class="status">${signed ? '✓ Signed · ' + (ts ? new Date(ts).toLocaleString('en-IN') : '') : 'Pending'}</div>
        </div>`;
      };

      const canEdit = (sec) => rep.status !== 'approved' && rep.status !== 'sent';
      const iAm = APP.user.role;
      const canSign = {
        pmc:      ['principal','design_principal','pmc_head'].includes(iAm),
        design:   ['principal','design_principal','design_head'].includes(iAm),
        services: ['principal','design_principal','services_head'].includes(iAm),
      };
      const allSigned = rep.sig_pmc_by && rep.sig_design_by && rep.sig_services_by;
      const isPrincipal = ['principal','design_principal'].includes(iAm);

      html += `
        <div class="card" style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
              <div style="font-size:16px;font-weight:600;color:#1A2332">Week ${rep.week_number} — ${rep.project_code}</div>
              <div style="font-size:12px;color:#657B90;margin-top:2px">Ending ${UI.fmtDate(rep.week_ending)} · Status: ${rep.status}</div>
            </div>
            ${rep.pdf_url || rep.pdf_path ? `<a class="btn-secondary" href="${API.fileUrl(rep.pdf_url || rep.pdf_path, 'documents')}" target="_blank">Download PDF</a>` : ''}
          </div>

          <div class="signoff-chain">
            ${slot('PMC Section',      rep.sig_pmc_name,      rep.sig_pmc_at,      rep.sig_pmc_by,      'PMC')}
            ${slot('Design Section',   rep.sig_design_name,   rep.sig_design_at,   rep.sig_design_by,   'Design')}
            ${slot('Services Section', rep.sig_services_name, rep.sig_services_at, rep.sig_services_by, 'Services')}
          </div>

          ${['pmc','design','services'].map(sec => `
            <details style="margin-top:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px">
              <summary style="cursor:pointer;font-weight:600;color:#1A2332;font-size:13px">
                ${sec.toUpperCase()} Section ${rep[`sig_${sec}_by`] ? '· Signed' : ''}
              </summary>
              <div style="margin-top:10px">
                ${canEdit(sec) && canSign[sec] ? `
                  <textarea id="ws-${rep.id}-${sec}" rows="6" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">${rep[`${sec}_section`] || ''}</textarea>
                  <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn-secondary" onclick="APP.saveSignoffSection(${rep.id},'${sec}')">Save</button>
                    <button class="btn-primary" onclick="APP.signSignoffSection(${rep.id},'${sec}')">Sign ${sec}</button>
                  </div>
                ` : `
                  <div style="font-size:13px;color:#3D5068;white-space:pre-wrap;padding:8px 0">${rep[`${sec}_section`] || '(empty)'}</div>
                `}
              </div>
            </details>
          `).join('')}

          ${allSigned && isPrincipal && rep.status === 'pending_approval' ? `
            <div style="margin-top:16px;padding:12px;background:rgba(218,165,32,0.10);border:1px solid rgba(218,165,32,0.25);border-radius:8px">
              <div style="font-size:13px;color:#8a6415;margin-bottom:10px">All 3 sections signed. Ready for your approval. PDF will be generated on approval.</div>
              <button class="btn-primary" onclick="APP.principalApproveWeekly(${rep.id})">Approve & Generate PDF</button>
            </div>
          ` : ''}
        </div>`;
    }
    el.innerHTML = html;
  },

  async saveSignoffSection(reportId, section) {
    const content = document.getElementById(`ws-${reportId}-${section}`).value;
    const res = await API.post(`/weekly-signoff/${reportId}/edit-section`, { section, content });
    if (res?.success) UI.toast('Saved ✓');
    else UI.toast(res?.error || 'Failed');
  },

  async signSignoffSection(reportId, section) {
    // Save first, then sign
    await APP.saveSignoffSection(reportId, section);
    const res = await API.post(`/weekly-signoff/${reportId}/sign`, { section });
    if (res?.success) { UI.toast(res.message || 'Signed ✓'); APP.renderWeeklySignoff(); }
    else UI.toast(res?.error || 'Failed');
  },

  async principalApproveWeekly(reportId) {
    if (!confirm('Approve this weekly report? PDF will be generated and photos will be locked.')) return;
    const res = await API.post(`/weekly-signoff/${reportId}/principal-approve`);
    if (res?.success) { UI.toast(res.message || 'Approved ✓'); APP.renderWeeklySignoff(); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── PHOTO TAG REVIEW (stream audit view)
  async renderPhotoTagReview() {
    const el = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.get(`/photo-tags/disputes/${pid}`).catch(() => null);
    const suggestions = data?.suggestions || [];

    const confColor = c => c === 'high' ? 'var(--green)' : c === 'medium' ? 'var(--amber)' : 'var(--muted)';

    let html = `<div class="sec-label">Photo Review — AI Suggestions</div>`;

    if (!suggestions.length) {
      html += `<div class="card" style="text-align:center;padding:32px 16px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:10px">✓</div>
        <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:6px">All caught up</div>
        <div style="font-size:13px;line-height:1.5">AI suggestions appear here after photos are uploaded.<br>Photos need an active schedule to generate suggestions.</div>
      </div>`;
      el.innerHTML = `<div class="fade-in">${html}</div>`;
      return;
    }

    html += `<div style="font-size:12px;color:var(--muted);margin-bottom:12px">${suggestions.length} photo${suggestions.length>1?'s':''} awaiting review</div>`;

    for (const s of suggestions) {
      const dateStr = s.photo_date || s.uploaded_at?.split('T')[0] || '';
      const capEsc  = (s.ai_caption||'').replace(/'/g,"\\'");
      html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
        <div style="display:flex;gap:14px;padding:14px 16px;align-items:flex-start">
          <img src="${API.fileUrl(s.file_url || s.file_path, 'photos')}"
               style="width:80px;height:80px;object-fit:cover;border-radius:var(--r2);flex-shrink:0;background:var(--bg)"
               onerror="this.style.opacity='0.3'">
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px">${dateStr}</div>
            <div style="background:var(--bg);border-radius:var(--r2);padding:10px;border-left:3px solid var(--amber)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--amber)">AI suggests</div>
                <span style="font-size:10px;font-weight:600;color:${confColor(s.ai_confidence)};text-transform:uppercase">${s.ai_confidence||'low'} confidence</span>
              </div>
              <div style="font-weight:600;font-size:13px;color:var(--navy)">${UI.escapeText(s.ai_task_name||'Unknown task')}</div>
              ${s.ai_trade ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${UI.escapeText(s.ai_trade)}</div>` : ''}
              ${s.ai_caption ? `<div style="font-size:12px;color:var(--text);margin-top:6px;font-style:italic">"${UI.escapeText(s.ai_caption)}"</div>` : ''}
              ${s.ai_note ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${UI.escapeText(s.ai_note)}</div>` : ''}
            </div>
            ${s.human_task_name ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">Previously tagged: <strong>${UI.escapeText(s.human_task_name)}</strong></div>` : ''}
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding:10px 16px;background:var(--bg);display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-sm approve" onclick="APP.acceptAITag(${s.photo_id},${s.ai_task_id},'${capEsc}')">Accept</button>
          <button class="btn-sm" onclick="APP.correctPhotoTag(${s.photo_id},${s.ai_task_id})">Correct</button>
          <button class="btn-sm reject" onclick="APP.dismissAITag(${s.photo_id})">Dismiss</button>
        </div>
      </div>`;
    }
    el.innerHTML = `<div class="fade-in">${html}</div>`;
  },

  async acceptAITag(photoId, taskId, caption) {
    const res = await API.post(`/photo-tags/${photoId}`, { task_id: taskId, caption });
    if (res?.success) { UI.toast('Accepted ✓'); APP.renderPhotoTagReview(); }
    else UI.toast(res?.error || 'Failed');
  },

  async dismissAITag(photoId) {
    // Save a human tag with task_id = null to clear it from the review queue
    const res = await API.post(`/photo-tags/${photoId}`, { task_id: null, caption: '' });
    if (res?.success) { UI.toast('Dismissed'); APP.renderPhotoTagReview(); }
    else UI.toast(res?.error || 'Failed');
  },

  async correctPhotoTag(photoId, currentAiTaskId) {
    // Fetch today's tasks so user can pick the right one
    const pid = APP.state.selectedProject;
    const tasksData = await API.get(`/schedule/${pid}/tasks/active`).catch(() => null);
    const tasks = tasksData?.tasks || [];
    UI.showModal('Correct Task Tag', `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Select the correct schedule task for this photo.</div>
      <select id="correct-task-select" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg);color:var(--text);margin-bottom:12px">
        <option value="">— Select task —</option>
        ${tasks.map(t => `<option value="${t.id}" ${t.id===currentAiTaskId?'selected':''}>${UI.escapeText(t.task_name)} · ${UI.escapeText(t.trade||'')}</option>`).join('')}
      </select>
      <input id="correct-caption" type="text" placeholder="Caption (optional)"
        style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;margin-bottom:12px">
      <button class="btn-primary" style="width:100%" onclick="APP._saveCorrection(${photoId})">Save Correction</button>
    `);
  },

  async _saveCorrection(photoId) {
    const taskId  = document.getElementById('correct-task-select')?.value;
    const caption = document.getElementById('correct-caption')?.value?.trim() || '';
    if (!taskId) { UI.toast('Select a task'); return; }
    const res = await API.post(`/photo-tags/${photoId}`, { task_id: parseInt(taskId), caption });
    if (res?.success) { UI.closeModal(); UI.toast('Correction saved ✓'); APP.renderPhotoTagReview(); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── QUERIES (PMC)
  async renderQueries() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getQueries(pid);
    const queries = data?.queries || [];
    const overdue = queries.filter(q => q.status !== 'closed' && q.days_open >= 3);
    const fresh   = queries.filter(q => q.status !== 'closed' && q.days_open < 3);
    const resolved= queries.filter(q => q.status === 'closed');

    let html = APP._projectSelectHtml('APP.renderQueries()');
    if (overdue.length) { html += `<div class="sec-label">Overdue — 3+ Days</div>`; overdue.forEach(q => { html += APP.queryCard(q, true); }); }
    if (fresh.length)   { html += `<div class="sec-label">Open — Within 3 Days</div>`; fresh.forEach(q => { html += APP.queryCard(q, true); }); }
    if (resolved.length){ html += `<div class="sec-label" style="margin-top:20px">Resolved</div>`; resolved.forEach(q => { html += APP.queryCard(q, false); }); }
    if (!queries.length) html = UI.empty('','No queries');

    el.innerHTML = html;
  },

  async renderQueriesSite() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getQueries(pid);
    const queries = data?.queries || [];
    let html = APP._projectSelectHtml('APP.renderQueriesSite()') + `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="sec-label" style="margin:0">Queries & RFIs</div>
      <button class="btn-primary" onclick="APP.showRaiseQueryModal(${pid})">+ Raise Query</button>
    </div>`;
    queries.forEach(q => { html += APP.queryCard(q, false); });
    if (!queries.length) html += UI.empty('','No queries raised yet — tap + to ask the design or services team');
    el.innerHTML = html;
  },

  queryCard(q, canAct) {
    const overdue = q.days_open >= 3 && q.status !== 'closed';
    const cls = q.status === 'closed' ? 'resolved' : overdue ? 'overdue' : 'fresh';
    return `<div class="query-item ${cls}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div class="qi-drawing">${q.drawing_number} ${q.revision||''}</div>
          <div class="qi-question">${q.question}</div>
        </div>
        ${q.status==='closed'?'<span class="badge b-green">Resolved</span>':overdue?`<span class="badge b-red">${q.days_open}d</span>`:`<span class="badge b-amber">${q.days_open}d</span>`}
      </div>
      <div class="qi-meta">${q.project_name||''} · ${q.raised_by_name||''} · ${q.raised_at?.split('T')[0]||''}</div>
      ${q.rfi_response?`<div class="qi-answer"><div style="font-family:var(--mono);font-size:9px;color:#60a870;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Resolution · ${q.rfi_responded_by_name||''}</div>${q.rfi_response}</div>`:''}
      ${canAct && q.status !== 'closed' ? `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        ${q.status==='open'?`<button class="btn-sm" onclick="APP.assignQuery(${q.id})">Assign to ${q.stream} team</button>`:''}
        <button class="btn-sm approve" onclick="APP.closeQuery(${q.id})">Add Answer & Close</button>
      </div>` : ''}
    </div>`;
  },

  async assignQuery(id) {
    const res = await API.assignQuery(id);
    if (res?.success) { UI.toast('Assigned ✓'); APP.renderQueries(); }
  },

  async closeQuery(id) {
    UI.openModal('Resolve Query', `
      <div class="field-row"><label class="field-label" for="resolve-text">Resolution / Answer</label>
        <textarea id="resolve-text" rows="4" placeholder="Clear resolution. Reference drawing or clause if applicable…"></textarea>
      </div>
      <button class="btn-primary" onclick="APP.submitClose(${id})">Close Query</button>
    `);
  },

  async submitClose(id) {
    const note = document.getElementById('resolve-text')?.value.trim();
    if (!note) { UI.toast('Enter resolution'); return; }
    const res = await API.closeQuery(id, note);
    if (res?.success) { UI.closeModal(); UI.toast('Query closed ✓'); APP.renderQueries(); }
  },

  // ── QUERY RAISING (generic — from any source: task, drawing, etc.)
  showRaiseQueryModal(projectId, prefill) {
    const p = prefill || {};
    const dedupWired = APP.state.aiToggles?.similar_query_dedup;
    const dedupHandler = dedupWired ? ` onblur="APP.checkSimilarQueries(this.value,${projectId})"` : '';
    UI.openModal('Raise Query', `
      <div class="field-row"><label class="field-label" for="rq-subject">Subject</label>
        <input type="text" id="rq-subject" placeholder="Brief subject" value="${UI.escapeAttr(p.subject||'')}">
      </div>
      <div class="field-row"><label class="field-label" for="rq-body">Details</label>
        <textarea id="rq-body" rows="4" placeholder="Clear description with references"${dedupHandler}>${p.body||''}</textarea>
      </div>
      <div id="similar-queries-container" style="display:none;margin-bottom:10px"></div>
      <div class="field-row"><label class="field-label" for="rq-stream">Stream</label>
        <select id="rq-stream">
          <option value="design">Design</option>
          <option value="services">Services</option>
          <option value="site">Site</option>
        </select>
      </div>
      <button class="btn-primary" onclick="APP.submitRaiseQuery(${projectId})">Raise Query</button>
    `);
  },

  async submitRaiseQuery(projectId) {
    const subject = document.getElementById('rq-subject')?.value.trim();
    const body    = document.getElementById('rq-body')?.value.trim();
    const stream  = document.getElementById('rq-stream')?.value;
    if (!subject || !body) { UI.toast('Subject and details required'); return; }
    const res = await API.raiseQuery(projectId, { subject, body, stream });
    if (res?.success) { UI.closeModal(); UI.toast('Query raised ✓'); APP.renderQueries(); }
    else UI.toast(res?.error || 'Failed to raise query');
  },

  raiseQueryFromTask(taskId, taskName, projectId) {
    APP.showRaiseQueryModal(projectId, {
      subject: `Query on task: ${taskName}`,
      body: `Re. task #${taskId} — ${taskName}\n\n`,
    });
  },

  // ── FEE SCHEDULE UPLOAD (principal only)
  showFeeScheduleUpload(projectId) {
    UI.openModal('Upload Fee Schedule', `
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
        Upload an Excel file with columns: <span style="font-family:var(--mono);font-size:11px;background:var(--surface);padding:1px 6px;border-radius:4px">Stage</span>,
        <span style="font-family:var(--mono);font-size:11px;background:var(--surface);padding:1px 6px;border-radius:4px">Percentage</span>,
        <span style="font-family:var(--mono);font-size:11px;background:var(--surface);padding:1px 6px;border-radius:4px">Contract Value</span>.
        Milestones are created automatically.
      </div>
      <div class="field-row">
        <label class="field-label">Excel File *</label>
        <input type="file" id="fs-file" accept=".xlsx,.xls">
      </div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn-primary" onclick="APP.uploadFeeSchedule(${projectId})">Upload</button>
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
      </div>
    `);
  },

  async uploadFeeSchedule(projectId) {
    const file = document.getElementById('fs-file')?.files?.[0];
    if (!file) { UI.toast('Choose an Excel file'); return; }
    const fd = new FormData();
    fd.append('fee_schedule', file);
    const res = await API.call('POST', `/invoices/${projectId}/fee-schedule/upload`, fd, true);
    if (res?.success) {
      UI.closeModal();
      UI.toast(`Fee schedule uploaded — ${res.items_imported||0} milestones created`);
      if (APP.renderBudget) APP.renderBudget();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
  },


  // ── MATERIALS
  async renderMaterials() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const [reqData, boqData, versionData] = await Promise.all([
      API.getRequests(pid),
      API.getBOQ(pid),
      API.call('GET', `/materials/${pid}/boq/versions`),
    ]);
    const requests = reqData?.requests || [];
    const byTrade  = boqData?.byTrade  || {};
    const boqItems = boqData?.items    || [];
    const versions = versionData?.versions || [];

    // Current version label per stream (if any)
    const currentByStream = {};
    versions.filter(v => v.is_current).forEach(v => { currentByStream[v.stream] = v; });
    const currentDesign   = currentByStream.design;
    const currentServices = currentByStream.services;
    const canEditBOQ = ['design_head','services_head','principal','design_principal'].includes(APP.user.role);

    let html = APP._projectSelectHtml('APP.renderMaterials()');

    // ── New Request button
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showRaiseRequest(${pid})">
      <span style="display:flex;align-items:center;justify-content:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Material Request
      </span>
    </button>`;

    // ── BOQ card — icon header + stream version metrics + footer actions
    const boqTotalItems = (currentDesign?.item_count || 0) + (currentServices?.item_count || 0);
    html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:14px;padding:16px">
        <div style="width:44px;height:44px;border-radius:10px;background:rgba(29,61,98,0.10);color:var(--navy);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--navy)">Bill of Quantities</div>
          <div style="display:flex;gap:20px;margin-top:7px">
            <div>
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Design</div>
              <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:2px;font-family:var(--mono)">${currentDesign ? `${currentDesign.label} · ${currentDesign.item_count} items` : '—'}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Services</div>
              <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:2px;font-family:var(--mono)">${currentServices ? `${currentServices.label} · ${currentServices.item_count} items` : '—'}</div>
            </div>
          </div>
        </div>
        ${canEditBOQ ? `<button class="btn-sm" onclick="APP.showBOQVersions(${pid})" style="flex-shrink:0">Versions</button>` : ''}
      </div>
      ${canEditBOQ ? `
      <div style="border-top:1px solid var(--border);display:flex">
        <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer;border-right:1px solid var(--border);background:var(--bg)">
          <input type="file" id="boq-file" accept=".xlsx,.xls" style="display:none" onchange="APP.uploadBOQ(${pid},this)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload New BOQ
        </label>
        <button style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;font-size:13px;font-weight:600;color:var(--text);background:var(--bg);border:none;cursor:pointer" onclick="APP.showAddBOQItem(${pid})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Item
        </button>
      </div>` : ''}
    </div>`;

    // ── BOQ Items grouped by trade — single card with dividers per group
    if (canEditBOQ && boqItems.length) {
      const byTradeList = {};
      boqItems.filter(i => !i.is_section).forEach(i => {
        if (!byTradeList[i.trade]) byTradeList[i.trade] = [];
        byTradeList[i.trade].push(i);
      });
      const tradeNames = Object.keys(byTradeList).sort();
      if (tradeNames.length) {
        html += `<div class="sec-label">BOQ Items (current version)</div>`;
        tradeNames.forEach(trade => {
          const items = byTradeList[trade];
          html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
            <div style="padding:8px 16px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:11px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:0.5px">${UI.escapeText(trade)}</span>
              <span style="font-size:11px;color:var(--muted)">${items.length} item${items.length!==1?'s':''}</span>
            </div>`;
          items.forEach((item, idx) => {
            html += `<div style="display:flex;align-items:center;gap:12px;padding:11px 16px${idx>0?';border-top:1px solid var(--border)':''}">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;color:var(--text)">${UI.escapeText(item.item_name)}</div>
                <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px">${item.item_code ? UI.escapeText(item.item_code)+' · ' : ''}${item.quantity||0} ${UI.escapeText(item.unit||'')}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn-sm" onclick="APP.showEditBOQItem(${pid},${item.id})" style="padding:5px 10px" title="Edit">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-sm" onclick="APP.deleteBOQItem(${pid},${item.id},'${UI.escapeAttr(item.item_name)}')" style="padding:5px 10px;color:var(--red)" title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>`;
          });
          html += `</div>`;
        });
      }
    }

    const overdue = requests.filter(r => r.is_overdue);
    const active  = requests.filter(r => !r.is_overdue);

    if (overdue.length) { html += `<div class="sec-label">Overdue Requests</div>`; overdue.forEach(r => { html += APP.matCard(r, true); }); }
    if (active.length)  { html += `<div class="sec-label">Active Requests</div>`;  active.forEach(r => { html += APP.matCard(r, false); }); }
    if (!requests.length) html += UI.empty('','No material requests yet');

    el.innerHTML = html;
  },

  async renderMaterialsSite() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','No project assigned'); return; }

    const [reqData] = await Promise.all([API.getRequests(pid)]);
    const requests = reqData?.requests || [];
    let html = APP._projectSelectHtml('APP.renderMaterialsSite()');
    html += `<button class="btn-primary" style="margin-bottom:16px" onclick="APP.showRaiseRequest(${pid})">+ New Request</button>`;
    requests.forEach(r => { html += APP.matCard(r, r.is_overdue); });
    if (!requests.length) html += UI.empty('','No material requests yet');
    el.innerHTML = html;
  },

  matCard(r, isOverdue) {
    const step = (r.status || 1) - 1;
    const canAdvance = ['pmc_head','principal','design_principal'].includes(APP.user.role) && r.status < 5;
    const borderStyle = isOverdue ? 'border-left:3px solid var(--red)' : '';
    return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px;${borderStyle}">
      <div style="padding:14px 16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(r.item_name)}</div>
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;font-weight:600">${UI.escapeText(r.trade)} · ${UI.escapeText(r.unit)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            ${isOverdue ? '<span class="badge b-red">OVERDUE</span>' : ''}
            <span style="font-size:12px;font-weight:700;color:var(--navy);background:rgba(12,50,180,0.08);padding:4px 10px;border-radius:6px;font-family:var(--mono);white-space:nowrap">${r.quantity_needed} ${UI.escapeText(r.unit)}</span>
          </div>
        </div>
        <div style="font-size:12px;color:${isOverdue?'var(--red)':'var(--muted)'};margin-bottom:4px">
          <span style="font-weight:600">Needed by</span> ${UI.fmtDate(r.needed_by_date)}
        </div>
        <div class="status-track">
          ${MAT_STATUSES.map((s,i)=>`<div class="st-step${i<step+1?' done':''}${i===step?' current':''}">
            <div class="st-dot">${i<step+1?'✓':''}</div>
            <div class="st-label">${{'Requested':'Req','Ordered':'Ord','Dispatched':'Disp','Received':'Rcvd','Checked & Validated':'Done'}[s]||s.split(' ')[0]}</div>
          </div>`).join('')}
        </div>
      </div>
      ${canAdvance ? `
      <div style="border-top:1px solid var(--border);padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;background:var(--bg)">
        <span style="font-size:11px;color:var(--muted);font-weight:600;align-self:center;text-transform:uppercase;letter-spacing:0.4px">Advance to:</span>
        ${MAT_STATUSES.slice(r.status).map((s,i)=>`<button class="btn-sm" onclick="APP.updateMatStatus(${r.id},${r.status+i+1})" style="font-size:12px">${s}</button>`).join('')}
      </div>` : ''}
    </div>`;
  },

  showRaiseRequest(pid) {
    API.getBOQ(pid).then(data => {
      const byTrade = data?.byTrade || {};
      const tradeOpts = Object.keys(byTrade).map(t=>`<option value="${UI.escapeAttr(t)}">${UI.escapeText(t)}</option>`).join('');
      UI.openModal('New Material Request', `
        <div class="field-row"><label class="field-label" for="mat-trade">Trade</label>
          <select id="mat-trade" onchange="APP.updateItemDropdown()">${tradeOpts}</select>
        </div>
        <div class="field-row"><label class="field-label" for="mat-item">Item</label>
          <select id="mat-item"></select>
        </div>
        <div class="field-row"><label class="field-label" for="mat-qty">Quantity</label>
          <input type="text" id="mat-qty" placeholder="e.g. 120"></div>
        <div class="field-row"><label class="field-label" for="mat-date">Needed By</label>
          <input type="date" id="mat-date"></div>
        <button class="btn-primary" onclick="APP.submitMatRequest(${pid})">Raise Request</button>
      `);
      APP._boqByTrade = byTrade;
      setTimeout(() => APP.updateItemDropdown(), 100);
    });
  },

  updateItemDropdown() {
    const trade = document.getElementById('mat-trade')?.value;
    const items = APP._boqByTrade?.[trade] || [];
    const el = document.getElementById('mat-item');
    if (el) el.innerHTML = items.map(i=>`<option value="${i.id}">${UI.escapeText(i.item_name)} (${UI.escapeText(i.unit)})</option>`).join('');
  },

  async submitMatRequest(pid) {
    const boq_item_id    = document.getElementById('mat-item')?.value;
    const quantity_needed= document.getElementById('mat-qty')?.value;
    const needed_by_date = document.getElementById('mat-date')?.value;
    if (!boq_item_id || !quantity_needed || !needed_by_date) { UI.toast('Fill all fields'); return; }
    const res = await API.raiseRequest(pid, { boq_item_id, quantity_needed, needed_by_date });
    if (res?.success) { UI.closeModal(); UI.toast('Request raised ✓'); APP.renderMaterials(); }
    else UI.toast(res?.error || 'Failed');
  },

  async updateMatStatus(id, status) {
    await API.updateStatus(id, status);
    UI.toast(`Status updated: ${MAT_STATUSES[status-1]}`);
    APP.renderMaterials();
  },

  async uploadBOQ(pid, input) {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('boq', file);
    const res = await API.uploadBOQ(pid, fd);
    if (res?.success) { UI.toast(`BOQ uploaded — ${res.items_imported} items imported ✓`); APP.renderMaterials(); }
    else UI.toast(res?.error || 'Upload failed');
  },

  // ── APPROVALS
  async renderApprovals() {
    const el   = UI.contentEl();
    const data = await API.getApprovals();
    const approvals = data?.approvals || [];
    const isPrincipal = ['principal','design_principal'].includes(APP.user.role);
    const isPMC = APP.user.role === 'pmc_head';

    let html = '';

    if (isPMC) {
      html += `<div class="sec-label">Raise Request</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:20px">
          ${[['📅','Schedule Change','schedule_change'],['📊','Weekly Report','weekly_report']].map(([ic,lb,tp])=>`
            <button onclick="APP.showRaiseApproval('${tp}','${lb}')" style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:14px 10px;cursor:pointer;text-align:left">
              <div style="font-size:20px;margin-bottom:4px">${ic}</div>
              <div style="font-size:11px;font-weight:600;color:var(--text)">${lb}</div>
            </button>`).join('')}
        </div>`;
    }

    const pending = approvals.filter(a => a.status === 'pending');
    const done    = approvals.filter(a => a.status !== 'pending');

    if (pending.length) {
      html += `<div class="sec-label">Pending <span style="color:var(--red);margin-left:4px">(${pending.length})</span></div>`;
      pending.forEach(a => {
        // Eligibility:
        //   - legacy rows (source='legacy'): only principals can approve
        //   - unified rows (source='unified'): backend pendingForUser already
        //     filtered to rows this user can vote on, so canAct=true
        const canAct = a.source === 'unified' ? true : isPrincipal;
        html += APP.approvalCard(a, canAct);
      });
    }
    if (done.length) {
      html += `<div class="sec-label" style="margin-top:20px">Completed</div>`;
      done.forEach(a => { html += APP.approvalCard(a, false); });
    }
    if (!approvals.length) html += UI.empty('','No approvals');

    el.innerHTML = html;
  },

  approvalCard(a, canAct) {
    // source: 'unified' → approvals table, vote via /v2/:id/vote
    //         'signoff'  → signoff_instances, actioned via Matrix poll (no in-app buttons)
    const typeKey = a.action_type;
    const icons = {
      schedule_change:'', weekly_report:'', change_notice:'',
      cn_approval:'', vendor_payment:'', vendor_bank_change:'',
      claim_invoice:'', budget_cost_head:'', handover_closure:'',
    };
    const labelMap = {
      schedule_change:'Schedule Change', weekly_report:'Weekly Report',
      change_notice:'Change Notice',
    };
    // Unified rows carry their own label from approval_type_config
    const headerLabel = a.label || labelMap[typeKey] || typeKey;
    const headerIcon  = icons[typeKey] || '📄';
    const raisedByName = a.raised_by_name || a.user_id_name || '—';
    const raisedDate = (a.raised_at && typeof a.raised_at === 'string')
      ? a.raised_at.split('T')[0]
      : (a.raised_at ? new Date(a.raised_at).toISOString().split('T')[0] : '');

    // Quorum indicator on unified multi-signer approvals
    const quorumBadge = (isUnified && a.quorum && a.quorum > 1)
      ? `<span class="badge b-amber" style="margin-left:6px;font-size:10px">Multi-signer · ${a.quorum} signers needed</span>`
      : '';

    // Dispatch buttons: unified rows get in-app approve/reject; signoff rows
    // are actioned via Matrix poll — no in-app buttons.
    let actionsHtml = '';
    if (canAct && a.status === 'pending' && a.source === 'unified') {
      actionsHtml = `<div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-approve" onclick="APP.voteApprovalV2(${a.id},'approve')">Approve</button>
        <button class="btn-reject"  onclick="APP.voteApprovalV2(${a.id},'reject')">Reject</button>
      </div>`;
    }

    return `<div class="card">
      <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">
        ${headerIcon} ${headerLabel}${quorumBadge}
      </div>
      <div class="card-title">${UI.escapeText(a.title || '')}</div>
      <div class="card-meta">${UI.escapeText(a.project_name || '—')} · ${UI.escapeText(raisedByName)} · ${raisedDate}${a.drift_days?` · Drift: +${a.drift_days}d`:''}</div>
      ${a.details?`<div style="font-size:11px;color:var(--muted);margin-top:6px;padding:7px 9px;background:var(--bg);border-radius:var(--r);line-height:1.5;border:1px solid var(--border)">${UI.escapeText(a.details)}</div>`:''}
      ${a.status==='approved'?`<div style="margin-top:8px"><span class="badge b-green">Approved ✓</span></div>`:''}
      ${a.status==='rejected'?`<div style="margin-top:8px"><span class="badge b-red">Rejected</span> <span style="font-size:10px;color:var(--muted)">${UI.escapeText(a.rejection_note||'')}</span></div>`:''}
      ${actionsHtml}
    </div>`;
  },

  // v2 vote dispatcher (unified path). Confirms before acting and refreshes
  // the dashboard. Reject prompts for a comment; approve doesn't require one.
  async voteApprovalV2(id, vote) {
    if (vote === 'reject') {
      const note = await UI.prompt('Reason for rejection');
      if (!note) return;
      const res = await API.voteApprovalV2(id, 'reject', note);
      if (res?.success) {
        UI.toast(res.newStatus === 'rejected' ? 'Rejected' : 'Vote recorded');
        APP.renderApprovals();
      } else {
        UI.toast(res?.error || 'Failed');
      }
    } else {
      const ok = await UI.confirm('Approve this request?');
      if (!ok) return;
      const res = await API.voteApprovalV2(id, 'approve');
      if (res?.success) {
        // Multi-signer: don't say "Approved" until quorum is actually reached
        if (res.newStatus === 'approved') {
          UI.toast('Approved ✓');
        } else if (res.quorumProgress) {
          UI.toast(`Vote recorded (${res.quorumProgress.approves}/${res.quorumProgress.quorum})`);
        } else {
          UI.toast('Vote recorded');
        }
        APP.renderApprovals();
      } else {
        UI.toast(res?.error || 'Failed');
      }
    }
  },

  showRaiseApproval(type, label) {
    const pid = APP.state.selectedProject;
    if (!pid) { UI.toast('Select a project first'); return; }
    UI.openModal(`Raise: ${label}`, `
      <div class="field-row"><label class="field-label" for="ap-title">Title</label><input type="text" id="ap-title" placeholder="${label} request"></div>
      <div class="field-row"><label class="field-label" for="ap-details">Details</label><textarea id="ap-details" rows="3" placeholder="Describe the request…"></textarea></div>
      ${type==='schedule_change'?`<div class="field-row"><label class="field-label" for="ap-drift">Drift Days from R0</label><input type="text" id="ap-drift" placeholder="e.g. 5"></div>`:''}
      <button class="btn-primary" onclick="APP.submitApproval('${type}',${pid})">Submit Request</button>
    `);
  },

  async submitApproval(type, pid) {
    const title   = document.getElementById('ap-title')?.value.trim();
    const details = document.getElementById('ap-details')?.value.trim();
    const drift   = document.getElementById('ap-drift')?.value;
    if (!title) { UI.toast('Enter a title'); return; }
    const res = await API.raiseApproval({ project_id: pid, action_type: type, message_sent: title + (details ? ' — ' + details : ''), drift_days: drift||null });
    if (res?.success) { UI.closeModal(); UI.toast('Request raised ✓'); APP.renderApprovals(); }
    else UI.toast(res?.error || 'Failed');
  },

  async approveRequest(id) {
    const ok = await UI.confirm('Approve this request?');
    if (!ok) return;
    const res = await API.approve(id);
    if (res?.success) { UI.toast('Approved ✓'); APP.renderApprovals(); }
  },

  async rejectRequest(id) {
    const note = await UI.prompt('Reason for rejection');
    if (!note) return;
    const res = await API.reject(id, note);
    if (res?.success) { UI.toast('Rejected — sent back'); APP.renderApprovals(); }
  },

  // ── CHANGES
  async renderChanges() {
    const el  = UI.contentEl();
    const role = APP.user?.role || APP.user?.real_role;
    const isFirmWide = ['principal','design_principal','pmc_head','design_head','services_head'].includes(role);

    let data, pid;
    if (isFirmWide) {
      data = await API.get('/changes/all');
    } else {
      pid = APP._ensurePid();
      if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
      data = await API.getChanges(pid);
    }
    const changes = data?.changes || [];

    let html = isFirmWide ? '' : APP._projectSelectHtml('APP.renderChanges()');
    if (['principal','design_principal'].includes(role)) {
      html += `<button class="btn-primary" style="margin-bottom:16px" onclick="APP.showRaiseChange(${pid || 0})">+ New Change Notice</button>`;
    }

    if (!changes.length) {
      html += UI.empty('','No change notices pending');
    } else {
      changes.forEach(c => {
        const allSigned  = c.sig_design_head && c.sig_services_head && c.sig_pmc;
        const canSign    = ['design_head','services_head','pmc_head'].includes(role);
        const canApprove = ['principal','design_principal'].includes(role) && allSigned;
        const myTurnSign = canSign && !allSigned;

        const sigDot = (signed) => `<div style="display:flex;align-items:center;gap:5px">
          <div style="width:18px;height:18px;border-radius:50%;background:${signed?'var(--green)':'var(--border)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${signed?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`:''}
          </div>`;

        html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px${myTurnSign?';border-color:var(--steel)':''}">
          <div style="padding:14px 16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--navy);margin-bottom:4px">${UI.escapeText(c.cn_number)}</div>
                <div style="font-weight:600;font-size:14px;color:var(--text);line-height:1.35">${UI.escapeText(c.title)}</div>
                ${c.project_name ? `<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:3px">${UI.escapeText(c.project_code||'')} · ${UI.escapeText(c.project_name)}</div>` : ''}
              </div>
              <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0;background:${allSigned?'rgba(230,172,0,0.12)':'rgba(66,99,235,0.1)'};color:${allSigned?'var(--amber)':'var(--navy)'}">${allSigned?'PENDING APPROVAL':'COLLECTING SIGS'}</span>
            </div>
            ${c.description ? `<div style="font-size:12px;color:var(--muted);font-style:italic;padding:7px 10px;background:var(--bg);border-radius:6px;border-left:2px solid var(--border);margin-bottom:8px;line-height:1.5">${UI.escapeText((c.description||'').substring(0,120))}${(c.description||'').length>120?'…':''}</div>` : ''}
            <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">
              <div style="font-size:11px;color:var(--muted)"><span style="font-weight:600;color:var(--text)">Source</span> ${UI.escapeText(c.source||'—')}</div>
              ${c.schedule_impact_days ? `<div style="font-size:11px;color:var(--amber);font-weight:600">+${c.schedule_impact_days}d schedule</div>` : ''}
              ${c.affected_drawings ? `<div style="font-size:11px;color:var(--muted)"><span style="font-weight:600;color:var(--text)">Drawings</span> ${UI.escapeText(c.affected_drawings)}</div>` : ''}
              <div style="font-family:var(--mono);font-size:11px;color:var(--muted)">${UI.escapeText(c.raised_by_name||'—')} · ${c.raised_at?.split('T')[0]||''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${[['Design Head',c.sig_design_head],['Services Head',c.sig_services_head],['PMC',c.sig_pmc]].map(([label,signed]) =>
                `<div style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:${signed?'rgba(12,166,120,0.1)':'var(--bg)'};border:1px solid ${signed?'var(--green)':'var(--border)'}">
                  <div style="width:14px;height:14px;border-radius:50%;background:${signed?'var(--green)':'var(--border)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    ${signed?`<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`:''}
                  </div>
                  <span style="font-size:11px;font-weight:600;color:${signed?'var(--green)':'var(--muted)'}">${label}</span>
                </div>`
              ).join('')}
            </div>
          </div>
          ${(myTurnSign || canApprove) ? `<div style="border-top:1px solid var(--border);padding:10px 16px;background:var(--bg);display:flex;gap:8px">
            ${myTurnSign ? `<button class="btn-sm approve" onclick="APP.signChange(${c.id})">Sign Off</button>` : ''}
            ${canApprove ? `<button class="btn-sm approve" onclick="APP.approveChange(${c.id})">Approve</button><button class="btn-sm reject" onclick="APP.rejectChange(${c.id})">Reject</button>` : ''}
          </div>` : ''}
        </div>`;
      });
    }
    el.innerHTML = html;
  },

  showRaiseChange(pid) {
    const projName = APP._projectName(APP.state.selectedProject) || '';
    UI.openModal('New Change Notice', `
      <div class="field-row"><label class="field-label" for="cn-plain-desc">Describe the change (plain language)</label><textarea id="cn-plain-desc" rows="2" placeholder="e.g. Client wants to add a mezzanine floor in Bay 3…"></textarea></div>
      <button class="btn-secondary" style="margin-bottom:14px" onclick="APP.draftCNText('${projName}')">AI Draft Formal Text</button>
      <div class="field-row"><label class="field-label" for="cn-title">Title</label><input type="text" id="cn-title" placeholder="Brief title"></div>
      <div class="field-row"><label class="field-label" for="cn-source">Source</label>
        <select id="cn-source"><option value="client">Client</option><option value="site">Site Condition</option>
          <option value="design">Design Coordination</option><option value="statutory">Statutory</option></select>
      </div>
      <div class="field-row"><label class="field-label" for="cn-desc">Description</label><textarea id="cn-desc" rows="3" placeholder="Formal CN description…"></textarea></div>
      <div class="field-row"><label class="field-label" for="cn-drawings">Affected Drawings</label><input type="text" id="cn-drawings" placeholder="A-101, E-201…"></div>
      <div class="field-row"><label class="field-label" for="cn-days">Schedule Impact (days)</label><input type="text" id="cn-days" placeholder="0"></div>
      <button class="btn-primary" onclick="APP.submitChange(${pid})">Raise Change Notice</button>
    `);
  },

  async submitChange(pid) {
    const data = {
      title: document.getElementById('cn-title')?.value.trim(),
      source: document.getElementById('cn-source')?.value,
      description: document.getElementById('cn-desc')?.value.trim(),
      affected_drawings: document.getElementById('cn-drawings')?.value.trim(),
      schedule_impact_days: parseInt(document.getElementById('cn-days')?.value||'0'),
    };
    if (!data.title || !data.description) { UI.toast('Fill required fields'); return; }
    const res = await API.raiseChange(pid, data);
    if (res?.success) { UI.closeModal(); UI.toast(`${res.cn_number} raised ✓`); APP.renderChanges(); }
    else UI.toast(res?.error || 'Failed');
  },

  async signChange(id) {
    const res = await API.signChange(id);
    if (res?.success) { UI.toast(res.message || 'Signed ✓'); APP.renderChanges(); }
  },
  async approveChange(id) {
    const ok = await UI.confirm('Approve this change notice?');
    if (!ok) return;
    const res = await API.approveChange(id);
    if (res?.success) { UI.toast('Approved ✓'); APP.renderChanges(); }
  },
  async rejectChange(id) {
    const note = await UI.prompt('Reason for rejection');
    if (!note) return;
    const res = await API.rejectChange(id, note);
    if (res?.success) { UI.toast('Rejected'); APP.renderChanges(); }
  },

  // ── PHOTOS
  async renderPhotos() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (APP._guardInitialisingProject(el, pid)) return;
    const today = APP.state.serverToday || UI.todayIST();
    // Default to today so first load and subsequent loads return the same photos
    if (!APP.state.selectedDate) APP.state.selectedDate = today;
    const date = APP.state.selectedDate;
    if (!pid) { el.innerHTML = UI.empty('','No project assigned'); return; }

    // Filter: 'all' (progress + defects), 'progress' only, 'defects' only.
    // Default is 'all' so users see everything in one place.
    const filter = APP.state.photoFilter || 'all';
    const typesParam = filter === 'progress' ? 'project_progress'
                     : filter === 'defects'  ? 'issue'
                     : 'project_progress,issue';

    const data   = await API.getPhotos(pid, date, typesParam);
    const photos = data?.photos || [];

    // Load dates with notes
    const datesWithNotes = new Set();
    try {
      const listRes = await API.call('GET', `/daily-reports/${pid}`);
      const reports = listRes?.reports || [];
      reports.forEach(r => {
        if (r.overall_notes && r.overall_notes.trim()) {
          let dStr = r.report_date;
          if (dStr) {
            if (typeof dStr === 'string') {
              dStr = dStr.slice(0, 10);
            } else if (dStr instanceof Date) {
              dStr = dStr.toISOString().slice(0, 10);
            }
            datesWithNotes.add(dStr);
          }
        }
      });
    } catch (e) {
      console.warn('Failed to load daily reports list:', e);
    }

    let strip = '<div class="date-strip">';
    for (let i = -3; i <= 3; i++) {
      const d = UI.addDays(today, i);
      const sel = d === date;
      
      let stateClass = '';
      if (i < 0) {
        stateClass = 'past';
      } else if (i === 0) {
        stateClass = 'today';
      } else {
        stateClass = 'future';
      }
      
      const hasNotes = datesWithNotes.has(d);
      
      strip += `<button class="date-chip ${stateClass}${sel ? ' sel' : ''}" onclick="APP.state.selectedDate='${d}';APP.renderPhotos()">
        <div class="dc-day">${i === 0 ? 'Today' : UI.fmtDay(d)}</div>
        <div class="dc-num">${new Date(d + 'T00:00:00').getDate()}</div>
        <div class="dc-dot${hasNotes ? ' has-notes' : ''}"></div>
      </button>`;
    }
    strip += '</div>';

    // Filter chips — All / Progress / Defects
    const chip = (key, label) =>
      `<button class="filter-chip${filter===key?' sel':''}" onclick="APP.state.photoFilter='${key}';APP.renderPhotos()">${label}</button>`;
    const filterRow = `<div style="padding:6px 4px 10px">${chip('all','All')}${chip('progress','Progress')}${chip('defects','Defects')}</div>`;

    const count = photos.length;
    let html = APP._projectSelectHtml('APP.renderPhotos()') + strip + filterRow + `
      <input type="file" id="photo-input" accept="image/*" multiple capture="environment" style="display:none"
        onchange="APP.uploadPhotos(${pid},this)">
      <button class="upload-btn${count?' has-files':''}" onclick="document.getElementById('photo-input').click()"><span class="upload-btn-icon">📷</span><span>${count?`${count} photo${count>1?'s':''} ${filter==='defects'?'with defects':filter==='progress'?'(progress)':'in gallery'} · Tap to add more`:'Tap to Upload Site Photos'}</span></button>`;

    if (photos.length) {
      // Stash for viewer modal to read without another fetch
      APP._photosCache = photos;
      html += `<div class="photo-grid">`;
      photos.forEach((p, i) => {
        // Defect marker — overlay a coloured pip if photo is linked to a defect
        const isDefect = p.entity_type === 'issue' && p.linked_issue?.issue_type === 'snag';
        const sevColor = { critical:'#C84040', major:'#C87060', minor:'#C8A040' };
        const pipColor = isDefect ? (sevColor[p.linked_issue?.severity] || '#C87060') : null;
        const defectPip = isDefect
          ? `<div style="position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:${pipColor};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,0.4)" title="${p.linked_issue?.issue_number||'Defect'}"></div>`
          : '';
        html += `<button style="min-height:44px;position:relative;width:120px;height:120px;cursor:pointer" onclick="APP.openPhotoViewer(${pid}, ${p.id}, ${i})">
          <img src="${API.fileUrl(p.file_url || p.file_path, 'photos')}" alt="Site photo ${i+1}" style="width:120px;height:120px;border-radius:var(--r);object-fit:cover;border:1px solid var(--border)" onerror="this.style.background='var(--bg)'">
          ${defectPip}
          <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.7);font-size:9px;color:#fff;padding:2px 5px;border-radius:3px;font-family:var(--mono)">${i+1}</div>
        </button>`;
      });
      html += `</div>`;
    } else {
      const emptyMsg = filter === 'defects' ? 'No defects raised'
                     : filter === 'progress' ? 'No progress photos'
                     : `No photos for ${date===today?'today':UI.fmtDate(date)}`;
      html += UI.empty('', emptyMsg);
    }
    el.innerHTML = html;
  },

  // PHOTO VIEWER — full-size view of a single photo with action buttons.
  // From here, a user can tap "Flag as defect" to raise a snag linked to
  // this photo via the snag-from-photo workflow (uses entity_photo_links —
  // the photo is NOT duplicated). If the photo is ALREADY a defect photo,
  // shows the linked defect info instead.
  async openPhotoViewer(projectId, photoId, idx) {
    const photo = (APP._photosCache || [])[idx];
    if (!photo) { UI.toast('Photo not found'); return; }
    const uploadedBy = photo.uploaded_by_name || 'Unknown';
    const dateStr = photo.photo_date || '';
    const isDefect = photo.entity_type === 'issue' && photo.linked_issue?.issue_type === 'snag';
    const isProgress = photo.entity_type === 'project_progress';
    const sevColor = { critical:'#C84040', major:'#C87060', minor:'#C8A040' };
    const role = APP.user?.role;

    // Roles that can tag photos to schedule tasks:
    //   site_manager / senior_site_manager — own photos only, 12h window (enforced by backend)
    //   design_head / services_head / team_lead / jr_architect / services_engineer — any photo, no time limit
    const canTag = ['site_manager','senior_site_manager','design_head','services_head',
                    'team_lead','jr_architect','services_engineer'].includes(role);

    let footerHtml = '';
    if (isDefect) {
      const li = photo.linked_issue;
      const col = sevColor[li.severity] || '#C87060';
      const sevLabel = li.severity ? li.severity.charAt(0).toUpperCase() + li.severity.slice(1) : 'Defect';
      footerHtml = `
        <div style="background:rgba(200,112,96,0.08);border:1px solid rgba(200,112,96,0.30);border-left:3px solid ${col};padding:10px 12px;border-radius:var(--r);margin-bottom:10px;display:flex;align-items:center;gap:10px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <div style="font-size:12px;font-weight:700;color:${col}">${sevLabel} · ${li.issue_number||'Defect'}</div>
            ${(li.trade||li.status) ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${[li.trade,li.status].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
        </div>`;
    } else if (isProgress) {
      footerHtml = `
        <div style="background:rgba(12,100,180,0.08);border:1px solid rgba(12,100,180,0.25);border-left:3px solid var(--navy);padding:10px 12px;border-radius:var(--r);margin-bottom:10px;display:flex;align-items:center;gap:10px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <div style="font-size:12px;font-weight:600;color:var(--navy)">Progress Photo</div>
        </div>`;
    } else {
      footerHtml = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn-sm" onclick="APP.flagPhotoAsDefect(${projectId}, ${photoId})" style="background:#C87060;color:#fff">Flag as Defect</button>
          <button class="btn-sm" onclick="APP.markPhotoAsProgress(${projectId}, ${photoId})" style="background:#0056b3;color:#fff">Mark as Progress</button>
        </div>`;
    }

    // Task tag section — fetch current tag + available tasks
    let tagHtml = '';
    if (canTag) {
      const [tagData, tasksData] = await Promise.all([
        API.get(`/photo-tags/${photoId}/history`).catch(() => null),
        API.get(`/schedule/${projectId}/tasks/active`).catch(() => null),
      ]);
      const currentTag = (tagData?.history || []).find(t => t.is_current);
      const tasks = tasksData?.tasks || [];
      const currentTaskName = currentTag?.task_name || null;
      const currentCaption  = currentTag?.caption   || '';

      tagHtml = `
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <span style="font-size:11px;font-weight:600;color:var(--muted)">Task Tag</span>
            ${currentTaskName ? `<span style="font-size:10px;font-family:var(--mono);color:var(--green);background:rgba(12,166,120,0.10);border:1px solid rgba(12,166,120,0.25);padding:1px 7px;border-radius:4px">tagged</span>` : ''}
          </div>
          ${currentTaskName
            ? `<div style="font-size:12px;color:var(--text);font-weight:500;margin-bottom:10px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r)">${UI.escapeText(currentTaskName)}</div>`
            : `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Not tagged to a task yet</div>`}
          ${tasks.length ? `
          <select id="photo-task-select" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;margin-bottom:8px;background:var(--bg);color:var(--text)">
            <option value="">— Select task —</option>
            ${tasks.map(t => `<option value="${t.id}" ${currentTag?.task_id===t.id?'selected':''}>${UI.escapeText(t.task_name)} (${UI.escapeText(t.trade||'')})</option>`).join('')}
          </select>
          <input id="photo-caption-input" type="text" placeholder="Caption (optional)" value="${UI.escapeAttr(currentCaption)}"
            style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;margin-bottom:8px;background:var(--bg);color:var(--text);box-sizing:border-box">
          <button class="btn-sm approve" onclick="APP.savePhotoTag(${photoId})">Save Tag</button>
          ` : `<div style="font-size:12px;color:var(--muted);font-style:italic">No active tasks in the current window to tag against.</div>`}
        </div>`;
    }

    const _dlUrl = API.fileUrl(photo.file_url || photo.file_path, 'photos');
    const _dlName = (photo.file_path || photo.file_url || 'photo').split('/').pop();
    UI.showModal('Photo', `
      <div style="text-align:center;margin-bottom:12px;position:relative">
        <img src="${_dlUrl}" alt="Site photo" style="max-width:100%;max-height:55vh;border-radius:var(--r2);border:1px solid var(--border)">
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:12px;color:var(--muted)">Uploaded by ${uploadedBy} · ${dateStr}</div>
        <a href="${_dlUrl}" download="${_dlName}" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--navy);text-decoration:none;padding:5px 10px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg)" title="Download original">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </a>
      </div>
      ${photo.caption ? `<div style="font-size:13px;margin-bottom:12px">${UI.escapeText(photo.caption)}</div>` : ''}
      ${footerHtml}
      ${tagHtml}
    `);
  },

  async savePhotoTag(photoId) {
    const taskId = document.getElementById('photo-task-select')?.value;
    const caption = document.getElementById('photo-caption-input')?.value?.trim() || '';
    if (!taskId) { UI.toast('Select a task first'); return; }
    const res = await API.post(`/photo-tags/${photoId}`, { task_id: parseInt(taskId), caption });
    if (res?.success) {
      UI.closeModal();
      UI.toast('Tag saved ✓');
    } else {
      UI.toast(res?.error || 'Failed to save tag');
    }
  },

  // Tap "Flag as defect" → shows a small form, calls snag-from-photo
  flagPhotoAsDefect(projectId, photoId) {
    UI.closeModal();   // close the viewer first
    UI.showModal('Flag Defect from Photo', `
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Raising a defect linked to photo #${photoId}. The photo stays in the gallery — a link to this defect is recorded.
      </div>
      <div class="field"><label>Trade</label>
        <select id="fpd-trade">
          ${['Civil','Electrical','HVAC','Plumbing','Interior','IT','Other'].map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Location</label><input id="fpd-location" placeholder="e.g. Level 1 — Room 102"></div>
      <div class="field"><label>Description</label><input id="fpd-desc" placeholder="What's wrong in this photo"></div>
      <div class="field"><label>Severity</label>
        <select id="fpd-sev">
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <button class="btn-primary" onclick="APP.submitFlagDefect(${projectId}, ${photoId})" style="width:100%">Raise Defect</button>
    `);
  },

  async submitFlagDefect(projectId, photoId) {
    const trade       = document.getElementById('fpd-trade')?.value;
    const location    = document.getElementById('fpd-location')?.value;
    const description = document.getElementById('fpd-desc')?.value;
    const severity    = document.getElementById('fpd-sev')?.value;
    if (!description) { UI.toast('Enter description'); return; }
    const res = await API.call('POST', `/issues/${projectId}/snag-from-photo`, {
      photo_id: photoId, trade, location, description, severity,
    });
    if (res?.success) {
      UI.closeModal();
      UI.toast(`Defect ${res.issue_number} raised ✓`);
    } else {
      UI.toast(res?.error || 'Failed to raise defect');
    }
  },

  async markPhotoAsProgress(projectId, photoId) {
    const ok = await UI.confirm('Mark this photo as progress?');
    if (!ok) return;
    const res = await API.call('POST', `/photos/${photoId}/mark-progress`);
    if (res?.success) {
      UI.closeModal();
      UI.toast('Photo marked as progress ✓');
      APP.renderPhotos();
    } else {
      UI.toast(res?.error || 'Failed to mark as progress');
    }
  },

  async uploadPhotos(pid, input) {
    const files = Array.from(input.files);
    if (!files.length) return;

    const filter = APP.state.photoFilter || 'all';

    // If uploading from "all" tab, ask progress vs defect
    if (filter === 'all') {
      APP._pendingUploadFiles = files;
      APP._pendingUploadPid = pid;
      input.value = '';
      UI.showModal('Upload Photos', `
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">${files.length} photo${files.length>1?'s':''} selected · AI will suggest schedule task automatically</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid var(--border);border-radius:var(--r2);cursor:pointer;background:var(--bg)">
            <input type="radio" name="upload-type" value="progress" checked style="accent-color:var(--navy)">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--navy)">Progress</div>
              <div style="font-size:11px;color:var(--muted)">Documents site work</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid var(--border);border-radius:var(--r2);cursor:pointer;background:var(--bg)">
            <input type="radio" name="upload-type" value="defect" style="accent-color:#C87060">
            <div>
              <div style="font-weight:600;font-size:13px;color:#C87060">Defect</div>
              <div style="font-size:11px;color:var(--muted)">Quality issue</div>
            </div>
          </label>
        </div>
        <button class="btn-primary" style="width:100%" onclick="APP._doUploadWithTag()">Upload</button>
      `);
      return;
    }

    // If uploading from progress/defects tab, tag automatically
    const tag = filter === 'defects' ? 'defect' : 'progress';
    const fd = new FormData();
    files.forEach(f => fd.append('photo', f));
    fd.append('source', 'app');
    fd.append('photo_date', APP.state.selectedDate || UI.todayIST());
    fd.append('tag', tag);
    const res = await API.uploadPhoto(pid, fd);
    if (res?.success) {
      UI.toast(`${res.count} photo${res.count>1?'s':''} uploaded ✓`);
      APP.renderPhotos();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
  },

  async _doUploadWithTag() {
    const tag = document.querySelector('input[name="upload-type"]:checked')?.value || 'progress';
    UI.closeModal();
    const files = APP._pendingUploadFiles;
    const pid   = APP._pendingUploadPid;
    if (!files || !pid) return;
    const fd = new FormData();
    files.forEach(f => fd.append('photo', f));
    fd.append('source', 'app');
    fd.append('photo_date', APP.state.selectedDate || UI.todayIST());
    fd.append('tag', tag);
    const res = await API.uploadPhoto(pid, fd);
    if (res?.success) {
      UI.toast(`${res.count} photo${res.count>1?'s':''} uploaded ✓`);
      APP.renderPhotos();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
    APP._pendingUploadFiles = null;
    APP._pendingUploadPid = null;
  },

  // ── DOCUMENTS
  // ── DOCUMENT LIBRARY (V5 Fix 3) ──
  // Shows all project documents grouped by category. Each card has:
  //   - title + category + current version label (v1 / v2 / v3)
  //   - uploaded-by + date
  //   - "History" button → modal listing every version with download
  //   - "+ New version" button → re-upload to same doc (increments version)
  // Top: "+ New document" uploader (creates v1 of a new doc)
  async renderDocuments() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','No project selected'); return; }

    const data = await API.get(`/documents/${pid}`);
    const docs = data?.documents || [];

    // Group by category
    const byCat = {};
    docs.forEach(d => {
      const c = d.category || d.doc_type || 'other';
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(d);
    });

    let html = APP._projectSelectHtml('APP.renderDocuments()') + `
      <div class="sec-label">Document Library</div>
      <input type="file" id="doc-input" accept=".pdf,image/*,.docx,.xlsx,.doc,.xls" style="display:none"
        onchange="APP.uploadNewDocument(${pid}, this)">
      <button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showNewDocumentForm(${pid})">
        + Upload New Document
      </button>`;

    if (!docs.length) {
      html += UI.empty('','No documents yet. Tap above to upload the first one.');
      el.innerHTML = html;
      return;
    }

    const catLabels = {
      contract:'Contracts', drawing:'Drawings', quote:'Quotes', approval:'Approvals',
      statutory:'Statutory', invoice:'Invoices', photo:'Photos', report:'Reports', other:'Other',
    };
    const catOrder = ['contract','approval','statutory','quote','invoice','drawing','report','photo','other'];

    catOrder.forEach(cat => {
      const list = byCat[cat];
      if (!list || !list.length) return;
      html += `<div class="sec-label" style="margin-top:12px">${catLabels[cat] || cat}</div>`;
      list.forEach(d => {
        const sizeKB = Math.round(d.file_size_kb || 0);
        const classified = d.is_classified ? ' 🔒' : '';
        html += `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="flex:1;min-width:0">
                <div class="card-title">${UI.escapeText(d.title || d.file_name)}${classified}</div>
                <div class="card-meta">
                  v${d.current_version_number} · ${sizeKB} KB · ${UI.escapeText(d.uploaded_by_name)} · ${new Date(d.uploaded_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              <span class="badge b-navy">v${d.current_version_number}</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
              <button class="btn-sm" onclick="APP.viewDocumentFile(${d.latest_version_id})">View latest</button>
              <button class="btn-sm navy" onclick="APP.showDocumentHistory(${pid}, ${d.id})">History (${d.current_version_number})</button>
              <button class="btn-sm" onclick="APP.uploadDocumentVersion(${pid}, ${d.id})">+ New version</button>
            </div>
          </div>`;
      });
    });

    el.innerHTML = html;
  },

  // Open a file for viewing (stream from server)
  viewDocumentFile(versionId) {
    window.open(`/api/documents/file/${versionId}`, '_blank');
  },

  // Show a modal with the full version history of one document
  async showDocumentHistory(pid, docId) {
    const r = await API.get(`/documents/${pid}/${docId}/versions`);
    const versions = r?.versions || [];
    if (!versions.length) { UI.toast('No versions found'); return; }

    let body = `<div style="display:flex;flex-direction:column;gap:10px">`;
    versions.forEach(v => {
      const sizeKB = Math.round(v.file_size_kb || 0);
      body += `
        <div class="card" style="margin:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="flex:1;min-width:0">
              <div class="card-title">Version ${v.version_number}${v.version_number === versions[0].version_number ? ' · LATEST' : ''}</div>
              <div class="card-meta">
                ${UI.escapeText(v.file_name)} · ${sizeKB} KB
              </div>
              <div class="card-meta">
                ${UI.escapeText(v.uploaded_by_name)} · ${new Date(v.uploaded_at).toLocaleString('en-IN')}
              </div>
              ${v.change_note ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;font-style:italic">"${UI.escapeText(v.change_note)}"</div>` : ''}
            </div>
            <button class="btn-sm" onclick="APP.viewDocumentFile(${v.id})">View</button>
          </div>
        </div>`;
    });
    body += `</div>`;
    UI.openModal(`Version History`, body);
  },

  // + Upload New Document — prompts for category + title then file picker
  showNewDocumentForm(pid) {
    const body = `
      <div class="field">
        <label class="field-label" for="doc-title">Title (optional)</label>
        <input type="text" id="doc-title" placeholder="e.g. PV 90 Civil Works Contract">
      </div>
      <div class="field">
        <label class="field-label" for="doc-category">Category</label>
        <select id="doc-category">
          <option value="contract">Contract</option>
          <option value="approval">Approval</option>
          <option value="statutory">Statutory</option>
          <option value="quote">Quote</option>
          <option value="invoice">Invoice</option>
          <option value="drawing">Drawing</option>
          <option value="report">Report</option>
          <option value="photo">Photo</option>
          <option value="other" selected>Other</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="doc-notes">Notes (optional)</label>
        <input type="text" id="doc-notes" placeholder="Brief description">
      </div>
      <div class="field">
        <label class="field-label" for="doc-modal-file">File</label>
        <input type="file" id="doc-modal-file" accept=".pdf,image/*,.docx,.xlsx,.doc,.xls" style="width:100%">
      </div>
      <div class="btn-row">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="APP.uploadNewDocument(${pid}, document.getElementById('doc-modal-file'))">Upload</button>
      </div>`;
    UI.openModal('Upload New Document', body);
  },

  async uploadNewDocument(pid, input) {
    const file = input?.files?.[0];
    if (!file) { UI.toast('Choose a file first'); return; }
    const title    = document.getElementById('doc-title')?.value || '';
    const category = document.getElementById('doc-category')?.value || 'other';
    const notes    = document.getElementById('doc-notes')?.value || '';
    const fd = new FormData();
    fd.append('document', file);
    fd.append('title', title);
    fd.append('category', category);
    fd.append('doc_type', 'other');
    fd.append('notes', notes);

    const res = await API.call('POST', `/documents/${pid}`, fd, true);
    if (res?.error) { UI.toast(res.error || 'Upload failed'); return; }
    if (!res?.versionNumber) { UI.toast('Upload failed'); return; }
    UI.closeModal();
    UI.toast(`✓ Uploaded as v${res.versionNumber}`);
    input.value = '';
    (APP._docRefresh || APP.renderDocuments)();
    APP._docRefresh = null;
  },

  // + New version — upload a new revision of an existing document
  uploadDocumentVersion(pid, docId) {
    // Hidden file input per-call so we don't collide with the new-document one
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.pdf,image/*,.docx,.xlsx,.doc,.xls';
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      const changeNote = prompt('What changed in this version? (optional)') || '';
      const fd = new FormData();
      fd.append('document', file);
      fd.append('change_note', changeNote);
      const res = await API.call('POST', `/documents/${pid}/${docId}/versions`, fd, true);
      if (res?.error) { UI.toast(res.error || 'Upload failed'); return; }
      if (!res?.versionNumber) { UI.toast('Upload failed'); return; }
      UI.toast(`✓ Uploaded as v${res.versionNumber}`);
      APP.renderDocuments();
    };
    inp.click();
  },

  // Legacy helper — retained for any callers still using the old flow
  async uploadDoc(pid, input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    for (const file of files) {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('doc_type', 'challan');
      fd.append('category', 'other');
      await API.call('POST', `/documents/${pid}`, fd, true);
    }
    UI.toast(`${files.length} document${files.length>1?'s':''} uploaded ✓`);
    APP.renderDocuments();
  },

  handleMonthlyProjectSelect(id) {
    APP.state.selectedMonthlyProject = id;
    APP.renderMonthly();
  },

  // ── MONTHLY OVERVIEW
  async renderMonthly() {
    const el   = UI.contentEl();
    const data = await API.getProjects();
    const projects = (data?.projects || []).filter(p => p.status !== 'completed' && p.status !== 'on_hold');

    const isPrincipalOrMgmt = ['principal', 'design_principal', 'pmc_head', 'design_head', 'services_head'].includes(APP.user.role);
    if (!APP.state.selectedMonthlyProject) {
      APP.state.selectedMonthlyProject = isPrincipalOrMgmt ? 'all' : (APP.state.selectedProject || 'all');
    }

    // Generate selector dropdown HTML
    let selectHtml = `
    <div class="card" style="margin-bottom:16px; display:flex; flex-direction:column; gap:8px">
      <div style="font-size:11px; font-weight:bold; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Select Project View</div>
      <div style="position:relative; width:100%">
        <select id="monthly-project-select" style="padding:8px 30px 8px 12px; border-radius:6px; border:1px solid #ddd; font-size:14px; width:100%; color:var(--text); background: #fff; cursor: pointer; -webkit-appearance: none; -moz-appearance: none; appearance: none" onchange="APP.handleMonthlyProjectSelect(this.value)">
          <option value="all" ${APP.state.selectedMonthlyProject === 'all' ? 'selected' : ''}>All Projects (Portfolio View)</option>
          ${projects.map(proj => `<option value="${proj.id}" ${String(proj.id) === String(APP.state.selectedMonthlyProject) ? 'selected' : ''}>${UI.escapeText(proj.name)}</option>`).join('')}
        </select>
        <div style="position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--muted); font-size:12px">▼</div>
      </div>
    </div>
    `;

    let contentHtml = '';
    const renderProjectCard = (p) => {
      const trades = Object.entries(p.trades || {});
      const tradesHtml = trades.length > 0
        ? trades.map(([trade, pct]) => {
            const col = TRADE_COLORS[trade] || '#5a5a5a';
            const pctDisplay = Number(pct).toFixed(2).replace(/\.?0+$/, '') || '0';
            return `<div class="prog-row">
              <div class="prog-label" style="font-size:12px">${trade.split(' ')[0]}</div>
              <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${col}"></div></div>
              <div class="prog-pct" style="font-size:12px">${pctDisplay}%</div>
            </div>`;
          }).join('')
        : `<div style="font-size:13px; color:var(--muted); margin: 8px 0; font-style: italic">No discipline progress available</div>`;

      return `<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r2);padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--text)">${p.name}</div>
            <div style="font-size:13px;color:var(--navy);font-weight:bold;margin-top:4px">Overall Progress: ${p.avg_pct || 0}%</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;font-family:var(--mono)">R0 end: ${UI.fmtDate(p.r0_end_date)}</div>
          </div>
          ${UI.statusBadge(p.status)}
        </div>
        ${tradesHtml}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:16px">
          <div><span style="font-family:var(--mono);font-size:16px;font-weight:600;color:${(p.stats?.open_queries||0)>0?'#c8a040':'var(--text)'}">${p.stats?.open_queries||0}</span><span style="font-size:12px;color:var(--muted);margin-left:4px">Queries</span></div>
          <div><span style="font-family:var(--mono);font-size:16px;font-weight:600;color:${(p.stats?.flagged_tasks||0)>0?'#c87060':'var(--text)'}">${p.stats?.flagged_tasks||0}</span><span style="font-size:12px;color:var(--muted);margin-left:4px">Flags</span></div>
          <div><span style="font-family:var(--mono);font-size:16px;font-weight:600;color:${(p.stats?.overdue_materials||0)>0?'#c87060':'var(--text)'}">${p.stats?.overdue_materials||0}</span><span style="font-size:12px;color:var(--muted);margin-left:4px">Overdue</span></div>
        </div>
      </div>`;
    };

    if (APP.state.selectedMonthlyProject === 'all') {
      if (projects.length === 0) {
        contentHtml = UI.empty('', 'No active projects');
      } else {
        projects.forEach(p => {
          contentHtml += renderProjectCard(p);
        });
      }
    } else {
      const selectedProj = projects.find(p => String(p.id) === String(APP.state.selectedMonthlyProject));
      if (selectedProj) {
        contentHtml = renderProjectCard(selectedProj);
      } else {
        contentHtml = UI.empty('', 'Selected project not found');
      }
    }

    el.innerHTML = selectHtml + contentHtml;
  },

  // ── REPORTS
  // Weekly report — list + compose + approve
  async renderWeeklyReports() {
    const el = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const role = APP.user?.role;
    const canDraft   = ['pmc_head','principal','design_principal'].includes(role);
    const canApprove = ['pmc_head'].includes(role);
    const canSend    = ['principal','design_principal'].includes(role);

    const data = await API.getReports(pid).catch(() => null);
    if (!data) { el.innerHTML = UI.empty('️','Could not load reports'); return; }
    const reports = data.reports || [];

    let html = APP._projectSelectHtml('APP.renderWeeklyReports()');

    // Section header + action button
    html += `<div class="sec-hdr-row">
      <div class="sec-label" style="margin:0;flex:1">Weekly Reports</div>
      ${canDraft ? `<button class="btn-primary sec-hdr-btn" onclick="APP.showWeeklyReportForm(${pid})">+ New Report</button>` : ''}
    </div>
    ${canDraft ? `<button class="btn-primary sec-action-mobile" onclick="APP.showWeeklyReportForm(${pid})">+ New Report</button>` : ''}`;

    // Needs approval
    const pending = reports.filter(r => r.status === 'pending_approval');
    if (pending.length && canApprove) {
      html += `<div class="sec-label">Needs Approval (${pending.length})</div>`;
      pending.forEach(r => {
        html += `<div class="report-card">
          <div class="rc-header">
            <div>
              <div class="rc-date">Week ${r.week_number} — ending ${UI.fmtDate(r.week_ending)}</div>
              <div class="rc-who">${r.drafted_by_name||'—'}</div>
            </div>
            <span class="badge b-amber">Pending</span>
          </div>
          ${r.summary ? `<div class="rc-note">"${r.summary.substring(0,120)}"</div>` : ''}
          ${r.ai_drag_detected && !r.drag_acknowledged ? `<div class="rc-note" style="color:var(--amber)">⚠ AI drag flag — mitigation required</div>` : ''}
          <div class="btn-row" style="margin-top:8px">
            <button class="btn-sm approve" onclick="APP.approveWeeklyReport(${r.id})">Approve</button>
            <button class="btn-sm" onclick="APP.viewWeeklyReport(${r.id})">View</button>
            ${r.ai_drag_detected && !r.drag_acknowledged ? `<button class="btn-sm" onclick="APP.ackReportAnomaly(${r.id})" style="color:var(--amber)">Ack Drag</button>` : ''}
            ${r.status === 'flagged' && canApprove ? `<button class="btn-sm" onclick="APP.unflagReport(${r.id})" style="color:var(--green)">Unflag</button>` : ''}
          </div>
        </div>`;
      });
    }

    // Approved awaiting send
    const approved = reports.filter(r => r.status === 'approved');
    if (approved.length && canSend) {
      html += `<div class="sec-label">Approved — Awaiting Send (${approved.length})</div>`;
      approved.forEach(r => {
        html += `<div class="report-card">
          <div class="rc-header">
            <div>
              <div class="rc-date">Week ${r.week_number} — ending ${UI.fmtDate(r.week_ending)}</div>
              <div class="rc-who">Approved ${UI.fmtDate(r.approved_at)}</div>
            </div>
            <span class="badge b-green">Approved</span>
          </div>
          <div class="btn-row" style="margin-top:8px">
            ${r.pdf_url ? `<a class="btn-sm" href="${r.pdf_url}" target="_blank">⬇ PDF</a>` : ''}
            <button class="btn-sm approve" onclick="APP.markReportSent(${r.id})">Mark Sent</button>
          </div>
        </div>`;
      });
    }

    // History
    if (!reports.length) {
      html += UI.empty('','No weekly reports yet — draft the first one');
    } else {
      html += `<div class="sec-label">History</div>`;
      reports.forEach(r => {
        const bc = r.status === 'sent' || r.status === 'approved' ? 'b-green' : r.status === 'pending_approval' ? 'b-amber' : 'b-silver';
        html += `<button class="report-card" style="width:100%;text-align:left;cursor:pointer" onclick="APP.viewWeeklyReport(${r.id})">
          <div class="rc-header">
            <div>
              <div class="rc-date">Week ${r.week_number} — ending ${UI.fmtDate(r.week_ending)}</div>
              <div class="rc-who">${r.drafted_by_name||'—'}</div>
            </div>
            <span class="badge ${bc}">${r.status.replace('_',' ')}</span>
          </div>
          ${r.summary ? `<div class="rc-note">"${r.summary.substring(0,100)}"</div>` : ''}
        </button>`;
      });
    }

    el.innerHTML = `<div class="fade-in">${html}</div>`;
  },

  async showWeeklyReportForm(pid) {
    const cf = await API.carryForward(pid).catch(() => null);
    const weekEnding = cf?.week_end || UI.todayIST();
    const weekNum    = cf?.this_week || '';
    const lastSummary = cf?.last_report?.summary || '';

    UI.openModal('New Weekly Report', `
      <div class="field-row"><label class="field-label">Week Ending</label>
        <input type="date" id="rpt-week-ending" value="${weekEnding}"></div>
      <div class="field-row"><label class="field-label">Week Number</label>
        <input type="number" id="rpt-week-num" value="${weekNum}" placeholder="e.g. 24" min="1" max="53"></div>
      <div class="field-row" style="display:flex;align-items:center;justify-content:space-between">
        <label class="field-label" style="margin:0">Summary</label>
        <button class="btn-sm" style="font-size:11px" onclick="APP._generateWeeklySummary(${pid})">Generate from site data</button>
      </div>
      <textarea id="rpt-summary" rows="4" placeholder="Work completed this week, progress highlights…">${UI.escapeText(lastSummary)}</textarea>
      <div class="field-row"><label class="field-label">Issues / Notes for Client</label>
        <textarea id="rpt-issues" rows="3" placeholder="Blockers, decisions needed, observations…"></textarea></div>
      ${cf?.carried_items?.length ? `
        <div style="background:var(--bg);border-radius:var(--r);padding:12px;margin-bottom:12px">
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">
            ${cf.carried_items.length} open MOM item${cf.carried_items.length>1?'s':''} carried forward
          </div>
          ${cf.carried_items.slice(0,3).map(i => `
            <div style="font-size:12px;color:var(--text2);padding:4px 0;border-bottom:1px solid var(--border)">
              ${UI.escapeText(i.description||'')}
              <span style="color:var(--muted)"> — ${UI.escapeText(i.responsible||'—')}</span>
            </div>`).join('')}
          ${cf.carried_items.length > 3 ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">+${cf.carried_items.length-3} more</div>` : ''}
        </div>` : ''}
      <button class="btn-primary" onclick="APP.submitReport(${pid}, document.getElementById('rpt-week-num').value, document.getElementById('rpt-week-ending').value)">Submit for Approval</button>
    `);
  },

  async viewWeeklyReport(id) {
    const data = await API.get(`/weekly-signoff/${id}`).catch(() => null);
    if (!data?.report) { UI.toast('Could not load report'); return; }
    const r = data.report;
    const bc = r.status === 'sent' || r.status === 'approved' ? 'b-green' : r.status === 'pending_approval' ? 'b-amber' : 'b-silver';
    UI.openModal(`Week ${r.week_number} Report`, `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <span class="badge ${bc}">${r.status.replace('_',' ')}</span>
        <span style="font-size:12px;color:var(--muted);font-family:var(--mono)">Ending ${r.week_ending}</span>
        ${r.pdf_url ? `<a class="btn-sm" href="${r.pdf_url}" target="_blank" style="margin-left:auto">PDF</a>` : `<button class="btn-sm" onclick="APP.generateReportPDF(${r.id})" style="margin-left:auto">Generate PDF</button>`}
      </div>
      ${r.summary ? `<div class="field-row"><label class="field-label">Summary</label>
        <div style="font-size:14px;color:var(--text);line-height:1.5;padding:10px 14px;background:var(--bg);border-radius:var(--r)">${UI.escapeText(r.summary)}</div>
      </div>` : ''}
      ${r.issues_for_client ? `<div class="field-row"><label class="field-label">Client Notes</label>
        <div style="font-size:14px;color:var(--text);line-height:1.5;padding:10px 14px;background:var(--bg);border-radius:var(--r)">${UI.escapeText(r.issues_for_client)}</div>
      </div>` : ''}
      <div class="signoff-chain" style="margin-top:16px">
        ${[['PMC','pmc'],['Design','design'],['Services','services']].map(([lbl,sec]) => `
          <div class="signoff-slot ${r['sig_'+sec+'_by'] ? 'signed':'pending'}">
            <div class="label">${lbl}</div>
            <div class="who">${r['sig_'+sec+'_name']||'Awaiting'}</div>
            <div class="status">${r['sig_'+sec+'_by'] ? '✓ Signed' : 'Pending'}</div>
          </div>`).join('')}
      </div>
    `);
  },

  async submitReport(pid, weekNum, weekEnding) {
    const summary = document.getElementById('rpt-summary')?.value.trim();
    const issues  = document.getElementById('rpt-issues')?.value.trim();
    const res = await API.saveReport(pid, { week_ending: weekEnding, week_number: weekNum, summary, issues_for_client: issues });
    if (res?.success) { UI.toast('Report submitted for approval ✓'); UI.closeModal(); APP.renderWeeklyReports(); }
    else UI.toast(res?.error || 'Failed');
  },

  async approveWeeklyReport(id) {
    const res = await API.approveReport(id);
    if (res?.success) { UI.toast('Report approved ✓'); APP.renderWeeklyReports(); }
  },

  async _generateWeeklySummary(pid) {
    const btn = event?.target;
    if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }
    const data = await API.get(`/reports/${pid}/generate`).catch(() => null);
    if (btn) { btn.textContent = 'Generate from site data'; btn.disabled = false; }
    if (!data) { UI.toast('Could not generate — no site data yet'); return; }

    const lines = [];
    if (data.trade_progress?.length) {
      lines.push('Progress this week:');
      data.trade_progress.forEach(t => lines.push(`  ${t.trade}: ${t.pct_complete}% complete`));
    }
    if (data.flags?.length) {
      lines.push(`\nOpen flags: ${data.flags.length}`);
      data.flags.slice(0,3).forEach(f => lines.push(`  - ${f.description||f.task_name||'—'}`));
    }
    if (data.materials?.length) {
      const pending = data.materials.filter(m => m.status === 'pending');
      if (pending.length) lines.push(`\nMaterials pending approval: ${pending.length}`);
    }
    const el = document.getElementById('rpt-summary');
    if (el) el.value = lines.join('\n') || 'No site data available for this week.';

    const issueEl = document.getElementById('rpt-issues');
    if (issueEl && data.queries?.length) {
      issueEl.value = data.queries.slice(0,3).map(q => `- ${q.description||'Open query'}`).join('\n');
    }
  },

  async unflagReport(id) {
    const reason = prompt('Reason for unflagging (required):');
    if (!reason || !reason.trim()) return;
    const res = await API.patch(`/reports/${id}/unflag`, { reason: reason.trim() });
    if (res?.success) { UI.toast('Report unflagged ✓'); APP.renderWeeklyReports(); }
    else UI.toast(res?.error || 'Failed');
  },

  async ackReportAnomaly(id) {
    const res = await API.post(`/reports/${id}/ack-anomaly`, {});
    if (res?.success) { UI.toast('Anomaly acknowledged'); APP.renderWeeklyReports(); }
    else UI.toast(res?.error || 'Failed');
  },

  async generateReportPDF(id) {
    UI.toast('Generating PDF...');
    const res = await API.call('POST', `/reports/${id}/generate-pdf`, {});
    if (res?.success && res.file_url) {
      UI.closeModal();
      UI.toast('PDF ready');
      window.open(res.file_url, '_blank');
    } else {
      UI.toast(res?.error || 'PDF generation failed');
    }
  },

  // ── GANTT
  async renderGantt() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
    el.innerHTML = APP._projectSelectHtml('APP.renderGantt()') + [
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">',
      '<div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Schedule — Gantt View</div>',
      '<div style="display:flex;gap:8px;">',
      `<a href="/api/gantt/${pid}/xlsx" download><button class="btn-sm">Download (.xlsx)</button></a>`,
      '<button class="btn-sm" onclick="APP.renderGantt()">↺ Refresh</button>',
      '</div>',
      '</div>',
      '<div id="gantt-container" style="overflow-x:auto;"></div>'
    ].join('');
    await GANTT.load('gantt-container', pid);
  },

  // ── VENDORS
  // ── ENGAGEMENTS (M03 v3.1) — approval-aware flow
  // Replaces the broken showRegisterVendor/submitVendor which POSTed master-
  // registration fields to the engagement endpoint. Engagements now go through
  // PMC/head-initiated → principal-approved workflow before PRs can be raised.
  async renderVendors() {
    const el  = UI.contentEl();
    const pid = APP._ensurePid();
    const me  = APP.user;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const canInitiate = ['principal','design_principal','pmc_head','design_head','services_head'].includes(me.role);
    const isPrincipal = ['principal','design_principal'].includes(me.role);
    const showRates   = ['principal','design_principal','pmc_head','design_head','services_head'].includes(me.role);

    const res = await API.call('GET', `/vendors/${pid}/engagements`);
    const engs = res?.engagements || [];

    // Group by approval status for visibility
    const pending   = engs.filter(e => e.approval_status === 'pending');
    const approved  = engs.filter(e => e.approval_status === 'approved');
    const rejected  = engs.filter(e => e.approval_status === 'rejected');

    let html = APP._projectSelectHtml('APP.renderVendors()');

    if (canInitiate) {
      html += `<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn-primary" onclick="APP.showEngageVendor(${pid})">+ Engage Vendor</button>
        <button class="btn-sm" onclick="APP.showEngagementBulkUpload(${pid})">Bulk Upload</button>
      </div>`;
    }

    // Principal's attention block — pending approval items
    if (isPrincipal && pending.length) {
      html += `<div class="sec-label" style="color:#C8A040">⏳ Pending your approval (${pending.length})</div>`;
      pending.forEach(e => { html += APP._engagementCard(e, 'pending', pid, showRates, isPrincipal, canInitiate); });
    } else if (pending.length) {
      // Non-principal initiators see their own pending items too
      html += `<div class="sec-label" style="color:#C8A040">⏳ Awaiting approval (${pending.length})</div>`;
      pending.forEach(e => { html += APP._engagementCard(e, 'pending', pid, showRates, isPrincipal, canInitiate); });
    }

    if (approved.length) {
      html += `<div class="sec-label" style="margin-top:14px">✓ Approved (${approved.length})</div>`;
      approved.forEach(e => { html += APP._engagementCard(e, 'approved', pid, showRates, isPrincipal, canInitiate); });
    }
    if (rejected.length) {
      html += `<div class="sec-label" style="margin-top:14px;color:#C87060">✗ Rejected (${rejected.length})</div>`;
      rejected.forEach(e => { html += APP._engagementCard(e, 'rejected', pid, showRates, isPrincipal, canInitiate); });
    }
    if (!engs.length) html += UI.empty('','No vendors engaged on this project yet');

    el.innerHTML = html;
  },

  _engagementCard(e, status, pid, showRates, isPrincipal, canInitiate) {
    const border = status === 'pending' ? '#C8A040' : (status === 'rejected' ? '#C87060' : '#4A8A5A');
    const contract = showRates ? (e.contract_value != null ? Money.format(e.contract_value) : '—') : '—';
    const badge = { pending:'b-amber', approved:'b-green', rejected:'b-red' }[status];
    const label = status.toUpperCase();

    // Mobilisation status — colour-coded pill, dropdown for heads/PMC/principals on approved engagements
    const MOB_LABEL  = { not_started:'Not Started', active:'Active', partially_complete:'Partial', complete:'Complete', off_site:'Off Site' };
    const MOB_COLOUR = { not_started:'#888', active:'#4A8A5A', partially_complete:'#C8A040', complete:'#1D3D62', off_site:'#B1B1B2' };
    const MOB_ORDER  = ['not_started','active','partially_complete','complete','off_site'];
    const canSetStatus = canInitiate;  // same people who can initiate can set mobilisation status

    return `<div class="card" style="margin-bottom:6px;border-left:3px solid ${border}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="card-title">${UI.escapeText(e.vendor_name)}</div>
          <div class="card-meta">${UI.escapeText(e.trade||'')} · ${UI.escapeText(e.scope||'').substring(0,80)}</div>
          <div class="card-meta" style="font-family:var(--mono);font-size:10px;margin-top:2px">
            Engaged by ${UI.escapeText(e.engaged_by_name||'—')}${e.approved_by_name?' · Approved by '+UI.escapeText(e.approved_by_name):''}
          </div>
          ${status === 'rejected' && e.rejection_reason
              ? `<div style="font-size:11px;color:#C87060;margin-top:3px">Reason: ${UI.escapeText(e.rejection_reason)}</div>` : ''}
          ${e.clearance_status === 'pending'
              ? `<div style="font-size:10px;color:#C8A040;margin-top:3px">⚠ Vendor still pending finance clearance</div>` : ''}
        </div>
        <div style="text-align:right">
          ${showRates?`<div style="font-family:var(--mono);font-size:11px;color:var(--navy)">₹${contract}</div><div style="font-size:9px;color:var(--muted)">Contract</div>`:''}
          <span class="badge ${badge}" style="margin-top:4px">${label}</span>
        </div>
      </div>

      ${status === 'approved' ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #eee">
          <span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.3px">Mobilisation:</span>
          ${canSetStatus ? `
            <select onchange="APP.updateVendorStatus(${e.id}, ${pid}, this.value)"
                    style="font-size:11px;padding:3px 6px;border:1px solid ${MOB_COLOUR[e.mobilisation_status]||'#888'};
                           color:${MOB_COLOUR[e.mobilisation_status]||'#888'};font-weight:600;border-radius:4px;background:var(--card)">
              ${MOB_ORDER.map(s => `<option value="${s}" ${s===e.mobilisation_status?'selected':''}>${MOB_LABEL[s]}</option>`).join('')}
            </select>
          ` : `
            <span style="background:${MOB_COLOUR[e.mobilisation_status]||'#888'}22;color:${MOB_COLOUR[e.mobilisation_status]||'#888'};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">
              ${MOB_LABEL[e.mobilisation_status] || '—'}
            </span>
          `}
          ${e.mobilisation_date ? `<span style="font-size:10px;color:var(--muted)">since ${UI.fmtDate(e.mobilisation_date)}</span>` : ''}
        </div>
      ` : ''}

      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        ${status === 'pending' && isPrincipal ? `
          <button class="btn-approve" onclick="APP.approveEngagement(${pid},${e.id},'${UI.escapeAttr(e.vendor_name)}')">✓ Approve</button>
          <button class="btn-reject"  onclick="APP.rejectEngagement(${pid},${e.id},'${UI.escapeAttr(e.vendor_name)}')">✗ Reject</button>
        ` : ''}
        ${status === 'approved' ? `
          <button class="btn-sm" onclick="APP.showRaisePayment(${pid},${e.vendor_id},'${UI.escapeAttr(e.vendor_name)}',${e.id})">+ Payment Request</button>
          <button class="btn-sm" onclick="APP.showAssignBOQ(${pid},${e.id},${e.vendor_id})">BOQ Map</button>
          ${canInitiate ? `<button class="btn-sm" onclick="APP.showReviseContract(${pid},${e.id},'${UI.escapeAttr(e.vendor_name)}',${e.contract_value||0})">✎ Revise</button>` : ''}
          <button class="btn-sm" onclick="APP.showContractHistory(${pid},${e.id},'${UI.escapeAttr(e.vendor_name)}')">📜 History</button>
        ` : ''}
      </div>
    </div>`;
  },

  // ── Engage Vendor (pick from master + scope + contract value)
  async showEngageVendor(pid) {
    const masterRes = await API.call('GET', '/vendors/master');
    const vendors = (masterRes?.vendors || []).filter(v => v.is_active && v.clearance_status === 'cleared');
    if (!vendors.length) {
      UI.openModal('Engage Vendor', `<p style="font-size:13px;color:var(--muted)">No cleared vendors in master. Ask finance to clear a vendor first — Vendor Master tab.</p>`);
      return;
    }
    UI.openModal('Engage Vendor', `
      <div class="field-row"><label class="field-label" for="ev-vendor">Vendor (from cleared master) *</label>
        <select id="ev-vendor">
          <option value="">— Select —</option>
          ${vendors.map(v => `<option value="${v.id}">[${UI.escapeText(v.trade||'')}] ${UI.escapeText(v.vendor_name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="ev-scope">Scope of Work *</label>
        <textarea id="ev-scope" rows="3" placeholder="e.g. Reinforcement and concreting — all floors"></textarea>
      </div>
      <div class="field-row"><label class="field-label" for="ev-value">Contract Value (₹)</label>
        <input type="number" step="1" id="ev-value" placeholder="Leave blank if not finalised">
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">
        ${['principal','design_principal'].includes(APP.user.role)
            ? 'As principal, your engagement will be self-approved immediately.'
            : 'Will be submitted for principal approval. Payment requests blocked until approved.'}
      </div>
      <button class="btn-primary" onclick="APP.submitEngageVendor(${pid})">Submit</button>
    `);
  },

  async submitEngageVendor(pid) {
    const body = {
      vendor_id:      parseInt(document.getElementById('ev-vendor')?.value) || null,
      scope:          document.getElementById('ev-scope')?.value.trim(),
      contract_value: document.getElementById('ev-value')?.value.trim() || null,
    };
    if (!body.vendor_id || !body.scope) { UI.toast('Vendor and scope required'); return; }
    const res = await API.call('POST', `/vendors/${pid}/engagements`, body);
    if (res?.success) { UI.closeModal(); UI.toast(res.message || 'Engaged ✓'); (APP._vendorRefresh || APP.renderVendors)(); APP._vendorRefresh = null; }
    else UI.toast(res?.error || 'Failed');
  },

  async approveEngagement(pid, id, vendorName) {
    const ok = await UI.confirm(`Approve engagement with ${vendorName}?`);
    if (!ok) return;
    const res = await API.call('PATCH', `/vendors/${pid}/engagements/${id}/approve`, {});
    if (res?.success) { UI.toast('Approved ✓'); APP.renderVendors(); }
    else UI.toast(res?.error || 'Failed');
  },

  async rejectEngagement(pid, id, vendorName) {
    const reason = await UI.prompt(`Reject engagement with ${vendorName} — reason:`, 'e.g. Wrong scope, incorrect contract value, budget not approved');
    if (!reason || reason.trim().length < 5) { UI.toast('Reason required (min 5 chars)'); return; }
    const res = await API.call('PATCH', `/vendors/${pid}/engagements/${id}/reject`, { reason });
    if (res?.success) { UI.toast('Rejected'); APP.renderVendors(); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── Contract revision (PMC + principals only on backend)
  showReviseContract(pid, id, vendorName, currentValue) {
    UI.openModal(`Revise Contract: ${vendorName}`, `
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Current value: ₹${Money.format(currentValue||0)}</div>
      <div class="field-row"><label class="field-label" for="rc-value">Revised Value (₹) *</label>
        <input type="number" step="1" id="rc-value" placeholder="New contract value">
      </div>
      <div class="field-row"><label class="field-label" for="rc-reason">Reason *</label>
        <textarea id="rc-reason" rows="3" placeholder="Why is this being revised?"></textarea>
      </div>
      <button class="btn-primary" onclick="APP.submitReviseContract(${pid},${id})">Save Revision</button>
    `);
  },

  async submitReviseContract(pid, id) {
    const body = {
      revised_value: parseFloat(document.getElementById('rc-value')?.value),
      reason:        document.getElementById('rc-reason')?.value.trim(),
    };
    if (!body.revised_value || body.revised_value <= 0) { UI.toast('Revised value must be positive'); return; }
    if (!body.reason || body.reason.length < 5) { UI.toast('Reason required (min 5 chars)'); return; }
    const res = await API.call('PATCH', `/vendors/${pid}/engagements/${id}/contract`, body);
    if (res?.success) { UI.closeModal(); UI.toast(res.message || 'Revised ✓'); APP.renderVendors(); }
    else UI.toast(res?.error || 'Failed');
  },

  async showContractHistory(pid, id, vendorName) {
    const res = await API.call('GET', `/vendors/${pid}/engagements/${id}/history`);
    const history = res?.history || [];
    let body = '';
    if (!history.length) {
      body = `<p style="font-size:13px;color:var(--muted)">No revisions yet. Current contract value is the original value.</p>`;
    } else {
      body = history.map(h => {
        const when = new Date(h.revised_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        return `<div class="card" style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between">
            <div style="font-family:var(--mono);font-size:11px">
              ₹${Money.format(h.previous_value)} → <b>₹${Money.format(h.revised_value)}</b>
            </div>
            <div style="font-size:10px;color:var(--muted)">${when}</div>
          </div>
          <div style="font-size:11px;color:var(--text);margin-top:4px">${UI.escapeText(h.reason || '—')}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">By ${UI.escapeText(h.revised_by_name || '—')}${h.cn_number ? ' · CN '+UI.escapeText(h.cn_number) : ''}</div>
        </div>`;
      }).join('');
    }
    UI.openModal(`Contract History: ${vendorName}`, body);
  },

  // ── Bulk upload engagements (already on backend; this is the UI wrapper)
  showEngagementBulkUpload(pid) {
    UI.openModal('Bulk Engage Vendors', `
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
        Excel columns: <b>Vendor Name</b>, <b>Trade</b>, <b>Scope</b>, Contract Value, Contact, Phone, Account Number, IFSC.
        Vendors not in the master are created (pending finance clearance); engagements land <b>pending approval</b>.
      </p>
      <div class="field-row" style="margin-bottom:16px">
        <label class="field-label">Engagements Excel</label>
        <input type="file" id="eng-bulk-file" accept=".xlsx,.xls" style="width:100%">
      </div>
      <button class="btn-primary" style="width:100%" onclick="APP.submitEngagementBulkUpload(${pid})">Upload</button>
    `);
  },

  async submitEngagementBulkUpload(pid) {
    const file = document.getElementById('eng-bulk-file')?.files?.[0];
    if (!file) { UI.toast('Select a file'); return; }
    const fd = new FormData();
    fd.append('engagements', file);
    UI.toast('Uploading…');
    const res = await API.call('POST', `/vendors/${pid}/engagements/bulk-upload`, fd, true);
    if (res?.success) {
      UI.closeModal();
      UI.toast(res.message || 'Uploaded ✓');
      (APP._vendorRefresh || APP.renderVendors)();
      APP._vendorRefresh = null;
    } else UI.toast(res?.error || 'Upload failed');
  },

  async showRaisePaymentPicker(pid) {
    // Load engagements for this project so site manager can pick vendor first
    const data = await API.get(`/vendors/${pid}/engagements`).catch(() => null);
    const engs = (data?.engagements || []).filter(e => e.approval_status === 'approved');
    if (!engs.length) {
      UI.openModal('Raise Payment Request', `
        <div style="font-size:14px;color:var(--muted);text-align:center;padding:20px 0">
          No approved vendor engagements on this project.<br>
          <span style="font-size:12px">Vendors must be engaged and approved by the Principal before payment requests can be raised.</span>
        </div>
      `);
      return;
    }
    UI.openModal('Raise Payment Request', `
      <div class="field-row">
        <label class="field-label">Select Vendor / Engagement *</label>
        <select id="pr-eng-sel" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--card)">
          <option value="">— Select vendor —</option>
          ${engs.map(e => `<option value="${e.id}" data-vendor-id="${e.vendor_id}" data-vendor-name="${UI.escapeAttr(e.vendor_name||'')}">${UI.escapeAttr(e.vendor_name||'—')} · ${UI.escapeAttr((e.scope||'').substring(0,40))}</option>`).join('')}
        </select>
      </div>
      <div id="pr-form-slot"></div>
      <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="APP._prPickEngagement(${pid})">Next</button>
    `);
  },

  _prPickEngagement(pid) {
    const sel = document.getElementById('pr-eng-sel');
    const opt = sel?.options[sel.selectedIndex];
    if (!opt || !opt.value) { UI.toast('Select a vendor'); return; }
    const engId    = parseInt(opt.value, 10);
    const vendorId = parseInt(opt.dataset.vendorId, 10);
    const vendorName = opt.dataset.vendorName || '—';
    UI.closeModal();
    APP.showRaisePayment(pid, vendorId, vendorName, engId);
  },

  showRaisePayment(pid, vendorId, vendorName, engagementId) {
    const TYPES = ['running_account_bill','advance','mobilisation_advance','material_advance',
                   'final_bill','retention_release','extra_item','deduction'];
    UI.openModal(`Payment Request — ${vendorName}`, `
      <div class="field-row"><label class="field-label" for="pay-type">Payment Type</label>
        <select id="pay-type">
          ${TYPES.map(t=>`<option value="${t}">${t.replace(/_/g,' ').toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="pay-amt">Amount (₹) *</label><input type="text" id="pay-amt" placeholder="0"></div>
      <div class="field-row"><label class="field-label" for="pay-reason">Reason / Description *</label><textarea id="pay-reason" rows="2" placeholder="What is this payment for?"></textarea></div>
      <div class="field-row">
        <label class="field-label">Evidence / Invoice PDFs <span style="color:var(--muted);font-weight:400">(up to 5 files)</span></label>
        <input type="file" id="pay-evidence" accept="image/*,.pdf" multiple style="font-size:13px" onchange="APP._showEvidenceList('pay-evidence','pay-evidence-list')">
        <div id="pay-evidence-list" style="margin-top:6px;display:flex;flex-direction:column;gap:4px"></div>
      </div>
      <button class="btn-primary" onclick="APP.submitPayment(${pid},${vendorId},${engagementId||'null'})">Raise Payment Request</button>
    `);
  },

  async submitPayment(pid, vendorId, engagementId) {
    const amount  = document.getElementById('pay-amt')?.value?.trim();
    const reason  = document.getElementById('pay-reason')?.value?.trim();
    const payType = document.getElementById('pay-type')?.value;
    const evidenceFiles = document.getElementById('pay-evidence')?.files;
    if (!amount) { UI.toast('Amount required'); return; }
    if (!reason) { UI.toast('Reason required'); return; }
    const fd = new FormData();
    fd.append('engagement_id',   engagementId || '');
    fd.append('vendor_id',       vendorId || '');
    fd.append('amount_requested', amount);
    fd.append('reason',          reason);
    fd.append('payment_type',    payType || 'other');
    if (evidenceFiles) {
      for (const f of evidenceFiles) fd.append('evidence', f);
    }
    const res = await API.call('POST', `/payment-requests/${pid}`, fd, true);
    if (res?.success) {
      UI.closeModal();
      UI.toast('Payment request raised ✓');
      // Refresh whichever tab is active
      if (APP.currentTab === 'payments') APP.renderPayments();
      else APP.renderVendors();
    } else UI.toast(res?.error || 'Failed');
  },

  _showEvidenceList(inputId, listId) {
    const input = document.getElementById(inputId);
    const list  = document.getElementById(listId);
    if (!input || !list) return;
    list.innerHTML = '';
    Array.from(input.files).forEach((f, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);padding:4px 8px;background:var(--bg);border-radius:6px;border:1px solid var(--border)';
      row.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.escapeText(f.name)}</span><span style="color:var(--muted);flex-shrink:0">${(f.size/1024).toFixed(0)} KB</span>`;
      list.appendChild(row);
    });
  },

  async approvePayment(id, status) {
    const ok = await UI.confirm('Approve this payment?');
    if (!ok) return;
    // BUGFIX: the payment queue is payment_requests (from /payment-requests/:pid/weekly-batch),
    // so approvals must go through the payment-request review endpoints — not the
    // vendor_payments approve route (which 404'd with "Payment not found").
    // pending_pmc -> PMC review; pmc_approved -> Principal review (mirrors "Approve All").
    const res = (status === 'pending_pmc')
      ? await API.pmcReviewPaymentRequest(id, { action: 'approve' })
      : await API.principalReviewPaymentRequest(id, { action: 'approve' });
    if (res?.success) { UI.toast('Payment approved \u2713'); APP.renderPayments(); }
    else UI.toast(res?.error || 'Approval failed');
  },

  async generatePaymentSheet(pid, weekEnd) {
    UI.toast('Generating payment sheet…');
    const res = await API.getPaymentSheet(pid, weekEnd);
    if (res?.success) {
      UI.toast(`Payment sheet ready — ${Money.formatRupee(res.total)} total. Sent to M/P on WhatsApp.`);
    } else {
      UI.toast(res?.error || 'No payments found for this week');
    }
  },

  showAssignBOQ(pid, engagementId, vendorId) {
    API.getBOQ(pid).then(data => {
      const items = data?.items || [];
      UI.openModal('Assign BOQ Items', `
        <div class="field-row"><label class="field-label" for="boq-item-sel">BOQ Item</label>
          <select id="boq-item-sel">
            <option value="">— Select item —</option>
            ${items.map(i=>`<option value="${i.id}">${i.trade} — ${i.item_name} (${i.unit})</option>`).join('')}
          </select>
        </div>
        <div class="field-row"><label class="field-label" for="boq-rate">Our Cost Rate (₹ per ${'{unit}'})</label>
          <input type="text" id="boq-rate" placeholder="Rate per unit"></div>
        <div class="field-row"><label class="field-label" for="boq-note">Notes</label>
          <input type="text" id="boq-note" placeholder="Optional"></div>
        <button class="btn-primary" onclick="APP.submitBOQAssign(${pid},${engagementId},${vendorId})">Assign</button>
      `);
    });
  },

  async submitBOQAssign(pid, engagementId, vendorId) {
    const data = {
      boq_item_id:   document.getElementById('boq-item-sel')?.value,
      our_cost_rate: document.getElementById('boq-rate')?.value,
      notes:         document.getElementById('boq-note')?.value.trim(),
    };
    if (!data.boq_item_id || !data.our_cost_rate) { UI.toast('Select item and enter rate'); return; }
    const res = await API.assignBOQ(pid, engagementId, data);
    if (res?.success) { UI.closeModal(); UI.toast('BOQ item assigned ✓'); APP.renderVendors(); }
    else UI.toast(res?.error || 'Failed');
  },

  async markReportSent(id) {
    const res = await API.markSent(id);
    if (res?.success) { UI.toast('Marked as sent to client ✓'); APP.renderWeeklyReports(); }
  },
};

// ── PROJECT SELECTOR HELPERS ─────────────────────────────────────────────────
// Shared by every tab that shows per-project data.
//
//   APP._visibleProjects()
//     Returns the user's project list, filtered to active-only for site
//     manager / senior_site_manager roles (firm-wide roles see everything).
//
//   APP._ensurePid()
//     Guarantees APP.state.selectedProject is set (picks first visible project
//     if nothing is selected yet). Returns the pid, or null if no projects.
//
//   APP._projectSelectHtml(rerenderExpr)
//     Returns a full-width <select> HTML string that switches project and
//     calls rerenderExpr on change. Returns '' when only one project exists.
// ─────────────────────────────────────────────────────────────────────────────

APP._visibleProjects = function() {
  const isSiteRole = ['site_manager','senior_site_manager'].includes(APP.user?.role);
  return (APP.user?.projects || []).filter(p => !isSiteRole || p.status === 'active' || !p.status);
};

// Returns true (and renders a "still initialising" banner) if the selected
// project is not yet active. Skip this guard in Budget/setup screens.
APP._guardInitialisingProject = function(el, pid) {
  if (!pid) return false;
  const proj = (APP.user?.projects || []).find(p => String(p.id) === String(pid));
  if (!proj || proj.status !== 'initialising') return false;
  // Senior roles set up and oversee projects — never block them
  if (['pmc_head','principal','design_principal'].includes(APP.user?.role)) return false;
  el.innerHTML = APP._projectSelectHtml('APP.render(APP.currentTab)') + `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;gap:16px;padding:32px;text-align:center">
      <div style="font-size:32px">🏗️</div>
      <div style="font-weight:700;font-size:16px;color:var(--text)">${proj.name} is still being set up</div>
      <div style="font-size:13px;color:var(--muted);max-width:320px">This project hasn't been fully initialised yet. Complete the setup checklist before accessing this tab.</div>
    </div>`;
  return true;
};

APP._ensurePid = function() {
  const projects = APP._visibleProjects();
  // Validate current selection is actually in the visible list;
  // if not (e.g. selectedProject points to an inactive/inaccessible project),
  // fall back to the first visible project so the API call uses a valid pid.
  const inList = projects.some(p => String(p.id) === String(APP.state.selectedProject));
  if (!APP.state.selectedProject || !inList) {
    if (projects.length) {
      // Prefer first active project; only fall back to initialising if nothing else exists
      const active = projects.find(p => p.status === 'active' || !p.status);
      APP.state.selectedProject = (active || projects[0]).id;
      if (APP._updateTopbar) APP._updateTopbar();
    }
  }
  return APP.state.selectedProject || null;
};

APP._projectSelectHtml = function(rerenderExpr) {
  const projects = APP._visibleProjects();
  if (projects.length <= 1) return '';
  const pid = APP.state.selectedProject;
  return `<div style="position:relative;margin-bottom:14px">
    <select style="width:100%;padding:8px 32px 8px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--white);color:var(--text);cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;outline:none"
      onchange="APP.state.selectedProject=parseInt(this.value);APP._updateTopbar();${rerenderExpr}">
      ${projects.map(p => `<option value="${p.id}" ${String(p.id)===String(pid)?'selected':''}>${UI.escapeText(p.name)}</option>`).join('')}
    </select>
    <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--muted);font-size:12px">▼</div>
  </div>`;
};

// ── FORCE PASSWORD CHANGE (first login)
APP.showForceChangePassword = function() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.remove('is-visible');
  document.getElementById('change-password-screen').style.display = 'flex';
  document.getElementById('cp-username').textContent = APP.user.full_name;
};

// In-app password change — own input IDs (cpm-*) so they don't collide with
// the hidden #change-password-screen inputs, which would otherwise win
// document.getElementById and break the modal silently.
APP.showChangePasswordModal = function() {
  if (!APP.user) return;
  UI.openModal('Change Password', `
    <div class="field"><label>Current Password</label>
      <input type="password" id="cpm-current" autocomplete="current-password" placeholder="current password" style="width:100%"></div>
    <div class="field"><label>New Password</label>
      <input type="password" id="cpm-new" autocomplete="new-password" placeholder="min 8 characters" style="width:100%"></div>
    <div class="field"><label>Confirm New Password</label>
      <input type="password" id="cpm-confirm" autocomplete="new-password" placeholder="repeat new password" style="width:100%"></div>
    <div id="cpm-error" style="color:#C87060;font-size:12px;margin:6px 0"></div>
    <div class="btn-row" style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn-primary" onclick="APP.submitChangePasswordModal()">Update Password</button>
    </div>
  `);
  setTimeout(() => document.getElementById('cpm-current')?.focus(), 50);
};

APP.submitChangePasswordModal = async function() {
  const current = document.getElementById('cpm-current').value;
  const newpwd  = document.getElementById('cpm-new').value;
  const confirm = document.getElementById('cpm-confirm').value;
  const errEl   = document.getElementById('cpm-error');
  errEl.textContent = '';

  if (!current || !newpwd || !confirm) { errEl.textContent = 'All fields required'; return; }

  // Mirrors services/password-policy.js for fast UX; server is the authority.
  const username = (APP.user?.username || '').toLowerCase();
  if (newpwd.length < 8)            { errEl.textContent = 'Password must be at least 8 characters'; return; }
  if (newpwd.length > 128)          { errEl.textContent = 'Password must be at most 128 characters'; return; }
  if (!/[a-z]/.test(newpwd))        { errEl.textContent = 'Password must contain a lowercase letter'; return; }
  if (!/[A-Z]/.test(newpwd))        { errEl.textContent = 'Password must contain an uppercase letter'; return; }
  if (!/[0-9]/.test(newpwd))        { errEl.textContent = 'Password must contain a digit'; return; }
  if (newpwd !== confirm)           { errEl.textContent = 'Passwords do not match'; return; }
  if (newpwd === current)           { errEl.textContent = 'New password must be different from current'; return; }
  if (username && newpwd.toLowerCase() === username) {
    errEl.textContent = 'Password cannot be the same as your username'; return;
  }
  if (username && username.length >= 4 && newpwd.toLowerCase().includes(username)) {
    errEl.textContent = 'Password cannot contain your username'; return;
  }

  const res = await API.changePassword(current, newpwd);
  if (res?.success) {
    UI.closeModal();
    UI.toast('Password changed successfully ✓');
  } else {
    errEl.textContent = res?.error || 'Failed to change password';
  }
};

APP.submitChangePassword = async function() {
  const current = document.getElementById('cp-current').value;
  const newpwd  = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  const errEl   = document.getElementById('cp-error');
  errEl.textContent = '';

  if (!current || !newpwd || !confirm) { errEl.textContent = 'All fields required'; return; }

  // Client-side mirror of services/password-policy.js — server is authority, this is just for fast UX.
  const username = (APP.user?.username || '').toLowerCase();
  if (newpwd.length < 8)            { errEl.textContent = 'Password must be at least 8 characters'; return; }
  if (newpwd.length > 128)          { errEl.textContent = 'Password must be at most 128 characters'; return; }
  if (!/[a-z]/.test(newpwd))        { errEl.textContent = 'Password must contain a lowercase letter'; return; }
  if (!/[A-Z]/.test(newpwd))        { errEl.textContent = 'Password must contain an uppercase letter'; return; }
  if (!/[0-9]/.test(newpwd))        { errEl.textContent = 'Password must contain a digit'; return; }
  if (newpwd !== confirm)           { errEl.textContent = 'Passwords do not match'; return; }
  if (newpwd === current)           { errEl.textContent = 'New password must be different from current'; return; }
  if (username && newpwd.toLowerCase() === username) {
    errEl.textContent = 'Password cannot be the same as your username'; return;
  }
  if (username && username.length >= 4 && newpwd.toLowerCase().includes(username)) {
    errEl.textContent = 'Password cannot contain your username'; return;
  }

  const res = await API.changePassword(current, newpwd);
  if (res?.success) {
    document.getElementById('change-password-screen').style.display = 'none';
    APP.user.must_change_password = false;
    APP.showApp();
    UI.toast('Password changed successfully ✓');
  } else {
    // Surface server-side rejection (e.g. blocklist hit that client-side didn't catch)
    errEl.textContent = res?.error || 'Failed to change password';
  }
};

// NOTE: APP.showForgotPassword / APP.sendOTP / APP.verifyOTP deleted 2026-04-21.
// Self-service password reset removed. Users ask manager or Principal/Design Principal to reset
// via Users tab → Reset pw. See HIGH-6 in AUDIT-M04-M13.md.

// ── BOOT
document.addEventListener('DOMContentLoaded', () => {
  APP.init();

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', e => {
    e.preventDefault();
    APP.login();
  });

  // Modal close
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) UI.closeModal();
  });

  // Enter key on login
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') APP.login();
  });
});

// ════════════════════════════════════════════════════════
// PHASE 3 UI SCREENS
// ════════════════════════════════════════════════════════

// ── VENDOR ENGAGEMENT HELPERS (mobilisation status + expand detail)
// Kept for a future mobilisation-status UI in renderVendors. loadVendorRegister
// itself was superseded by the approval-aware renderVendors above and deleted.
APP.expandVendor = function(id) {
  const el = document.getElementById(`vendor-detail-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

APP.updateVendorStatus = async function(engagementId, projectId, status) {
  const res = await API.call('PATCH', `/vendors/${projectId}/engagements/${engagementId}/status`, { status });
  if (res?.success) { UI.toast('Status updated ✓'); APP.renderVendors(); }
  else UI.toast(res?.error || 'Update failed');
};

// ── FEE SCHEDULE + PI SCREEN
APP.loadFeeSchedule = async function(projectId) {
  const res = await API.call('GET', `/invoices/${projectId}/fee-schedule`);
  const piRes = await API.call('GET', `/invoices/${projectId}/pi`);
  if (!res) return;

  const isPrincipal = ['principal','design_principal'].includes(APP.user.role);
  let html = `<div class="section-header">Fee Schedule & Proforma Invoices</div>`;

  // Fee schedule table
  html += `<div class="card">
    <div class="card-title">Fee Schedule</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#1D3D62;color:#fff">
        <th style="padding:6px 8px;text-align:left">Milestone</th>
        <th style="padding:6px 8px;text-align:right">Amount (ex-GST)</th>
        <th style="padding:6px 8px;text-align:right">Total (incl. GST)</th>
      </tr>
      ${(res.items||[]).map((item,i)=>`
        <tr style="background:${i%2===0?'#F0F3F7':'#fff'}">
          <td style="padding:6px 8px">${item.milestone_name}</td>
          <td style="padding:6px 8px;text-align:right">${Money.formatRupee(item.amount)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:bold">${Money.formatRupee(Math.round(parseFloat(item.amount)*(1+parseFloat(item.gst_pct)/100)))}</td>
        </tr>`).join('')}
      <tr style="background:#1D3D62;color:#C8A55A;font-weight:bold">
        <td style="padding:8px">Total</td>
        <td></td>
        <td style="padding:8px;text-align:right">${Money.formatRupee(Math.round((res.total||0)*1.18))}</td>
      </tr>
    </table>
    ${isPrincipal ? `<button class="btn-sm" onclick="APP.showFeeScheduleUpload(${projectId})" style="margin:8px">Upload Fee Schedule</button>` : ''}
  </div>`;

  // PI list
  html += `<div class="card" style="margin-top:8px"><div class="card-title">Proforma Invoices</div>`;
  const piStatusColor = { draft:'#888', sent:'#C8A040', acknowledged:'#4A8FA8', paid:'#4A8A5A' };
  (piRes?.invoices||[]).forEach(pi => {
    const daysOpen = Math.round((Date.now() - new Date(pi.raised_at)) / 86400000);
    html += `<div class="list-item" style="border-left:3px solid ${piStatusColor[pi.status]||'#888'}">
      <div style="display:flex;justify-content:space-between">
        <div>
          <div style="font-weight:bold;font-size:13px">${pi.pi_number}</div>
          <div style="font-size:12px;color:#666">${pi.milestone_name}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:bold;color:#1D3D62">${Money.formatRupee(pi.amount_total)}</div>
          <div style="font-size:11px;color:${piStatusColor[pi.status]}">${pi.status.toUpperCase()}</div>
          <div style="font-size:11px;color:#888">${daysOpen}d ago</div>
        </div>
      </div>
    </div>`;
  });
  if (!piRes?.invoices?.length) html += `<div style="padding:12px;color:#888;font-size:13px">No PIs raised yet</div>`;
  html += `</div>`;

  UI.setContent(html);
};

// ── DRAWING QUERY ESCALATION UI
APP.loadDrawingQueries = async function(projectId) {
  const res = await API.call('GET', `/issues/rfi/${projectId}`);
  if (!res) return;

  const trafficLight = { open:'#C87060', in_progress:'#C8A040', closed:'#4A8A5A' };
  const isSiteManager = APP.user.role === 'site_manager';

  let html = `<div class="section-header">Drawing Queries</div>`;

  if (!isSiteManager) {
    html += `<button class="btn-primary" onclick="APP.showRaiseQueryModal(${projectId})" style="margin-bottom:8px;width:100%">+ Raise Query</button>`;
  }

  (res.queries||[]).forEach(q => {
    const daysOpen = Math.round((Date.now() - new Date(q.raised_at)) / 86400000);
    const color = trafficLight[q.status] || '#888';
    html += `<div class="card" style="margin-bottom:8px;border-left:4px solid ${color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px">
        <div style="flex:1">
          <div style="font-size:12px;color:#888">Dwg ${q.drawing_number} Rev ${q.revision||0} · ${daysOpen}d open</div>
          <div style="font-size:14px;margin:4px 0">${q.question}</div>
          ${q.status==='closed' ? `<div style="font-size:13px;color:#4A8A5A;margin-top:4px">✓ ${q.resolution||''}</div>` : ''}
          ${q.ai_suggestion ? `<div style="font-size:12px;color:var(--muted);background:var(--bg);padding:6px;border-radius:4px;margin-top:4px;border:1px solid var(--border)">AI: ${q.ai_suggestion} ${!q.validated_by?'<span style="color:#C87060">(pending validation)</span>':''}</div>` : ''}
        </div>
        <div style="text-align:center;padding-left:8px">
          <div style="width:14px;height:14px;border-radius:50%;background:${color};margin:0 auto 4px"></div>
          <div style="font-size:10px;color:#888">${q.status}</div>
        </div>
      </div>
      ${q.status!=='closed' && !isSiteManager ? `<div style="padding:0 10px 10px;display:flex;gap:6px">
        <button class="btn-sm" onclick="APP.closeQuery(${q.id}, ${projectId})">Close Query</button>
      </div>` : ''}
    </div>`;
  });

  if (!res.queries?.length) html += `<div class="empty-state">No drawing queries</div>`;
  UI.setContent(html);
};

APP.closeQuery = async function(queryId, projectId) {
  const resolution = prompt('Resolution / answer:');
  if (!resolution) return;
  const res = await API.call('POST', `/issues/rfi/${queryId}/close`, { resolution_note: resolution });
  if (res?.success) { APP.loadDrawingQueries(projectId); UI.toast('Query closed ✓'); }
  else UI.toast('Failed to close query');
};

// ── CHANGE NOTICE DEPUTY ASSIGNMENT (Profile screen)
// ── CHANGE NOTICE DEPUTY ASSIGNMENT (Profile screen)
// Migrated to Alpine component in public/js/components/profile.js (v3)
// The Alpine component handles everything: fetch, render, deputy save, leave request.
// Legacy implementation preserved below as APP._loadProfileLegacy for rollback.
APP.loadProfile = async function() {
  if (window.Components?.mount && window.Alpine) {
    // Mount the Alpine component into #content-area
    const mountFn = Components.mount('content-area', 'profile');
    return mountFn();
  }
  // Fallback if Alpine failed to load — call legacy implementation
  return APP._loadProfileLegacy();
};

APP._loadProfileLegacy = async function() {
  const me = APP.user;
  const res = await API.call('GET', `/users/me`);
  const user = res?.user || me;

  // Get eligible deputies for this role.
  // Same eligibility model as before — extend to whatever roles you want
  // to be able to anoint a deputy. Currently mirrors the streamMap from
  // before the v5.11 collapse.
  const streamMap = {
    design_head:    ['team_lead','jr_architect'],
    services_head:  ['services_engineer'],
    pmc_head:       ['pmc_head'],
    design_principal: [],
    principal:      [],
  };
  const eligible = streamMap[me.role] || [];
  let deputyHtml = '';
  if (eligible.length || me.role === 'pmc_head') {
    const usersRes = await API.call('GET', '/users');
    const candidates = (usersRes?.users||[]).filter(u =>
      u.id !== me.id && (eligible.includes(u.role) || (me.role==='pmc_head' && u.role==='pmc_head'))
    );
    // If a Principal previously overrode this user's deputy, show the audit line.
    const overrideLine = user.deputy_overridden_by_name
      ? `<div style="padding:8px 10px;font-size:11px;color:var(--amber);background:rgba(218,165,32,0.10);border-radius:4px;margin-bottom:8px;border:1px solid rgba(218,165,32,0.25)">
           Set by Principal: ${user.deputy_overridden_by_name} · ${UI.fmtDate(user.deputy_overridden_at)}
         </div>` : '';
    deputyHtml = `<div class="card" style="margin-top:8px">
      <div class="card-title">Deputy Assignment</div>
      <div style="padding:10px;font-size:13px;color:#666">When you are unavailable, your deputy can sign on your behalf within the dates below.</div>
      <div style="padding:0 10px 10px">
        ${overrideLine}
        <select id="deputy-select" style="width:100%;padding:8px;margin-bottom:8px">
          <option value="">-- No deputy set --</option>
          ${candidates.map(u=>`<option value="${u.id}" ${u.id===user.deputy_id?'selected':''}>${u.full_name} (${u.role})</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <div style="flex:1">
            <label style="font-size:11px;color:#666">From (optional)</label>
            <input type="date" id="deputy-from" value="${user.deputy_from || ''}" style="width:100%;padding:8px">
          </div>
          <div style="flex:1">
            <label style="font-size:11px;color:#666">Until (optional)</label>
            <input type="date" id="deputy-until" value="${user.deputy_until || ''}" style="width:100%;padding:8px">
          </div>
        </div>
        <input type="text" id="deputy-reason" placeholder="Reason — e.g. site visit Apr 28–May 2"
               value="${user.deputy_reason || ''}" style="width:100%;padding:8px;margin-bottom:8px">
        <button class="btn-primary" onclick="APP.saveDeputy()" style="width:100%">
          ${user.deputy_id ? 'Update Deputy' : 'Set Deputy'}
        </button>
        ${user.deputy_id ? `<button class="btn-sm" onclick="APP.removeDeputy()" style="width:100%;margin-top:6px;color:#C87060">Remove Deputy</button>` : ''}
      </div>
    </div>`;
  }

  // Leave request section for site managers
  let leaveHtml = '';
  if (me.role === 'site_manager') {
    leaveHtml = `<div class="card" style="margin-top:8px">
      <div class="card-title">Request Leave</div>
      <div style="padding:10px">
        <div class="field"><label>From Date</label><input type="date" id="leave-from"></div>
        <div class="field"><label>To Date</label><input type="date" id="leave-to"></div>
        <div class="field"><label>Reason (optional)</label><input id="leave-reason" placeholder="e.g. Family function"></div>
        <button class="btn-primary" onclick="APP.requestLeave()" style="width:100%">Request Leave</button>
      </div>
    </div>`;
  }

  const html = `
    <div class="section-header">My Profile</div>
    <div class="card">
      <div style="padding:12px">
        <div style="font-size:18px;font-weight:bold;color:#1D3D62">${me.full_name}</div>
        <div style="font-size:13px;color:#666;margin-top:4px">${me.role.replace(/_/g,' ')} · ${me.stream||'All'}</div>
        <div style="font-size:12px;color:#888;margin-top:2px">@${me.username}</div>
      </div>
    </div>
    <div class="card" style="margin-top:8px">
      <div class="card-title">Change Password</div>
      <div style="padding:10px">
        <div class="field"><label>Current Password</label><input type="password" id="cp-current" placeholder="current password"></div>
        <div class="field"><label>New Password</label><input type="password" id="cp-new" placeholder="min 8 characters"></div>
        <div class="field"><label>Confirm</label><input type="password" id="cp-confirm" placeholder="repeat new password"></div>
        <button class="btn-primary" onclick="APP.submitChangePassword()" style="width:100%">Update Password</button>
        <div id="cp-error" style="color:#C87060;font-size:12px;margin-top:4px"></div>
      </div>
    </div>
    ${deputyHtml}
    ${leaveHtml}
  `;
  UI.setContent(html);
};

APP.saveDeputy = async function() {
  const deputy_id = document.getElementById('deputy-select')?.value || null;
  const deputy_from = document.getElementById('deputy-from')?.value || null;
  const deputy_until = document.getElementById('deputy-until')?.value || null;
  const deputy_reason = document.getElementById('deputy-reason')?.value || null;
  const res = await API.call('PATCH', `/users/${APP.user.id}/deputy`,
    { deputy_id, deputy_from, deputy_until, deputy_reason });
  if (res?.success) { UI.toast(deputy_id ? 'Deputy set ✓' : 'Deputy removed ✓'); APP.loadProfile(); }
  else UI.toast('Failed');
};

APP.removeDeputy = async function() {
  const res = await API.call('PATCH', `/users/${APP.user.id}/deputy`, { deputy_id: null });
  if (res?.success) { APP.loadProfile(); UI.toast('Deputy removed ✓'); }
};

APP.requestLeave = async function() {
  const from   = document.getElementById('leave-from')?.value;
  const to     = document.getElementById('leave-to')?.value;
  const reason = document.getElementById('leave-reason')?.value;
  if (!from || !to) { UI.toast('Select dates'); return; }
  // POST /api/users/me/leave — user records their own leave; deputies pick it up.
  // Previously called /projects/${APP.currentProject}/leave (PMC-only route, wrong shape).
  const res = await API.call('POST', '/users/me/leave',
    { from_date: from, to_date: to, reason });
  if (res?.success) UI.toast('Leave recorded — your deputy will see it ✓');
  else UI.toast(res?.error || 'Failed');
};

// ── PETTY CASH FLOAT SCREEN
// Migrated to Alpine component in public/js/components/petty-cash.js (v3)
APP.loadPettyCash = async function(projectId) {
  if (window.Components?.mount && window.Alpine) {
    const mountFn = Components.mount('content-area', 'petty-cash', { projectId });
    return mountFn();
  }
  return APP._loadPettyCashLegacy(projectId);
};

APP._loadPettyCashLegacy = async function(projectId) {
  const res = await API.call('GET', `/finance/${projectId}/petty-cash`);
  if (!res) return;

  const balance  = res.balance || 0;
  const balColor = balance < 2000 ? '#C87060' : '#4A8A5A';
  const isPMC    = ['principal','design_principal','pmc_head'].includes(APP.user.role);

  let html = `<div class="section-header">Petty Cash Float</div>
    <div class="card" style="text-align:center;padding:16px">
      <div style="font-size:13px;color:#666">Current Balance</div>
      <div style="font-size:28px;font-weight:bold;color:${balColor}">${Money.formatRupee(balance)}</div>
      <div style="font-size:12px;color:#888">Spent: ${Money.formatRupee(res.total_spent||0)} · Replenished: ${Money.formatRupee(res.total_replenished||0)}</div>
    </div>`;

  if (isPMC) {
    html += `<div style="display:flex;gap:8px;margin:8px 0">
      <button class="btn-primary" style="flex:1" onclick="APP.showAddCashTxn(${projectId})">+ Add Spend</button>
      ${ ['principal','design_principal'].includes(APP.user.role) ? `<button class="btn-sm" style="flex:1" onclick="APP.showReplenish(${projectId})">Replenish</button>` : '' }
    </div>`;
  }

  html += `<div class="card">`;
  (res.transactions||[]).slice(0,20).forEach((t,i) => {
    const isSpend = t.txn_type === 'spend';
    html += `<div class="list-item" style="display:flex;justify-content:space-between;background:${i%2===0?'#F0F3F7':'#fff'}">
      <div>
        <div style="font-size:13px">${t.description}</div>
        <div style="font-size:11px;color:#888">${t.txn_date} · ${t.category} ${t.bill_available?'· Bill ✓':''}</div>
      </div>
      <div style="font-weight:bold;color:${isSpend?'#C87060':'#4A8A5A'}">${isSpend?'-':'+'} ${Money.formatRupee(t.amount)}</div>
    </div>`;
  });
  html += `</div>`;
  UI.setContent(html);
};

APP.showAddCashTxn = function(projectId) {
  UI.showModal('Add Petty Cash Spend', `
    <div class="field"><label>Date</label><input type="date" id="pct-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Description</label><input id="pct-desc" placeholder="e.g. Nails and screws from hardware shop"></div>
    <div class="field"><label>Amount (₹)</label><input id="pct-amount" type="number"></div>
    <div class="field"><label>Category</label>
      <select id="pct-cat">
        <option value="material">Material</option>
        <option value="labour">Labour</option>
        <option value="site_expense">Site Expense</option>
        <option value="other">Other</option>
      </select>
    </div>
    <button class="btn-primary" onclick="APP.addCashTxn(${projectId})" style="width:100%">Save</button>
  `);
};

APP.addCashTxn = async function(projectId) {
  const txn_date   = document.getElementById('pct-date')?.value;
  const description= document.getElementById('pct-desc')?.value;
  const amount     = document.getElementById('pct-amount')?.value;
  const category   = document.getElementById('pct-cat')?.value;
  if (!txn_date||!description||!amount) { UI.toast('Fill all fields'); return; }
  const res = await API.call('POST', `/finance/${projectId}/petty-cash`, { txn_date, description, amount, category });
  if (res?.success) { UI.closeModal(); APP.loadPettyCash(projectId); UI.toast('Transaction saved ✓'); }
  else UI.toast(res?.error || 'Failed');
};

APP.showReplenish = function(projectId) {
  UI.showModal('Replenish Float', `
    <div class="field"><label>Amount (₹)</label><input id="rep-amount" type="number"></div>
    <div class="field"><label>Notes</label><input id="rep-notes" placeholder="e.g. Float top-up for week 14"></div>
    <button class="btn-primary" onclick="APP.replenishFloat(${projectId})" style="width:100%">Replenish</button>
  `);
};

APP.replenishFloat = async function(projectId) {
  const amount = document.getElementById('rep-amount')?.value;
  const notes  = document.getElementById('rep-notes')?.value;
  if (!amount) { UI.toast('Enter amount'); return; }
  const res = await API.call('POST', `/finance/${projectId}/petty-cash/replenish`, { amount, notes });
  if (res?.success) { UI.closeModal(); APP.loadPettyCash(projectId); UI.toast('Float replenished ✓'); }
  else UI.toast('Failed');
};

// ── USER PENDING APPROVAL SCREEN
// Migrated to Alpine component in public/js/components/pending-users.js (v3)
APP.loadPendingUsers = async function() {
  if (window.Components?.mount && window.Alpine) {
    const mountFn = Components.mount('content-area', 'pending-users');
    return mountFn();
  }
  return APP._loadPendingUsersLegacy();
};

APP._loadPendingUsersLegacy = async function() {
  const res = await API.call('GET', '/user-management/pending');
  if (!res) return;

  let html = `<div class="section-header">Pending User Approvals</div>`;
  if (!res.pending?.length) {
    html += `<div class="empty-state">No pending approvals</div>`;
  } else {
    res.pending.forEach(u => {
      html += `<div class="card" style="margin-bottom:8px;border-left:4px solid #C8A040">
        <div style="padding:12px">
          <div style="font-weight:bold;font-size:15px">${u.full_name}</div>
          <div style="font-size:12px;color:#666">@${u.username} · ${APP._roleLabel(u.role)} · ${u.stream}</div>
          <div style="font-size:11px;color:#888;margin-top:2px">Requested by ${u.initiated_by_name} · ${new Date(u.initiated_at).toLocaleDateString()}</div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn-primary" style="flex:1" onclick="APP.approveUser(${u.id})">✓ Approve</button>
            <button class="btn-sm" style="flex:1;color:#C87060" onclick="APP.rejectUser(${u.id})">✗ Reject</button>
          </div>
        </div>
      </div>`;
    });
  }

  // Initiate new user button (for team heads)
  const canInitiate = ['design_head','services_head','pmc_head'].includes(APP.user.role);
  if (canInitiate) {
    html += `<button class="btn-primary" onclick="APP.showInitiateUser()" style="width:100%;margin-top:8px">+ Add New Team Member</button>`;
  }

  UI.setContent(html);
};

// NOTE: APP.approveUser + APP.rejectUser formerly defined here (~line 3923).
// Superseded by later definitions at ~5724 which use renderUsers for refresh.
// Deleted 2026-04-21 — first-declared was dead code per scanner check 5.

APP.showInitiateUser = function() {
  const roleOptions = {
    design_head:   [['team_lead','Team Lead'],['jr_architect','Jr Architect'],['jr_engineer','Jr Engineer']],
    services_head: [['services_engineer','Services Engineer']],
    pmc_head:      [['site_manager','Site Manager']],
  };
  const options = roleOptions[APP.user.role] || [];
  UI.showModal('Add Team Member', `
    <div class="field"><label>Full Name</label><input id="nu-name" placeholder="Full name"></div>
    <div class="field"><label>Username</label><input id="nu-username" placeholder="e.g. preethi.k"></div>
    <div class="field"><label>Phone (WhatsApp)</label><input id="nu-phone" placeholder="91XXXXXXXXXX"></div>
    <div class="field"><label>Role</label>
      <select id="nu-role">
        ${options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary" onclick="APP.initiateUser()" style="width:100%">Submit for Approval</button>
  `);
};

APP.initiateUser = async function() {
  const full_name = document.getElementById('nu-name')?.value;
  const username  = document.getElementById('nu-username')?.value;
  const phone     = document.getElementById('nu-phone')?.value;
  const role      = document.getElementById('nu-role')?.value;
  if (!full_name||!username||!role) { UI.toast('Fill all required fields'); return; }
  const res = await API.call('POST', '/user-management/initiate', { full_name, username, phone, role });
  if (res?.success) { UI.closeModal(); UI.toast('Request submitted — pending Principal/Design Principal approval ✓'); }
  else UI.toast(res?.error || 'Failed');
};

// ── DLP PUNCH LIST SCREEN
// Three states: open (vendor working) → resolved (awaiting signoff) → signed_off (closed).
// `accepted_by_client` is a side-state — defect accepted as-is by client.
APP.loadDLPPunchList = async function(projectId) {
  const res = await API.call('GET', `/issues/${projectId}/snags`);
  if (!res) return;

  const sevColor = { critical:'#C87060', major:'#C8A040', minor:'#4A8FA8' };
  const SIGNOFF_LABEL = { pmc_head:'PMC', design_head:'Design', services_head:'Services' };
  const myRole = APP.user.role;
  const canSignoff = ['pmc_head','design_head','services_head','principal','design_principal'].includes(myRole);

  let html = `<div class="section-header">DLP Punch List</div>
    <button class="btn-primary" onclick="APP.showRaiseDefect(${projectId})" style="width:100%;margin-bottom:8px">+ Raise Defect</button>`;

  const open       = (res.snags||[]).filter(s => s.status === 'open');
  const awaiting   = (res.snags||[]).filter(s => s.status === 'resolved');
  const signedOff  = (res.snags||[]).filter(s => s.status === 'signed_off' || s.status === 'accepted_by_client');

  // ── OPEN ─────────────────────────────────────────────────────────────────
  if (open.length) {
    html += `<div style="font-size:12px;font-weight:bold;color:#C87060;padding:4px 0">${open.length} OPEN</div>`;
    open.forEach(s => {
      html += `<div class="card" style="margin-bottom:6px;border-left:3px solid ${sevColor[s.severity]}">
        <div style="padding:10px">
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:11px;font-weight:bold;color:${sevColor[s.severity]}">${s.severity.toUpperCase()}</span>
            <span style="font-size:11px;color:#C87060">open${s.photo_count > 0 ? ` · 📷${s.photo_count}` : ''}</span>
          </div>
          <div style="font-size:13px;margin:4px 0">${s.description}</div>
          <div style="font-size:12px;color:#666">${s.trade} · ${s.location||''}</div>
          ${s.vendor_name?`<div style="font-size:12px;color:#888">Vendor: ${s.vendor_name}</div>`:''}
          ${s.due_date?`<div style="font-size:12px;color:#C87060">Due: ${s.due_date}</div>`:''}
          <button class="btn-sm" onclick="APP.resolveDefect(${s.id}, ${projectId})" style="margin-top:6px">Mark Resolved</button>
        </div>
      </div>`;
    });
  }

  // ── AWAITING SIGN-OFF ────────────────────────────────────────────────────
  if (awaiting.length) {
    html += `<div style="font-size:12px;font-weight:bold;color:#C8A040;padding:4px 0;margin-top:8px">${awaiting.length} AWAITING SIGN-OFF</div>`;
    awaiting.forEach(s => {
      const required = s.required_signoffs || [];
      const received = s.received_signoffs || [];
      const signedRoles = new Set(received.map(r => r.signed_for_role));
      const myAlreadySigned = received.some(r => r.signed_by_user_id === APP.user.id);
      const slotsRemaining = required.filter(r => !signedRoles.has(r));
      const showButton = canSignoff && slotsRemaining.length > 0 && !myAlreadySigned;

      html += `<div class="card" style="margin-bottom:6px;border-left:3px solid #C8A040">
        <div style="padding:10px">
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:11px;font-weight:bold;color:${sevColor[s.severity]}">${s.severity.toUpperCase()}</span>
            <span style="font-size:11px;color:#C8A040">awaiting sign-off</span>
          </div>
          <div style="font-size:13px;margin:4px 0">${s.description}</div>
          <div style="font-size:11px;color:#4A8A5A;margin-bottom:4px">✓ ${s.resolution_note || 'Resolved'}</div>
          <div style="display:flex;gap:6px;margin-top:4px;font-size:11px">`;
      required.forEach(r => {
        const sigRow = received.find(rec => rec.signed_for_role === r);
        html += sigRow
          ? `<span style="background:rgba(12,166,120,0.12);color:var(--green);padding:2px 6px;border-radius:3px;border:1px solid rgba(12,166,120,0.30)">✓ ${SIGNOFF_LABEL[r]||r}</span>`
          : `<span style="background:rgba(128,128,128,0.08);color:var(--muted);padding:2px 6px;border-radius:3px;border:1px solid rgba(128,128,128,0.18)">○ ${SIGNOFF_LABEL[r]||r}</span>`;
      });
      html += `</div>`;
      if (showButton) {
        html += `<button class="btn-sm" onclick="APP.signoffSnag(${s.id}, ${projectId})" style="margin-top:8px">Sign Off</button>`;
      }
      html += `</div></div>`;
    });
  }

  // ── SIGNED OFF ──────────────────────────────────────────────────────────
  if (signedOff.length) {
    html += `<div style="font-size:12px;font-weight:bold;color:#4A8A5A;padding:4px 0;margin-top:8px">${signedOff.length} SIGNED OFF</div>`;
    signedOff.forEach(s => {
      html += `<div class="card" style="margin-bottom:4px;opacity:0.7;border-left:3px solid #4A8A5A">
        <div style="padding:8px 10px">
          <div style="font-size:13px">${s.description}</div>
          <div style="font-size:11px;color:#4A8A5A">✓ ${s.status === 'accepted_by_client' ? 'Accepted by client' : 'Signed off'}</div>
        </div>
      </div>`;
    });
  }

  if (!res.snags?.length) html += `<div class="empty-state">No defects raised</div>`;
  UI.setContent(html);
};

// Sign off a resolved snag. The backend infers which slot the caller is
// filling based on their role (or deputy of an assigned role). Caller can
// optionally pick a slot when they're a universal signer (principal/dp).
APP.signoffSnag = async function(snagId, projectId) {
  const myRole = APP.user.role;
  let bodyRole = null;

  // Universal signers can choose which slot to fill; ask before submitting.
  if (['principal','design_principal'].includes(myRole)) {
    const choice = prompt('Which slot are you signing for? (pmc_head / design_head / services_head / principal)', 'principal');
    if (!choice) return;
    bodyRole = choice.trim();
  }

  const body = bodyRole ? { role: bodyRole } : {};
  const res = await API.call('POST', `/issues/${snagId}/snag-signoff`, body);
  if (res?.success) {
    UI.toast(res.all_signed ? 'All sign-offs received — snag closed ✓' : `Signed as ${res.slot} ✓`);
    APP.loadDLPPunchList(projectId);
  } else {
    UI.toast(res?.error || 'Sign-off failed');
  }
};

APP.showRaiseDefect = function(projectId) {
  UI.showModal('Raise Defect', `
    <div class="field"><label>Trade</label>
      <select id="def-trade">
        ${['Civil','Electrical','HVAC','Plumbing','Interior','IT','Other'].map(t=>`<option>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Location</label><input id="def-location" placeholder="e.g. Level 1 — Room 102"></div>
    <div class="field"><label>Description</label><input id="def-desc" placeholder="Describe the defect"></div>
    <div class="field"><label>Severity</label>
      <select id="def-sev"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select>
    </div>
    <div class="field"><label>Due Date</label><input type="date" id="def-due"></div>
    <div class="field"><label>Photo (optional)</label>
      <input type="file" id="def-photo" accept="image/*" capture="environment">
    </div>
    <button class="btn-primary" onclick="APP.raiseDefect(${projectId})" style="width:100%">Raise Defect</button>
  `);
};

APP.raiseDefect = async function(projectId) {
  const trade       = document.getElementById('def-trade')?.value;
  const location    = document.getElementById('def-location')?.value;
  const description = document.getElementById('def-desc')?.value;
  const severity    = document.getElementById('def-sev')?.value;
  const due_date    = document.getElementById('def-due')?.value;
  const photoFile   = document.getElementById('def-photo')?.files?.[0];
  if (!description) { UI.toast('Enter description'); return; }

  let res;
  if (photoFile) {
    // Multipart submission — photo + form fields
    const fd = new FormData();
    fd.append('trade', trade || '');
    fd.append('location', location || '');
    fd.append('description', description);
    fd.append('severity', severity || 'minor');
    if (due_date) fd.append('due_date', due_date);
    fd.append('photo', photoFile);
    res = await API.call('POST', `/issues/${projectId}/snags`, fd, true);
  } else {
    // JSON submission — no photo
    res = await API.call('POST', `/issues/${projectId}/snags`, { trade, location, description, severity, due_date });
  }

  if (res?.success) { UI.closeModal(); APP.loadDLPPunchList(projectId); UI.toast('Defect raised ✓'); }
  else UI.toast('Failed');
};

APP.resolveDefect = async function(snagId, projectId) {
  const note = prompt('Resolution note:');
  if (!note) return;
  const res = await API.call('PATCH', `/issues/${snagId}/resolve-snag`, { resolution_note: note });
  if (res?.success) { APP.loadDLPPunchList(projectId); UI.toast('Defect resolved ✓'); }
  else UI.toast('Failed');
};

// ── LESSONS LEARNED SCREEN
APP.loadLessonsLearned = async function(projectId) {
  const res = await API.call('GET', `/lessons/${projectId}`);
  if (!res) return;

  const lesson   = res.lesson;
  const inputs   = res.inputs || [];
  const isPrincipal = ['principal','design_principal'].includes(APP.user.role);
  const myInput  = inputs.find(i=>i.user_id===APP.user.id);

  let html = `<div class="section-header">Lessons Learned</div>`;

  // My input section
  html += `<div class="card">
    <div class="card-title">My Input</div>
    <div style="padding:10px">
      <div class="field"><label>What went well / what to improve / recommendations</label>
        <textarea id="ll-input" rows="4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px">${myInput?.input_text||''}</textarea>
      </div>
      <div class="field"><label>Category</label>
        <select id="ll-cat">
          <option value="what_went_well" ${myInput?.category==='what_went_well'?'selected':''}>What went well</option>
          <option value="improvement" ${myInput?.category==='improvement'?'selected':''}>What to improve</option>
          <option value="recommendation" ${myInput?.category==='recommendation'?'selected':''}>Recommendation</option>
          <option value="other" ${myInput?.category==='other'?'selected':''}>Other</option>
        </select>
      </div>
      <button class="btn-primary" onclick="APP.submitLessonInput(${projectId})" style="width:100%">Save My Input</button>
    </div>
  </div>`;

  // All inputs (for team heads and principals)
  if (['principal','design_principal','pmc_head','design_head','services_head'].includes(APP.user.role)) {
    html += `<div class="card" style="margin-top:8px"><div class="card-title">All Inputs (${inputs.length})</div>`;
    inputs.forEach(i => {
      html += `<div class="list-item">
        <div style="font-size:12px;font-weight:bold;color:#1D3D62">${i.user_name} · ${i.role}</div>
        <div style="font-size:13px;margin:4px 0">${i.input_text}</div>
        <div style="font-size:11px;color:#888">${i.category.replace(/_/g,' ')} ${i.signoff?'· Signed off ✓':''}</div>
      </div>`;
    });
    html += `</div>`;
  }

  // AI draft and publish (principals)
  if (isPrincipal) {
    html += `<div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-primary" style="flex:1" onclick="APP.generateLessonsDraft(${projectId})">Generate AI Draft</button>
      ${lesson?.ai_draft ? `<button class="btn-sm" style="flex:1" onclick="APP.showPublishLessons(${projectId})">Review & Publish</button>` : ''}
    </div>`;
    if (lesson?.ai_draft) {
      html += `<div class="card" style="margin-top:8px"><div class="card-title">AI Draft</div>
        <div style="padding:10px;font-size:13px;white-space:pre-wrap;color:#444">${lesson.ai_draft}</div>
      </div>`;
    }
  }

  UI.setContent(html);
};

APP.submitLessonInput = async function(projectId) {
  const input_text = document.getElementById('ll-input')?.value;
  const category   = document.getElementById('ll-cat')?.value;
  if (!input_text) { UI.toast('Enter your input'); return; }
  const res = await API.call('POST', `/lessons/${projectId}/input`, { input_text, category });
  if (res?.success) UI.toast('Input saved ✓');
  else UI.toast('Failed');
};

APP.generateLessonsDraft = async function(projectId) {
  UI.toast('Generating AI draft...');
  const res = await API.call('POST', `/lessons/${projectId}/generate`);
  if (res?.success) { APP.loadLessonsLearned(projectId); UI.toast('Draft generated ✓'); }
  else UI.toast('Failed to generate draft');
};

APP.showPublishLessons = async function(projectId) {
  const res = await API.call('GET', `/lessons/${projectId}`);
  UI.showModal('Review & Publish', `
    <div class="field"><label>Final Content (edit AI draft if needed)</label>
      <textarea id="ll-final" rows="10" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:12px">${res?.lesson?.ai_draft||''}</textarea>
    </div>
    <button class="btn-primary" onclick="APP.publishLessons(${projectId})" style="width:100%">Publish to All Team</button>
  `);
};

APP.publishLessons = async function(projectId) {
  const final_content = document.getElementById('ll-final')?.value;
  const res = await API.call('PATCH', `/lessons/${projectId}/publish`, { final_content });
  if (res?.success) { UI.closeModal(); APP.loadLessonsLearned(projectId); UI.toast('Published — visible to all nu associates team ✓'); }
  else UI.toast('Failed');
};

// ── KNOWLEDGE LIBRARY — firm-wide reading of published lessons
// Independent of project picker. Lists all published lessons across every
// project (active or completed), sorted newest first.
APP.renderKnowledgeLibrary = async function() {
  const res = await API.call('GET', '/lessons/library');
  const lessons = res?.lessons || [];
  // Stash so the filter input can re-render without a fetch
  APP._libraryCache = lessons;

  let html = `<div class="section-header">Knowledge Library</div>
    <div style="font-size:12px;color:#666;padding:0 4px 8px">Lessons learned published from completed projects, available to the entire firm.</div>`;

  if (!lessons.length) {
    html += `<div class="empty-state">No published lessons yet. Lessons appear here when a Principal publishes after project closure.</div>`;
    UI.setContent(html);
    return;
  }

  // Search box — filters by project name, client name, published_by, content
  html += `<div style="padding:0 4px 10px">
    <input type="text" id="library-search" placeholder="Search project, client, or content..." 
      oninput="APP._renderLibraryList(this.value)"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px">
  </div>`;

  html += `<div id="library-list"></div>`;
  UI.setContent(html);
  // Render the full list initially
  APP._renderLibraryList('');
};

// Filter helper — runs against the cached list, no re-fetch
APP._renderLibraryList = function(query) {
  const lessons = APP._libraryCache || [];
  const q = (query || '').trim().toLowerCase();
  const filtered = q
    ? lessons.filter(l =>
        (l.project_name || '').toLowerCase().includes(q) ||
        (l.client_name || '').toLowerCase().includes(q) ||
        (l.published_by_name || '').toLowerCase().includes(q) ||
        (l.published_content || '').toLowerCase().includes(q)
      )
    : lessons;

  let html = '';
  if (!filtered.length) {
    html = `<div class="empty-state" style="margin:12px">No lessons match "${q}".</div>`;
  } else {
    filtered.forEach(l => {
      const dateStr = new Date(l.published_at).toLocaleDateString();
      html += `<button class="card" style="min-height:44px;margin-bottom:8px;cursor:pointer" onclick="APP.openLibraryLesson(${l.id})">
        <div style="padding:10px">
          <div style="font-size:14px;font-weight:bold;color:#1D3D62">${l.project_name||'Unknown project'}</div>
          ${l.client_name?`<div style="font-size:12px;color:#666">${l.client_name}</div>`:''}
          <div style="font-size:11px;color:#888;margin-top:4px">Published ${dateStr}${l.published_by_name?` by ${l.published_by_name}`:''}</div>
        </div>
      </button>`;
    });
    if (q) {
      html = `<div style="font-size:11px;color:#888;padding:4px 8px;margin-bottom:6px">${filtered.length} of ${lessons.length} match "${q}"</div>` + html;
    }
  }
  const list = document.getElementById('library-list');
  if (list) list.innerHTML = html;
};

APP.openLibraryLesson = async function(lessonId) {
  const res = await API.call('GET', `/lessons/library/${lessonId}`);
  if (!res?.lesson) { UI.toast('Lesson not found'); return; }
  const l = res.lesson;
  const dateStr = new Date(l.published_at).toLocaleDateString();
  UI.showModal(`${l.project_name} — Lessons Learned`, `
    <div style="font-size:11px;color:#888;margin-bottom:8px">
      ${l.client_name?`Client: ${l.client_name} · `:''}Published ${dateStr}${l.published_by_name?` by ${l.published_by_name}`:''}
    </div>
    <div style="white-space:pre-wrap;font-size:13px;line-height:1.5;color:#222;max-height:60vh;overflow-y:auto">${l.published_content||''}</div>
    <button class="btn-secondary" onclick="UI.closeModal()" style="width:100%;margin-top:12px">Close</button>
  `);
};

// ── AI SETTINGS (Principal only)
const AI_FEATURES = [
  { key: 'drawing_sanity_check', label: 'Auto Drawing Sanity Check', desc: 'Validates uploaded drawing metadata against title block' },
  { key: 'detail_drawing_analysis', label: 'Auto Detail Drawing Analysis', desc: 'Extracts trade and reference info from detail uploads' },
  { key: 'rfi_response_check', label: 'Auto RFI Response Check', desc: 'Checks if uploaded drawing answers the RFI question' },
  { key: 'revision_change_analysis', label: 'Auto Revision Change Analysis', desc: 'Compares old vs new drawing revisions, flags impacts' },
  { key: 'photo_auto_tagging', label: 'Photo Auto-Tagging', desc: 'Suggests task association for uploaded site photos' },
  { key: 'hsn_code_suggestion', label: 'HSN Code Suggestion', desc: 'Auto-suggests HSN code on BOQ item edit' },
  { key: 'similar_query_search', label: 'Similar Query Search', desc: 'Shows past matching queries while raising a new one' },
  { key: 'material_approval_check', label: 'Material Approval Check', desc: 'Flags BOQ items needing client material approval' },
  { key: 'boq_hsn_autofill', label: 'Auto-fill BOQ HSN', desc: 'Shows HSN suggestion button in BOQ edit modal' },
  { key: 'similar_query_dedup', label: 'Similar Query Dedup', desc: 'Shows similar past queries in Raise Query modal' },
];

// ── PROJECT CLOSURE SCREEN
APP.loadProjectClosure = async function(projectId) {
  const res = await API.call('GET', `/handover/${projectId}/closure`);
  if (!res) return;

  const roleLabel = { pmc_head:'PMC Head', design_head:'Design Head', services_head:'Services Head', principal:'Principal' };
  const myRole    = { pmc_head:'pmc_head', design_head:'design_head', services_head:'services_head', principal:'principal', design_principal:'principal' }[APP.user.role];
  const mySigned  = res.signoffs?.find(s=>s.role===myRole);

  let html = `<div class="section-header">Project Closure</div>
    <div class="card">
      <div class="card-title">Sign-offs Required</div>`;

  const allRoles = ['pmc_head','design_head','services_head','principal'];
  allRoles.forEach(role => {
    const signed = res.signoffs?.find(s=>s.role===role);
    html += `<div class="list-item" style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px">${roleLabel[role]}</div>
      <div>${signed
        ? `<span style="color:#4A8A5A;font-size:13px">✓ ${signed.signed_by_name} · ${new Date(signed.signed_at).toLocaleDateString()}</span>`
        : `<span style="color:#888;font-size:13px">Pending</span>`}
      </div>
    </div>`;
  });

  html += `</div>`;

  if (myRole && !mySigned) {
    html += `<div class="card" style="margin-top:8px">
      <div class="card-title">My Sign-off</div>
      <div style="padding:10px">
        <div style="font-size:13px;color:#666;margin-bottom:10px">By signing off, you confirm all items in your discipline are complete and documented.</div>
        <div class="field"><label>Notes (optional)</label><input id="closure-notes" placeholder="Any final observations"></div>
        <button class="btn-primary" onclick="APP.signOffClosure(${projectId})" style="width:100%">Sign Off — ${roleLabel[myRole]||'My Role'}</button>
      </div>
    </div>`;
  }

  if (res.complete) {
    html += `<div style="background:rgba(12,166,120,0.12);border:1px solid rgba(12,166,120,0.35);border-radius:8px;padding:16px;text-align:center;margin-top:8px">
      <div style="font-size:18px;color:#4A8A5A;font-weight:bold">✓ Project Closed</div>
      <div style="font-size:13px;color:#666;margin-top:4px">All sign-offs received. Project is now read-only.</div>
    </div>`;
  }

  UI.setContent(html);
};

APP.signOffClosure = async function(projectId) {
  const notes = document.getElementById('closure-notes')?.value;
  const res   = await API.call('POST', `/handover/${projectId}/closure/signoff`, { notes, checklist_items: [] });
  if (res?.success) {
    APP.loadProjectClosure(projectId);
    UI.toast(res.all_signed ? 'All signed — project closed ✓' : 'Sign-off recorded ✓');
  } else UI.toast(res?.error || 'Failed');
};

// ── HANDOVER CHECKLIST SCREEN
APP.loadHandoverChecklist = async function(projectId) {
  const res = await API.call('GET', `/handover/${projectId}/checklist`);
  if (!res) return;

  const discColor = { architectural:'#1D3D62', services:'#4A8FA8', pmc:'#4A8A5A', statutory:'#C8A040' };
  const byDisc = {};
  (res.items||[]).forEach(i => {
    if (!byDisc[i.discipline]) byDisc[i.discipline] = [];
    byDisc[i.discipline].push(i);
  });

  let html = `<div class="section-header">Handover Checklist</div>
    <div class="card" style="text-align:center;padding:12px;margin-bottom:8px">
      <div style="font-size:24px;font-weight:bold;color:#1D3D62">${res.completion_pct}%</div>
      <div style="font-size:12px;color:#666">${res.submitted} of ${res.total} documents submitted</div>
      <div style="background:var(--border);height:8px;border-radius:4px;margin-top:8px;overflow:hidden">
        <div style="background:var(--green);height:100%;width:${res.completion_pct}%;border-radius:4px"></div>
      </div>
    </div>`;

  Object.keys(byDisc).forEach(disc => {
    html += `<div class="card" style="margin-bottom:8px">
      <div class="card-title" style="background:${discColor[disc]||'#888'};color:#fff">${disc.charAt(0).toUpperCase()+disc.slice(1)}</div>`;
    byDisc[disc].forEach(item => {
      const done = !!item.file_path;
      html += `<div class="list-item" style="display:flex;justify-content:space-between;align-items:center;opacity:${item.is_applicable?1:0.4}">
        <div style="flex:1">
          <div style="font-size:13px${!item.is_applicable?' text-decoration:line-through':''}">${item.item_name}</div>
          ${done ? `<div style="font-size:11px;color:#4A8A5A">✓ Uploaded ${new Date(item.uploaded_at).toLocaleDateString()}</div>` : ''}
        </div>
        <div>
          ${!done && item.is_applicable ? `<button class="btn-sm" onclick="APP.uploadChecklistDoc(${item.id}, ${projectId})">Upload</button>` : ''}
          ${done ? `<a href="${API.fileUrl(item.file_url || item.file_path, 'documents')}" target="_blank" class="btn-sm btn-secondary" style="margin-right:8px;text-decoration:none">View</a><span style="color:#4A8A5A;font-size:18px">✓</span>` : `<span style="color:#ccc;font-size:18px">○</span>`}
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  if (!res.items?.length) {
    html += `<button class="btn-primary" onclick="APP.initChecklist(${projectId})" style="width:100%">Initialise Checklist from Template</button>`;
  }

  UI.setContent(html);
};

APP.initChecklist = async function(projectId) {
  const res = await API.call('POST', `/handover/${projectId}/checklist/initialise`);
  if (res?.success) { APP.loadHandoverChecklist(projectId); UI.toast(`${res.items_created} items initialised ✓`); }
  else UI.toast('Failed');
};

APP.uploadChecklistDoc = function(itemId, projectId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.pdf,.doc,.docx,.jpg,.png';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('doc', file);
    const res = await API.call('POST', `/handover/${projectId}/checklist/${itemId}/upload`, fd, true);
    if (res?.success) { APP.loadHandoverChecklist(projectId); UI.toast('Document uploaded ✓'); }
    else UI.toast(res?.error || 'Upload failed');
  };
  input.click();
};

APP.renderHandover = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  let html = APP._projectSelectHtml('APP.renderHandover()');

  const [checkRes, closureRes] = await Promise.all([
    API.get(`/handover/${pid}/checklist`).catch(() => null),
    API.get(`/handover/${pid}/closure`).catch(() => null),
  ]);

  const items = checkRes?.items || [];
  const completion = checkRes?.completion_pct ?? 0;
  const submitted  = checkRes?.submitted ?? 0;
  const total      = checkRes?.total ?? 0;
  const signoffs   = closureRes?.signoffs || [];
  const closureComplete = closureRes?.complete || false;
  const myRole     = APP.user?.role;
  const isPMC      = ['pmc_head','principal','design_principal'].includes(myRole);
  // Roles that must sign a closure (matches CLOSURE_SIGNOFF_ROLES in handover.js).
  // They may also attach discipline documents to checklist items.
  const CLOSURE_ROLES  = ['pmc_head','design_head','services_head','principal','design_principal'];
  const canHandoverAct = CLOSURE_ROLES.includes(myRole);

  // Progress bar
  const barColor = completion === 100 ? 'var(--green)' : completion > 60 ? 'var(--amber)' : 'var(--navy)';
  html += `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-weight:700;font-size:15px;color:var(--navy)">Handover Checklist</div>
      <span style="font-family:var(--mono);font-size:13px;color:var(--muted)">${submitted} / ${total} documents</span>
    </div>
    <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden;margin-bottom:6px">
      <div style="background:${barColor};height:100%;width:${completion}%;border-radius:3px;transition:width .3s"></div>
    </div>
    <div style="font-size:11px;color:${barColor};font-weight:600">${completion}% complete</div>
  </div>`;

  if (!items.length) {
    if (isPMC) {
      html += `<div style="text-align:center;padding:24px 0">
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Checklist not initialised for this project yet.</div>
        <button class="btn-sm navy" onclick="APP._initHandoverChecklist(${pid})">Initialise Checklist</button>
      </div>`;
    } else {
      html += UI.empty('','Handover checklist not set up yet');
    }
  } else {
    const discColor = { architectural:'#1D3D62', services:'#4A8FA8', pmc:'#4A8A5A', statutory:'#C8A040' };
    const byDisc = {};
    items.forEach(i => { const d = i.discipline || 'other'; (byDisc[d] = byDisc[d] || []).push(i); });

    Object.keys(byDisc).forEach(disc => {
      const list = byDisc[disc];
      const doneCount = list.filter(i => i.file_url).length;
      html += `<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:8px;height:8px;border-radius:50%;background:${discColor[disc]||'#888'};flex-shrink:0"></div>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">${disc.charAt(0).toUpperCase()+disc.slice(1)}</span>
          <span style="font-size:11px;color:var(--muted);font-family:var(--mono)">${doneCount}/${list.length}</span>
        </div>`;
      list.forEach(item => {
        const done = !!item.file_url;
        const na = !item.is_applicable;
        html += `<div class="card" style="padding:10px 14px;margin-bottom:6px;${na?'opacity:0.45':''}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
              ${done ? 'background:var(--green);color:#fff' : 'background:var(--border);color:var(--muted)'}">
              ${done ? '✓' : '○'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:${na?'var(--muted)':'var(--text)'};${na?'text-decoration:line-through':''}">${UI.escapeText(item.item_name)}</div>
              ${done ? `<div style="font-size:11px;color:var(--green);margin-top:1px">Uploaded ${UI.fmtDate(item.uploaded_at)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              ${done ? `<button class="btn-sm" onclick="window.open('${item.file_url}','_blank')">View</button>` : ''}
              ${canHandoverAct && !na ? `<button class="btn-sm${done?'':' navy'}" onclick="APP._uploadHandoverItem(${pid},${item.id})">${done ? 'Replace' : 'Upload'}</button>` : ''}
            </div>
          </div>
        </div>`;
      });
      html += `</div>`;
    });
  }

  // Closure signoffs
  if (items.length) {
    const roleLabel = { pmc_head:'PMC Head', design_head:'Design Head', services_head:'Services Head', principal:'Principal', design_principal:'Design Principal' };
    // Each role signs its OWN slot (design_principal is now a distinct required slot).
    const mySignoffRole = { pmc_head:'pmc_head', design_head:'design_head', services_head:'services_head', principal:'principal', design_principal:'design_principal' }[myRole];
    const mySigned = signoffs.find(s => s.role === mySignoffRole);

    html += `<div class="sec-hdr-row" style="margin-top:20px">
      <div class="sec-label" style="margin:0;flex:1">Project Closure${closureComplete ? ' — Complete' : ''}</div>
      ${closureComplete ? '<span class="badge b-green">All signed</span>' : ''}
    </div>`;

    const allRoles = ['pmc_head','design_head','services_head','principal','design_principal'];
    allRoles.forEach(role => {
      const signed = signoffs.find(s => s.role === role);
      html += `<div class="card" style="padding:10px 14px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
            ${signed ? 'background:var(--green);color:#fff' : 'background:var(--border);color:var(--muted)'}">
            ${signed ? '✓' : '○'}
          </div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${roleLabel[role]}</div>
            ${signed ? `<div style="font-size:11px;color:var(--green)">${signed.signed_by_name} · ${UI.fmtDate(signed.signed_at)}</div>` : '<div style="font-size:11px;color:var(--muted)">Pending</div>'}
          </div>
          ${mySignoffRole === role && !mySigned ? `<button class="btn-sm navy" onclick="APP._handoverSignoff(${pid})">Sign Off</button>` : ''}
        </div>
      </div>`;
    });
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP._initHandoverChecklist = async function(pid) {
  const res = await API.post(`/handover/${pid}/checklist/initialise`, {});
  if (res?.success) { UI.toast(`${res.items_created} items initialised`); APP.renderHandover(); }
  else UI.toast(res?.error || 'Failed');
};

APP._uploadHandoverItem = function(pid, itemId) {
  UI.openModal('Upload Handover Document', `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">
      Upload the document for this checklist item. PDF, Word, or image formats accepted.
    </div>
    <div class="field-row">
      <label class="field-label">Document *</label>
      <input type="file" id="hov-doc" accept=".pdf,.doc,.docx,image/*">
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn-primary" onclick="APP._submitHandoverDoc(${pid},${itemId})">Upload</button>
      <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
    </div>
  `);
};

APP._submitHandoverDoc = async function(pid, itemId) {
  const file = document.getElementById('hov-doc')?.files?.[0];
  if (!file) { UI.toast('Select a file first'); return; }
  const fd = new FormData();
  fd.append('doc', file);
  const res = await API.call('POST', `/handover/${pid}/checklist/${itemId}/upload`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Document uploaded'); APP.renderHandover(); }
  else UI.toast(res?.error || 'Upload failed');
};

APP._handoverSignoff = async function(pid) {
  const notes = document.getElementById('closure-notes')?.value || '';
  const res = await API.post(`/handover/${pid}/closure/signoff`, { notes });
  if (res?.success) { UI.toast(res.all_signed ? 'All signed — project closed' : 'Sign-off recorded'); APP.renderHandover(); }
  else UI.toast(res?.error || 'Failed');
};

// ════════════════════════════════════════════════════════
// LOOKUP HELPERS — GST, IFSC, PAN auto-populate
// ════════════════════════════════════════════════════════

APP.lookupGSTIN = async function(gstin, targetFields) {
  if (!gstin || gstin.length !== 15) return;
  UI.toast('Looking up GSTIN...');
  const res = await API.call('GET', `/lookup/gstin/${gstin}`);
  if (res?.error) { UI.toast('GSTIN: ' + res.error); return; }
  if (res?.legal_name && targetFields.legal_name) {
    const el = document.getElementById(targetFields.legal_name);
    if (el && !el.value) el.value = res.legal_name;
  }
  if (res?.trade_name && targetFields.trade_name) {
    const el = document.getElementById(targetFields.trade_name);
    if (el && !el.value) el.value = res.trade_name || res.legal_name;
  }
  if (res?.address && targetFields.address) {
    const el = document.getElementById(targetFields.address);
    if (el && !el.value) el.value = res.address;
  }
  if (res?.state && targetFields.state) {
    const el = document.getElementById(targetFields.state);
    if (el && !el.value) el.value = res.state;
  }
  if (res?.status) {
    const statusEl = document.getElementById(targetFields.status || 'gstin-status');
    if (statusEl) {
      statusEl.textContent = res.status;
      statusEl.style.color = res.status === 'Active' ? '#4A8A5A' : '#C87060';
    }
  }
  UI.toast(res.note ? 'GSTIN: verify manually' : `✓ ${res.trade_name || res.legal_name}`);
};

APP.lookupIFSC = async function(ifsc, targetFields) {
  if (!ifsc || ifsc.length !== 11) return;
  const res = await API.call('GET', `/lookup/ifsc/${ifsc}`);
  if (res?.error) { UI.toast('IFSC: ' + res.error); return; }
  if (res?.bank && targetFields.bank) {
    const el = document.getElementById(targetFields.bank);
    if (el) el.value = res.bank;
  }
  if (res?.branch && targetFields.branch) {
    const el = document.getElementById(targetFields.branch);
    if (el) el.value = `${res.branch} — ${res.city || ''}`;
  }
  UI.toast(`✓ ${res.bank} — ${res.branch}`);
};

APP.lookupPAN = async function(pan) {
  if (!pan || pan.length !== 10) return;
  const res = await API.call('GET', `/lookup/pan/${pan}`);
  if (!res?.valid) { UI.toast('PAN: ' + (res?.error || 'Invalid')); return; }
  UI.toast(`✓ PAN valid — ${res.entity_type}${res.name ? ' — ' + res.name : ''}`);
  return res;
};

APP.getWeatherForReport = async function() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const res = await API.call('GET', `/lookup/weather?lat=${latitude}&lng=${longitude}`);
    if (res?.condition) {
      const el = document.getElementById('weather-field');
      if (el) {
        el.value = res.condition;
        UI.toast(`Weather: ${res.condition}${res.temp_c ? ' · ' + res.temp_c + '°C' : ''}`);
      }
    }
  }, () => {}); // Silently fail if no location permission
};

// ── VENDOR REGISTRATION WITH AUTO-POPULATE
APP.showAddVendorMasterModal = function() {
  UI.showModal('Register New Vendor', `
    <div class="field">
      <label>GSTIN <span style="color:#888;font-size:11px">(auto-fills details)</span></label>
      <div style="display:flex;gap:6px">
        <input id="vm-gstin" placeholder="29AAAAA0000A1Z0" style="flex:1" maxlength="15"
          oninput="this.value=this.value.toUpperCase()"
          onblur="APP.lookupGSTIN(this.value, {legal_name:'vm-name',trade_name:'vm-trade',address:'vm-address',state:'vm-state'})">
        <button class="btn-sm" onclick="APP.lookupGSTIN(document.getElementById('vm-gstin').value, {legal_name:'vm-name',trade_name:'vm-trade',address:'vm-address',state:'vm-state'})">Lookup</button>
      </div>
      <div id="gstin-status" style="font-size:11px;margin-top:2px"></div>
    </div>
    <div class="field"><label>Legal Name</label><input id="vm-name" placeholder="Auto-filled from GSTIN"></div>
    <div class="field"><label>Trade Name</label><input id="vm-trade" placeholder="Auto-filled from GSTIN"></div>
    <div class="field"><label>Trade / Discipline</label>
      <select id="vm-trade-type">
        ${['Civil','Electrical','HVAC','Plumbing','Interior','IT','Landscaping','Other'].map(t=>`<option>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Contact Person</label><input id="vm-contact" placeholder="Name of site contact"></div>
    <div class="field"><label>Phone (WhatsApp)</label><input id="vm-phone" placeholder="91XXXXXXXXXX" type="tel"></div>
    <div class="field">
      <label>IFSC Code <span style="color:#888;font-size:11px">(auto-fills bank)</span></label>
      <div style="display:flex;gap:6px">
        <input id="vm-ifsc" placeholder="ICIC0001234" style="flex:1" maxlength="11"
          oninput="this.value=this.value.toUpperCase()"
          onblur="APP.lookupIFSC(this.value, {bank:'vm-bank',branch:'vm-branch'})">
        <button class="btn-sm" onclick="APP.lookupIFSC(document.getElementById('vm-ifsc').value, {bank:'vm-bank',branch:'vm-branch'})">Lookup</button>
      </div>
    </div>
    <div class="field"><label>Bank Name</label><input id="vm-bank" placeholder="Auto-filled from IFSC"></div>
    <div class="field"><label>Branch</label><input id="vm-branch" placeholder="Auto-filled from IFSC"></div>
    <div class="field"><label>Account Number</label><input id="vm-account" placeholder="Bank account number"></div>
    <button class="btn-primary" onclick="APP.saveVendorMaster()" style="width:100%;margin-top:8px">Register Vendor</button>
  `);
};

APP.saveVendorMaster = async function() {
  const vendor_name    = document.getElementById('vm-name')?.value || document.getElementById('vm-trade')?.value;
  const trade          = document.getElementById('vm-trade-type')?.value;
  const gst_number     = document.getElementById('vm-gstin')?.value;
  const contact_person = document.getElementById('vm-contact')?.value;
  const phone          = document.getElementById('vm-phone')?.value;
  const bank_ifsc      = document.getElementById('vm-ifsc')?.value;
  const bank_name      = document.getElementById('vm-bank')?.value;
  const bank_account   = document.getElementById('vm-account')?.value;

  if (!vendor_name || !trade) { UI.toast('Vendor name and trade required'); return; }

  const res = await API.call('POST', '/vendors/master', {
    vendor_name, trade, gst_number, contact_person, phone,
    bank_ifsc, bank_name, bank_account,
  });
  if (res?.success) {
    UI.closeModal();
    UI.toast(`✓ ${vendor_name} added to master vendor list`);
  } else UI.toast(res?.error || 'Failed to register vendor');
};

// ── AI HELPERS wired to UI events

APP.suggestHSN = async function(description, trade, targetId) {
  if (!description) return;
  const res = await API.call('POST', '/ai/suggest-hsn', { item_description: description, trade });
  if (res?.suggestion?.hsn_code) {
    const el = document.getElementById(targetId);
    if (el) el.value = res.suggestion.hsn_code;
    UI.toast(`HSN suggested: ${res.suggestion.hsn_code} (${res.suggestion.confidence} confidence)`);
  } else {
    UI.toast('AI could not suggest an HSN code — enter manually');
  }
};

APP.draftCNText = async function(projectName) {
  const desc = document.getElementById('cn-plain-desc')?.value;
  const trade = document.getElementById('cn-source')?.value;
  if (!desc) { UI.toast('Describe the change first'); return; }
  UI.toast('Drafting CN text...');
  const res = await API.call('POST', '/ai/draft-cn', {
    plain_description: desc, trade, project_name: projectName,
  });
  if (res?.draft) {
    const titleEl = document.getElementById('cn-title');
    const descEl  = document.getElementById('cn-desc');
    if (titleEl && res.draft.cn_title) titleEl.value = res.draft.cn_title;
    if (descEl && res.draft.cn_description) descEl.value = res.draft.cn_description;
    UI.toast('CN text drafted — review and edit before submitting');
  } else {
    UI.toast('AI unavailable — write the CN text manually');
  }
};

APP.checkSimilarQueries = async function(question, projectId, trade) {
  if (!question || question.length < 10) return;
  const res = await API.call('POST', '/ai/similar-queries', { question, project_id: projectId, trade });
  if (res?.similar?.length) {
    const container = document.getElementById('similar-queries-container');
    if (container) {
      container.innerHTML = `<div style="font-size:12px;font-weight:bold;color:#C8A55A;margin-bottom:6px">Similar past queries:</div>` +
        res.similar.map(s => `<div style="background:var(--bg);padding:8px;border-radius:4px;margin-bottom:4px;font-size:12px;border:1px solid var(--border)">
          <div style="color:#1D3D62;font-weight:bold">${s.question}</div>
          <div style="color:#4A8A5A;margin-top:2px">✓ ${s.resolution}</div>
          <div style="color:#888;font-size:11px">${s.project_name} · ${s.similarity} similarity</div>
        </div>`).join('');
      container.style.display = 'block';
    }
  }
};

APP.readInvoice = async function(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('invoice', file);
  UI.toast('Reading invoice...');
  const res = await API.call('POST', '/ai/read-invoice', fd, true);
  if (res?.extracted) {
    const e = res.extracted;
    // Pre-fill payment entry fields from scanned invoice
    if (e.total_amount) {
      const el = document.getElementById('pay-amt');
      if (el) el.value = e.total_amount;
    }
    // Add invoice details to notes
    const parts = [];
    if (e.invoice_number) parts.push('Inv: ' + e.invoice_number);
    if (e.invoice_date) parts.push('Date: ' + e.invoice_date);
    if (e.gst_amount) parts.push('GST: ' + e.gst_amount);
    if (parts.length) {
      const notesEl = document.getElementById('pay-notes');
      if (notesEl) notesEl.value = parts.join(' · ');
    }
    UI.toast('Invoice read — review amount before submitting');
  } else {
    UI.toast(res?.error || 'Could not read invoice — fill manually');
  }
};

// ═══════════════════════════════════════════════════
// PMC SCREENS
// ═══════════════════════════════════════════════════

// ── DAILY REPORTS — PMC batch approve + anomaly view
APP.renderDailyReports = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  // Daily reports endpoint (Sprint 3 Item 10). The earlier /reports/:pid endpoint
  // returned weekly_reports and is reserved for the weekly health/report view.
  const data = await API.get(`/daily-reports/${pid}`);
  if (!data) return;
  const reports = data.reports || [];

  const pending  = reports.filter(r => r.status === 'pending_review');
  const flagged  = reports.filter(r => r.status === 'flagged');

  let html = APP._projectSelectHtml('APP.renderDailyReports()');

  if (pending.length) {
    html += `<div class="sec-label">Pending Approval (${pending.length})</div>
    <div class="action-item c-navy" style="margin-bottom:14px">
      <div class="ai-icon"></div>
      <div class="ai-body">
        <div class="ai-title">Approve all ${pending.length} reports</div>
        <div class="ai-meta">One tap — batch approve all pending + flagged</div>
      </div>
      <button class="btn-sm approve" onclick="APP.batchApproveReports('${pid}')">Approve All</button>
    </div>`;
    pending.forEach(r => {
      html += `<div class="report-card" data-report-id="${r.id}">
        <div class="rc-header">
          <div>
            <div class="rc-date">${UI.fmtDate(r.report_date)}</div>
            <div class="rc-who">${r.site_manager_name||'—'}</div>
          </div>
          <span class="badge b-amber">Pending</span>
        </div>
        ${r.overall_notes ? `<div class="rc-note">"${r.overall_notes.substring(0,120)}"</div>` : ''}
        ${r.file_url ? `<div style="margin-top:4px"><a href="${r.file_url}" target="_blank" class="btn-sm" style="text-decoration:none">View Attachment</a></div>` : ''}
        <div class="btn-row" style="margin-top:8px">
          <button class="btn-sm approve" onclick="APP.approveDailyReport(${r.id})">Approve</button>
          <button class="btn-sm reject"  onclick="APP.flagDailyReport(${r.id})">Flag</button>
        </div>
      </div>`;
    });
  }

  if (flagged.length) {
    html += `<div class="sec-label">Flagged (${flagged.length})</div>`;
    flagged.forEach(r => {
      html += `<div class="report-card" data-report-id="${r.id}">
        <div class="rc-header">
          <div>
            <div class="rc-date">${UI.fmtDate(r.report_date)}</div>
            <div class="rc-who">${r.site_manager_name||'—'}</div>
          </div>
          <span class="badge b-red">Flagged</span>
        </div>
        ${r.flag_reason ? `<div class="rc-note" style="color:var(--red)">${r.flag_reason.substring(0,120)}</div>` : ''}
        ${r.file_url ? `<div style="margin-top:4px"><a href="${r.file_url}" target="_blank" class="btn-sm" style="text-decoration:none">View Attachment</a></div>` : ''}
        <div class="btn-row" style="margin-top:8px">
          <button class="btn-sm approve" onclick="APP.approveDailyReport(${r.id})">Approve anyway</button>
        </div>
      </div>`;
    });
  }

  if (!pending.length && !flagged.length) {
    html += UI.empty('','All reports approved — nothing pending');
  }

  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Recent Reports</div>
  </div>`;
  reports.filter(r => r.status === 'approved').slice(0,8).forEach(r => {
    html += `<div class="report-card">
      <div class="rc-header">
        <div>
          <div class="rc-date">${UI.fmtDate(r.report_date)}</div>
          <div class="rc-who">${r.site_manager_name||'—'}</div>
        </div>
        <span class="badge b-green">Approved</span>
      </div>
      ${r.overall_notes ? `<div class="rc-note">"${r.overall_notes.substring(0,120)}"</div>` : ''}
      ${r.file_url ? `<div style="margin-top:4px"><a href="${r.file_url}" target="_blank" class="btn-sm" style="text-decoration:none">View Attachment</a></div>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.approveDailyReport = async function(id) {
  const res = await API.post(`/daily-reports/${id}/approve`, {});
  if (res?.success) { UI.toast('Report approved ✓'); APP.renderDailyReports(); }
  else UI.toast(res?.error || 'Approval failed');
};
APP.flagDailyReport = async function(id) {
  const reason = prompt('Flag reason (min 5 chars) — what needs rework?');
  if (!reason || reason.trim().length < 5) return;
  const res = await API.post(`/daily-reports/${id}/flag`, { reason: reason.trim() });
  if (res?.success) { UI.toast('Report flagged ✓'); APP.renderDailyReports(); }
  else UI.toast(res?.error || 'Flag failed');
};
APP.batchApproveReports = async function(pid) {
  const res = await API.post(`/daily-reports/${pid}/batch-approve`, {});
  if (res?.success) { UI.toast(`${res.approved} report${res.approved!==1?'s':''} approved ✓`); APP.renderDailyReports(); }
  else UI.toast(res?.error || 'Approval failed');
};
APP.viewReport = function(id) {
  UI.toast('Opening full report...');
};

// ── GRN — raise + approve
APP.renderGRN = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/grn/${pid}`);
  if (!data) return;
  const grns = data.grns || [];

  const pending = grns.filter(g => g.status === 'pending');
  const role = APP.user.role;
  const canRaise = ['site_manager','senior_site_manager','pmc_head'].includes(role);
  const canApprove = ['senior_site_manager','pmc_head','principal','design_principal'].includes(role);
  const canFlagGRN = ['pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderGRN()');

  if (pending.length && canApprove) {
    html += `<div class="sec-label">Pending Approval (${pending.length})</div>`;
    pending.forEach(g => {
      html += `<div class="grn-item pending">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="grn-num">${g.grn_number||'GRN-'+g.id}</div>
            <div class="grn-vendor">${g.vendor_name||'—'}</div>
            <div class="grn-detail">${g.material_name||''} · ${g.quantity_received||0} ${g.unit||''}</div>
          </div>
          <div class="grn-amount">${Money.formatRupee(g.total_value||0)}</div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn-approve" onclick="APP.approveGRN(${g.id})">Approve</button>
          <button class="btn-reject" onclick="APP.rejectGRN(${g.id})">Reject</button>
        </div>
      </div>`;
    });
  } else if (pending.length && !canApprove) {
    // Show the user's own pending GRNs (without approve/reject buttons)
    const myPending = pending.filter(g => g.raised_by === APP.user.id);
    if (myPending.length) {
      html += `<div class="sec-label">My Pending GRNs (${myPending.length})</div>`;
      myPending.forEach(g => {
        html += `<div class="grn-item pending">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div class="grn-num">${g.grn_number||'GRN-'+g.id}</div>
              <div class="grn-vendor">${g.vendor_name||'—'}</div>
              <div class="grn-detail">${g.description||''} · ${g.quantity_received||0} ${g.unit||''}</div>
            </div>
            <span class="badge b-yellow" style="white-space:nowrap">Pending</span>
          </div>
        </div>`;
      });
    }
  }

  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Recent GRNs</div>
    ${canRaise ? `<button class="btn-primary sec-hdr-btn" onclick="APP.showGRNForm()">+ Raise GRN</button>` : ''}
  </div>
  ${canRaise ? `<button class="btn-primary sec-action-mobile" onclick="APP.showGRNForm()">+ Raise GRN</button>` : ''}`;
  html += APP._sortToggleHTML('grn', ['default','age']);
  let recentGrns = grns.filter(g => g.status !== 'pending');
  recentGrns = APP._applySort(recentGrns, APP._getSortMode('grn'), { ageField:'delivery_date' });
  recentGrns.slice(0,10).forEach(g => {
    const st = g.status === 'approved' ? 'approved' : 'rejected';
    const badge = g.status === 'approved' ? 'b-green' : 'b-red';
    html += `<div class="grn-item ${st}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="grn-num">${g.grn_number||'GRN-'+g.id}</div>
          <div class="grn-vendor">${g.vendor_name||'—'}</div>
          <div class="grn-detail">${g.material_name||''} · ${UI.fmtDate(g.delivery_date||g.created_at)}</div>
        </div>
        <div>
          <div class="grn-amount">${Money.formatRupee(g.total_value||0)}</div>
          <span class="badge ${badge}" style="float:right;margin-top:4px">${g.status}</span>
        </div>
      </div>
      ${(g.delivery_note_url || g.invoice_url) ? `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${g.delivery_note_url ? `<a href="${g.delivery_note_url}" target="_blank" class="btn-sm" style="font-size:11px">📄 Delivery Note</a>` : ''}${g.invoice_url ? `<a href="${g.invoice_url}" target="_blank" class="btn-sm" style="font-size:11px">🧾 Invoice</a>` : ''}</div>` : ''}
      ${canFlagGRN && g.status === 'approved' && !g.nonconformance_flagged ? `<button class="btn-sm" style="width:100%;margin-top:8px;color:var(--red)" onclick="APP.showFlagGRNNonconformance(${g.id})">⚠ Flag Non-Conformance</button>` : ''}
      ${g.nonconformance_flagged ? '<div class="card-meta" style="margin-top:6px;color:var(--red)">⚠ Non-conformance flagged</div>' : ''}
    </div>`;
  });

  if (!grns.length) html += UI.empty('','No GRNs yet');
  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.approveGRN = async function(id) {
  const res = await API.patch(`/grn/${id}/approve`, {});
  if (res?.success) { UI.toast('GRN approved ✓'); APP.renderGRN(); }
};
APP.rejectGRN = async function(id) {
  const res = await API.patch(`/grn/${id}/reject`, {});
  if (res?.success) { UI.toast('GRN rejected'); APP.renderGRN(); }
};

APP.showFlagGRNNonconformance = async function(grnId) {
  const preview = await API.get(`/grn/${grnId}/flag-nonconformance/preview`);
  const info = preview?.grn ? `<div class="card-meta" style="margin-bottom:8px">${preview.grn.grn_number} · ${preview.grn.material_name||''} · ${preview.grn.vendor_name||''}</div>` : '';
  UI.showModal('Flag Non-Conformance', `
    ${info}
    <div class="field"><label>Description of Non-Conformance</label><textarea id="gnc-desc" rows="3" placeholder="Describe the quality/quantity issue…"></textarea></div>
    <button class="btn-primary" style="width:100%;margin-top:8px;background:var(--red)" onclick="APP.flagGRNNonconformance(${grnId})">Flag Non-Conformance</button>
  `);
};

APP.flagGRNNonconformance = async function(grnId) {
  const description = document.getElementById('gnc-desc')?.value?.trim();
  if (!description) { UI.toast('Description required'); return; }
  const res = await API.patch(`/grn/${grnId}/flag-nonconformance`, { description });
  if (res?.success) { UI.closeModal(); UI.toast('GRN flagged ✓'); APP.renderGRN(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showGRNForm = async function() {
  const pid = APP.state.selectedProject || APP.user?.projects?.[0]?.id;
  if (!pid) { UI.toast('No project selected'); return; }

  const data = await API.call('GET', `/vendors/${pid}/engagements`);
  const engagements = data?.engagements || [];
  const options = engagements.map(e => `<option value="${e.id}">${UI.escapeText(e.vendor_name)} (${UI.escapeText(e.trade || 'Other')})</option>`).join('');

  UI.openModal('Raise GRN', `
    <div class="field-row"><label class="field-label" for="grn-vendor">Vendor</label>
      <select id="grn-vendor" style="width:100%;height:38px;padding:6px;border-radius:var(--r);border:1px solid var(--border)">
        <option value="">-- Select Vendor --</option>
        ${options}
      </select>
    </div>
    <div class="field-row"><label class="field-label" for="grn-material">Material</label>
      <input type="text" id="grn-material" placeholder="Material description"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field-row"><label class="field-label" for="grn-qty">Quantity</label>
        <input type="number" id="grn-qty" placeholder="0"></div>
      <div class="field-row"><label class="field-label" for="grn-unit">Unit</label>
        <input type="text" id="grn-unit" placeholder="bags / sqm / nos"></div>
    </div>
    <div class="field-row"><label class="field-label" for="grn-rate">Unit Rate (₹)</label>
      <input type="number" id="grn-rate" placeholder="0"></div>
    <div class="field-row"><label class="field-label" for="grn-date">Delivery Date</label>
      <input type="date" id="grn-date" value="${UI.todayIST()}"></div>
    <div class="field-row"><label class="field-label">Delivery Note <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <input type="file" id="grn-delivery-note" accept="image/*,.pdf" style="font-size:13px"></div>
    <div class="field-row"><label class="field-label">Invoice <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <input type="file" id="grn-invoice" accept="image/*,.pdf" style="font-size:13px"></div>
    <button class="btn-primary" onclick="APP.submitGRN()">Submit GRN</button>
  `);
};
APP.submitGRN = async function() {
  const pid = APP.state.selectedProject || APP.user?.projects?.[0]?.id;
  const qty = parseFloat(document.getElementById('grn-qty').value||0);
  const rate= parseFloat(document.getElementById('grn-rate').value||0);
  const engagementIdVal = document.getElementById('grn-vendor').value;
  if (!engagementIdVal || !document.getElementById('grn-material').value || !qty) {
    UI.toast('Fill in vendor, material and quantity'); return;
  }
  const fd = new FormData();
  fd.append('engagement_id', engagementIdVal);
  fd.append('description',   document.getElementById('grn-material').value);
  fd.append('quantity_received', qty);
  fd.append('unit',          document.getElementById('grn-unit').value);
  fd.append('unit_rate',     rate);
  fd.append('delivery_date', document.getElementById('grn-date').value);
  const dn = document.getElementById('grn-delivery-note')?.files?.[0];
  const inv = document.getElementById('grn-invoice')?.files?.[0];
  if (dn)  fd.append('delivery_note', dn);
  if (inv) fd.append('invoice', inv);
  const res = await API.call('POST', `/grn/${pid}`, fd, true);
  if (res?.success) { APP.closeModal(); UI.toast('GRN raised ✓'); APP.renderGRN(); }
  else { UI.toast(res?.error || 'Failed to submit GRN'); }
};

// ── ISSUES — register
APP.renderIssues = async function() {
  const el = UI.contentEl();

  // Always load all issues across assigned projects
  const data = await API.get('/issues/all');
  if (!data) return;
  let issues = data.issues || [];
  const availableProjects = (data.projects || []).filter(p => p.status !== 'initialising');
  APP.state.issueProjects = availableProjects; // cache for showIssueForm

  const role = APP.user.role;
  const canRaise   = ['site_manager','senior_site_manager','pmc_head','design_head','services_head'].includes(role);
  const canConfirm = ['pmc_head','design_head','services_head','principal','design_principal'].includes(role);

  // Project filter dropdown
  const selectedProjectFilter = APP.state.selectedProjectFilter || null;
  let html = '';
  if (availableProjects.length > 1) {
    html += `<div style="margin-bottom:12px">
      <select onchange="APP.state.selectedProjectFilter=this.value==='all'?null:parseInt(this.value);APP.renderIssues()" style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;font-size:12px;width:100%">
        <option value="all" ${!selectedProjectFilter?'selected':''}>All Projects</option>
        ${availableProjects.map(p => `<option value="${p.id}" ${selectedProjectFilter===p.id?'selected':''}>${UI.escapeText(p.name)}</option>`).join('')}
      </select>
    </div>`;
  }
  if (selectedProjectFilter) {
    issues = issues.filter(i => i.project_id === selectedProjectFilter);
  }

  // Always show draft issues the current user raised (visibility after submission)
  const myDraft = i => i.status === 'draft' && i.raised_by === APP.user.id;

  const needsConfirm = issues.filter(i => i.status === 'draft' && canConfirm);
  if (needsConfirm.length) {
    html += `<div class="sec-label">Needs Confirmation (${needsConfirm.length})</div>`;
    needsConfirm.forEach(i => {
      html += `<div class="issue-item ${i.issue_type}">
        <button onclick="APP.openIssueDetail(${i.id})" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;width:100%;background:none;border:none;padding:0;text-align:left;cursor:pointer">
          <div style="flex:1;min-width:0">
            <div class="iss-num">${i.issue_number||'ISS-'+i.id} · <span style="text-transform:uppercase;font-size:10px">${i.issue_type}</span></div>
            <div class="iss-title">${i.title}</div>
            <div class="iss-meta">Raised: ${i.raised_by_name||'—'} · ${UI.fmtDate(i.created_at)}${i.project_name ? ` · ${i.project_name}` : ''}</div>
            ${i.file_path ? `<div style="font-size:11px;color:var(--navy);margin-top:4px">📎 Photo attached — tap to view</div>` : ''}
          </div>
          <span class="badge b-amber">Draft</span>
        </button>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn-approve" onclick="APP.confirmIssue(${i.id})">Confirm</button>
          <button class="btn-reject" onclick="APP.dismissIssue(${i.id})">Dismiss</button>
        </div>
      </div>`;
    });
  }

  const typeFilters = ['all','needs_you','quality','design','rfi','safety','compliance'];
  const cur = APP.state.issueFilter || 'all';
  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Issues Register</div>
    ${canRaise ? `<button class="btn-primary sec-hdr-btn" onclick="APP.showIssueForm()">+ Raise Issue</button>` : ''}
  </div>
  ${canRaise ? `<button class="btn-primary sec-action-mobile" onclick="APP.showIssueForm()">+ Raise Issue</button>` : ''}
  ${APP._sortToggleHTML('issues', ['default','urgency','age'])}
  <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:12px">
    ${typeFilters.map(f => `<button style="min-height:44px;flex-shrink:0;padding:5px 12px;border-radius:4px;font-size:11px;cursor:pointer;font-family:var(--mono);text-transform:uppercase;border:1px solid ${f===cur?'var(--navy)':'var(--border)'};background:${f===cur?'var(--navy)':'var(--white)'};color:${f===cur?'var(--white)':'var(--muted)'}" onclick="APP.state.issueFilter='${f}';APP.renderIssues()">${f.replace('_', ' ')}</button>`).join('')}
  </div>`;

  let filtered;
  if (cur === 'needs_you') {
    filtered = issues.filter(i =>
      (i.assigned_to === APP.user.id || i.assigned_to_site === APP.user.id) ||
      (i.status === 'draft' && (canConfirm || myDraft(i)))
    );
  } else if (cur === 'all') {
    filtered = issues.filter(i => i.status !== 'draft' || myDraft(i));
  } else {
    filtered = issues.filter(i => i.issue_type === cur && (i.status !== 'draft' || myDraft(i)));
  }

  filtered = APP._applySort(filtered, APP._getSortMode('issues'), { urgencyField:'issue_type', ageField:'raised_at' });

  if (!filtered.length) {
    html += UI.empty('','No issues in this category');
  } else {
    if (!APP.state.selectedProjectFilter) {
      const issuesByProject = {};
      filtered.forEach(i => {
        const projectName = i.project_name || 'Unknown Project';
        if (!issuesByProject[projectName]) issuesByProject[projectName] = [];
        issuesByProject[projectName].push(i);
      });
      const sortedProjects = Object.keys(issuesByProject).sort((a,b) => issuesByProject[b].length - issuesByProject[a].length);
      sortedProjects.slice(0,10).forEach(projectName => {
        const projectIssues = issuesByProject[projectName];
        html += `<div class="sec-label" style="margin-top:20px;margin-bottom:8px">${projectName} (${projectIssues.length})</div>`;
        projectIssues.slice(0,5).forEach(i => {
          const badge = i.status === 'draft' ? 'b-muted' : i.status === 'open' ? 'b-red' : i.status === 'in_progress' ? 'b-amber' : 'b-green';
          html += `<button class="issue-item ${i.issue_type}" style="min-height:44px;cursor:pointer;width:100%;text-align:left;display:block" onclick="APP.openIssueDetail(${i.id})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;width:100%">
              <div style="flex:1;min-width:0">
                <div class="iss-num">${i.issue_number||'ISS-'+i.id} · <span style="text-transform:uppercase;font-size:10px">${i.issue_type}</span></div>
                <div class="iss-title">${i.title}</div>
                <div class="iss-meta">${i.assigned_to_name||'Unassigned'} · ${UI.fmtDate(i.due_date||i.created_at)}</div>
              </div>
              <span class="badge ${badge}">${i.status}</span>
            </div>
          </button>`;
        });
        if (projectIssues.length > 5) {
          html += `<div style="padding:8px;color:var(--muted);font-size:12px;text-align:center">
            <button style="background:none;border:none;color:var(--navy);cursor:pointer;font-size:12px"
                    onclick="APP.state.selectedProjectFilter=${projectIssues[0].project_id};APP.renderIssues()">
              View all ${projectIssues.length} issues →
            </button>
          </div>`;
        }
      });
    } else {
      filtered.slice(0,50).forEach(i => {
        const badge = i.status === 'draft' ? 'b-muted' : i.status === 'open' ? 'b-red' : i.status === 'in_progress' ? 'b-amber' : 'b-green';
        html += `<button class="issue-item ${i.issue_type}" style="min-height:44px;cursor:pointer;width:100%;text-align:left;display:block" onclick="APP.openIssueDetail(${i.id})">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;width:100%">
            <div style="flex:1;min-width:0">
              <div class="iss-num">${i.issue_number||'ISS-'+i.id} · <span style="text-transform:uppercase;font-size:10px">${i.issue_type}</span></div>
              <div class="iss-title">${i.title}</div>
              <div class="iss-meta">${i.assigned_to_name||'Unassigned'} · ${UI.fmtDate(i.due_date||i.created_at)}${i.project_name ? ` · ${i.project_name}` : ''}</div>
            </div>
            <span class="badge ${badge}">${i.status}</span>
          </div>
        </button>`;
      });
    }
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── ISSUE DETAIL MODAL (Bug #16 fix) ────────────────────────────────────────
// Opens on click of any issue in the list. Shows full context and role-aware
// action buttons. Actions available:
//   Resolve  — assignee OR any stream head / principal / PMC / site mgr
//   Close    — PMC Head / Principal / DP (after resolved)
//   Reopen   — PMC Head / Principal / DP (if closed too soon)
//   Confirm  — PMC Head (for draft issues)
//   Dismiss  — PMC Head (for draft issues only)
// Backend endpoints used:
//   GET    /api/issues/:project_id  → fetch; filtered client-side for the one ID
//   PATCH  /api/issues/:id/resolve
//   PATCH  /api/issues/:id/confirm  / /dismiss
//   PATCH  /api/issues/:id/close    (new — added below)
APP.openIssueDetail = async function(issueId) {
  const [data, photosRes] = await Promise.all([
    API.get('/issues/all'),
    API.get(`/issues/${issueId}/photos`).catch(() => null),
  ]);
  if (!data) return;
  const issue = (data.issues || []).find(x => x.id === issueId);
  if (!issue) { UI.toast('Issue not found'); return; }
  // Merge /photos endpoint results with file_path stored directly on the issue row
  let photos = photosRes?.photos || [];
  if (!photos.length && issue?.file_path) {
    photos = [{ file_path: issue.file_path, caption: '', submitted_by_name: issue.raised_by_name }];
  }

  const me = APP.user || {};
  const role = me.role;
  const isAssignee = issue.assigned_to === me.id;
  const isStreamHead  = ['design_head','services_head'].includes(role);
  const isPMCorUp     = ['principal','design_principal','pmc_head'].includes(role);
  const isSiteOrUp    = ['senior_site_manager'].includes(role); // site_manager cannot resolve

  // Determine action availability per current status + role
  const canResolve = (issue.status === 'open' || issue.status === 'in_progress') &&
                     (isAssignee || isPMCorUp || isStreamHead || isSiteOrUp);
  const canClose   = issue.status === 'resolved' && isPMCorUp;
  const canReopen  = issue.status === 'closed'   && isPMCorUp;
  const canConfirm = issue.status === 'draft'    && isPMCorUp;
  const canDismiss = issue.status === 'draft'    && isPMCorUp;

  const statusColor = {
    'draft':'var(--muted)','open':'var(--red)','in_progress':'var(--amber)',
    'resolved':'var(--green)','closed':'var(--muted2)','dismissed':'var(--muted2)'
  }[issue.status] || 'var(--muted)';

  const bodyHtml = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div>
        <div style="font-family:var(--mono);font-size:12px;color:var(--muted)">${issue.issue_number||'ISS-'+issue.id}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;margin-top:2px">${issue.issue_type}</div>
        ${issue.project_name ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${issue.project_name}</div>` : ''}
      </div>
      <span class="badge" style="background:${statusColor};color:#fff">${issue.status}</span>
    </div>

    <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:10px">${issue.title}</div>

    ${issue.description ? `<div style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:14px;white-space:pre-wrap">${issue.description}</div>` : ''}

    <div style="background:var(--bg);padding:10px;border-radius:var(--r2);margin-bottom:14px;font-size:12px">
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--muted)">Assigned to</span><span>${issue.assigned_to_name||'Unassigned'}</span></div>
      ${issue.raised_by_name ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--muted)">Raised by</span><span>${issue.raised_by_name}</span></div>` : ''}
      ${issue.due_date ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--muted)">Due</span><span>${UI.fmtDate(issue.due_date)}</span></div>` : ''}
      ${issue.location ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--muted)">Location</span><span>${issue.location}</span></div>` : ''}
      ${issue.resolved_by_name ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--muted)">Resolved by</span><span>${issue.resolved_by_name} · ${UI.fmtDate(issue.resolved_at)}</span></div>` : ''}
    </div>

    ${issue.resolution_note ? `<div style="font-size:12px;background:#eefaf2;padding:10px;border-left:3px solid var(--green);border-radius:var(--r2);margin-bottom:14px;white-space:pre-wrap">${issue.resolution_note}</div>` : ''}

    ${photos.length ? `<div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Photos (${photos.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${photos.map(p => {
          const url = API.fileUrl(p.file_path, 'issues');
          const name = (p.file_path || '').split('/').pop() || 'photo';
          return `<div style="position:relative;width:90px;height:90px;border-radius:6px;overflow:hidden;border:1px solid var(--border);flex-shrink:0">
            <img src="${url}" alt="Issue photo" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="APP._photoLightbox('${url}','${UI.escapeAttr(name)}')">
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:10px;text-align:center;padding:3px;pointer-events:none">tap to enlarge</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <div class="btn-row" style="margin-top:16px;flex-wrap:wrap;gap:6px">
      ${canResolve ? `<button class="btn-primary" onclick="APP._resolveIssue(${issue.id})">Resolve</button>` : ''}
      ${canClose   ? `<button class="btn-primary" onclick="APP._closeIssue(${issue.id})">Close</button>` : ''}
      ${canReopen  ? `<button class="btn-secondary" onclick="APP._reopenIssue(${issue.id})">Reopen</button>` : ''}
      ${canConfirm ? `<button class="btn-primary" onclick="APP.confirmIssue(${issue.id});UI.closeModal()">Confirm</button>` : ''}
      ${canDismiss ? `<button class="btn-secondary" onclick="APP.dismissIssue(${issue.id});UI.closeModal()">Dismiss</button>` : ''}
      <button class="btn-secondary" onclick="UI.closeModal()">Close</button>
    </div>
  `;

  UI.openModal('Issue Detail', bodyHtml);
};

APP._resolveIssue = async function(issueId) {
  const note = prompt('Resolution note (what was done to resolve this issue)?');
  if (note === null) return;  // user cancelled
  if (note.trim().length < 5) { UI.toast('Resolution note must be at least 5 characters'); return; }
  const res = await API.patch(`/issues/${issueId}/resolve`, { resolution_note: note.trim() });
  if (res?.success) {
    UI.closeModal();
    UI.toast('Issue resolved ✓');
    APP.renderIssues();
  } else {
    UI.toast(res?.error || 'Resolve failed');
  }
};

APP._closeIssue = async function(issueId) {
  if (!confirm('Close this issue? Only PMC / Principal can reopen after.')) return;
  const res = await API.patch(`/issues/${issueId}/close`, {});
  if (res?.success) {
    UI.closeModal();
    UI.toast('Issue closed ✓');
    APP.renderIssues();
  } else {
    UI.toast(res?.error || 'Close failed');
  }
};

APP._reopenIssue = async function(issueId) {
  const reason = prompt('Why is this issue being reopened?');
  if (reason === null) return;
  if (reason.trim().length < 5) { UI.toast('Reason required (min 5 chars)'); return; }
  const res = await API.patch(`/issues/${issueId}/reopen`, { reason: reason.trim() });
  if (res?.success) {
    UI.closeModal();
    UI.toast('Issue reopened ✓');
    APP.renderIssues();
  } else {
    UI.toast(res?.error || 'Reopen failed');
  }
};

APP.confirmIssue = async function(id) {
  const res = await API.patch(`/issues/${id}/confirm`, {});
  if (res?.success) { UI.toast('Issue confirmed ✓'); APP.renderIssues(); }
};
APP.dismissIssue = async function(id) {
  const res = await API.patch(`/issues/${id}/dismiss`, {});
  if (res?.success) { UI.toast('Dismissed'); APP.renderIssues(); }
};
APP.showIssueForm = function() {
  const projects = APP.state.issueProjects || [];
  const hasFilter = !!APP.state.selectedProjectFilter;
  const today = UI.todayIST();

  let projectRow;
  if (!hasFilter && projects.length > 1) {
    const opts = projects.map(p => `<option value="${p.id}">${UI.escapeText(p.name)}</option>`).join('');
    projectRow = `<div class="field-row"><label class="field-label" for="iss-project">Project *</label>
      <select id="iss-project" style="width:100%;height:38px;padding:6px;border-radius:var(--r);border:1px solid var(--border)">
        ${opts}
      </select></div>`;
  } else {
    const pid = APP.state.selectedProjectFilter || APP.state.selectedProject || projects[0]?.id || '';
    projectRow = `<input type="hidden" id="iss-project" value="${pid}">`;
  }

  UI.openModal('Raise Issue', `
    ${projectRow}
    <div class="field-row"><label class="field-label" for="iss-type">Type</label>
      <select id="iss-type">
        <option value="safety">Safety</option>
        <option value="quality">Quality</option>
        <option value="design">Design</option>
        <option value="rfi">RFI</option>
        <option value="compliance">Compliance</option>
      </select></div>
    <div class="field-row"><label class="field-label" for="iss-title">Title</label>
      <input type="text" id="iss-title" placeholder="Brief description"></div>
    <div class="field-row"><label class="field-label" for="iss-desc">Details</label>
      <textarea id="iss-desc" rows="3" placeholder="Describe the issue..."></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field-row"><label class="field-label" for="iss-date">Incident Date</label>
        <input type="date" id="iss-date" value="${today}"></div>
      <div class="field-row"><label class="field-label" for="iss-due">Due Date</label>
        <input type="date" id="iss-due"></div>
    </div>
    <div class="field-row">
      <label class="field-label">Photo <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <label for="iss-photo" id="iss-photo-label" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--border);border-radius:8px;padding:18px 12px;cursor:pointer;background:var(--card,#fafafa)">
        <span style="font-size:28px">📷</span>
        <span style="font-size:12px;color:var(--muted)">Tap to add photo</span>
      </label>
      <input type="file" id="iss-photo" accept="image/*" capture="environment" style="display:none" onchange="APP._issuePhotoPreview(this)">
      <div id="iss-photo-preview" style="display:none;margin-top:8px;position:relative;width:100px;height:100px">
        <img id="iss-photo-img" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
        <button type="button" onclick="APP._issuePhotoClear()" style="position:absolute;top:-6px;right:-6px;background:var(--red,#c0392b);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0">x</button>
      </div>
    </div>
    <button class="btn-primary" style="width:100%;margin-top:4px" onclick="APP.submitIssue()">Raise Issue</button>
  `);
};
APP._issuePhotoPreview = function(input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById('iss-photo-img').src = url;
  document.getElementById('iss-photo-preview').style.display = 'block';
  document.getElementById('iss-photo-label').style.display = 'none';
};
APP._issuePhotoClear = function() {
  document.getElementById('iss-photo').value = '';
  document.getElementById('iss-photo-preview').style.display = 'none';
  document.getElementById('iss-photo-label').style.display = '';
};
APP._photoLightbox = function(url, filename) {
  const overlay = document.createElement('div');
  overlay.id = 'photo-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:16px';
  overlay.innerHTML = `
    <img src="${url}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:4px">
    <div style="display:flex;gap:12px">
      <a href="${url}" download="${filename}" style="padding:10px 24px;background:var(--navy,#1D3D62);color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">↓ Download</a>
      <button onclick="document.getElementById('photo-lightbox').remove()" style="padding:10px 24px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">Close</button>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};
APP.submitIssue = async function() {
  const pidEl = document.getElementById('iss-project');
  const pid = pidEl ? parseInt(pidEl.value, 10) : null;
  if (!pid) { UI.toast('Select a project'); return; }
  const title = document.getElementById('iss-title')?.value?.trim();
  if (!title) { UI.toast('Add a title'); return; }
  const photo = document.getElementById('iss-photo')?.files?.[0];
  const fd = new FormData();
  fd.append('issue_type', document.getElementById('iss-type').value);
  fd.append('title',      title);
  fd.append('description', document.getElementById('iss-desc')?.value?.trim() || '');
  const due = document.getElementById('iss-due')?.value;
  if (due) fd.append('due_date', due);
  const incidentDate = document.getElementById('iss-date')?.value;
  if (incidentDate) fd.append('incident_date', incidentDate);
  if (photo) fd.append('photo', photo);
  const res = await API.call('POST', `/issues/${pid}`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Issue raised ✓'); APP.renderIssues(); }
  else { UI.toast(res?.error || 'Failed to raise issue'); }
};
// renderMeetings is the unified entry point (Fold B).
// Delegates to renderMOMs for now — full meeting-type filtering can come later.
APP.renderMeetings = function() { return APP.renderMOMs(); };

APP.renderMOMs = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/meetings/${pid}`);
  if (!data) return;
  const moms = data.meetings || data.moms || [];

  const role = APP.user.role;
  const canCreate = ['pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderMOMs()');

  // Pending action items across all MOMs
  const allActions = moms.flatMap(m => (m.action_items||[]).filter(a => !a.completed && a.due_date));
  const overdue = allActions.filter(a => new Date(a.due_date) < new Date());
  if (overdue.length) {
    html += `<div class="sec-label">Overdue Action Items (${overdue.length})</div>`;
    overdue.forEach(a => {
      html += `<div class="action-item c-red">
        <div class="ai-icon">⏰</div>
        <div class="ai-body">
          <div class="ai-title">${a.action}</div>
          <div class="ai-meta">${a.assigned_to_name||'—'} · Due ${UI.fmtDate(a.due_date)}</div>
        </div>
        <span class="badge b-red">OVERDUE</span>
      </div>`;
    });
  }

  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">MOMs (${moms.length})</div>
    ${canCreate ? `<button class="btn-primary sec-hdr-btn" onclick="APP.showMOMForm()">+ New MOM</button>` : ''}
  </div>
  ${canCreate ? `<button class="btn-primary sec-action-mobile" onclick="APP.showMOMForm()">+ New MOM</button>` : ''}`;
  if (!moms.length) { html += UI.empty('','No MOMs yet'); }
  else {
    APP._momCache = {};
    moms.forEach(m => { APP._momCache[m.id] = m; });
    moms.forEach(m => {
    const accentColor = m.status === 'approved' ? 'var(--green,#4A8A5A)' : m.status === 'issued' ? 'var(--navy,#1D3D62)' : 'var(--amber,#C8A040)';
    const statusLabel = m.status || 'draft';
    const pending = (m.action_items||[]).filter(a => !a.completed).length;
    const overdue  = (m.action_items||[]).filter(a => !a.completed && a.due_date && new Date(a.due_date) < new Date()).length;
    html += `<button onclick="APP.viewMOM(${m.id})" style="display:block;width:100%;text-align:left;background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-left:4px solid ${accentColor};border-radius:var(--r2,8px);padding:14px 16px;margin-bottom:8px;cursor:pointer;box-shadow:var(--shadow,0 1px 3px rgba(0,0,0,.06));transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.12)'" onmouseout="this.style.boxShadow='var(--shadow,0 1px 3px rgba(0,0,0,.06))'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.04em;margin-bottom:3px">${m.mom_number||'MOM-'+m.id}</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(m.title||m.project_name||'—')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span style="font-size:11px;color:var(--muted)">${UI.fmtDate(m.meeting_date)}</span>
            <span style="font-size:11px;color:var(--muted)">· ${UI.escapeText(m.created_by_name||'—')}</span>
            ${pending ? `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${overdue?'var(--red,#c0392b)':'var(--amber,#C8A040)'};color:#fff;white-space:nowrap">${overdue?overdue+' overdue':pending+' open'}</span>` : ''}
          </div>
        </div>
        <span style="font-size:10px;padding:3px 10px;border-radius:10px;background:${accentColor};color:#fff;white-space:nowrap;flex-shrink:0;margin-top:2px">${statusLabel.toUpperCase()}</span>
      </div>
    </button>`;
  }); }  // close forEach + else

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.viewMOM = async function(id) {
  const mom = APP._momCache?.[id];
  const role = APP.user?.role;
  const uid = APP.user?.id;
  const isPMC = role === 'pmc_head';
  const isPrincipal = role === 'principal' || role === 'design_principal';
  // roles allowed to upload photos (mirrors server requireRole in meetings.js)
  const canUploadPhoto = ['pmc_head','principal','design_principal','design_head','services_head',
    'site_manager','senior_site_manager'].includes(role);

  const [actionsData, docsData] = await Promise.all([
    API.get(`/meetings/${id}/action-items`),
    API.get(`/meetings/${id}/documents`).catch(() => null),
  ]);
  if (!actionsData) return;
  const actions = actionsData.action_items || [];
  const docs = docsData?.documents || [];
  const photos = docs.filter(d => d.doc_type === 'photo' || d.doc_type === 'attachment');

  const statusLabel = mom?.status || 'draft';
  const statusBadge = statusLabel === 'approved' ? 'b-green' : statusLabel === 'issued' ? 'b-navy' : 'b-amber';
  const momActions = (isPMC || isPrincipal) ? `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${isPMC && statusLabel === 'draft' ? `<button class="btn-sm navy" onclick="APP.approveMOM(${id})">Approve MOM</button>` : ''}
      ${isPMC && statusLabel === 'approved' ? `<button class="btn-sm navy" onclick="APP.issueToClient(${id}, '${mom?.meeting_number||''}')">Issue to Client</button>` : ''}
      ${isPMC && statusLabel === 'issued' ? `<button class="btn-sm" onclick="APP.reissueMOM(${id})">Reissue</button>` : ''}
      ${isPMC && statusLabel === 'approved' ? `<button class="btn-sm" disabled title="Issue the MOM to the client first — you can only reissue an issued MOM" style="opacity:0.5;cursor:not-allowed">Reissue (issue first)</button>` : ''}
      ${isPMC ? `<button class="btn-sm" onclick="APP.showAddObservation(${id})">+ Observation</button>` : ''}
      ${isPrincipal && (statusLabel === 'issued' || statusLabel === 'approved') ? `<button class="btn-sm" onclick="APP.unlockMOM(${id})">Unlock</button>` : ''}
    </div>` : '';

  // Attendees display
  const attendeesInternal = mom?.attendees_internal || mom?.attendees || '';
  const attendeesExternal = mom?.attendees_external || '';
  const attendeesHtml = (attendeesInternal || attendeesExternal) ? `
    <div style="margin-bottom:14px;padding:10px 12px;background:var(--surface,#f8f9fa);border-radius:6px;font-size:13px">
      ${attendeesInternal ? `<div><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Internal · </span>${UI.escapeText(attendeesInternal)}</div>` : ''}
      ${attendeesExternal ? `<div style="margin-top:4px"><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">External · </span>${UI.escapeText(attendeesExternal)}</div>` : ''}
    </div>` : '';

  // Photos section
  const photosHtml = `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono)">Site Photos &amp; Observations (${photos.length})</span>
        ${canUploadPhoto ? `<button class="btn-sm" onclick="APP._uploadMOMPhoto(${id})">+ Photo</button>` : ''}
      </div>
      ${photos.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${photos.map(p => {
          const url = API.fileUrl(p.file_path, 'documents');
          const fname = p.file_path.split(/[/\\]/).pop();
          return `<div style="position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;border:1px solid var(--border);cursor:pointer" onclick="APP._photoLightbox('${url}','${fname}')">
            <img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'">
            ${p.caption ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:9px;padding:2px 4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${UI.escapeText(p.caption)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>` : `<div style="font-size:12px;color:var(--muted);font-style:italic">No photos attached yet</div>`}
    </div>`;

  UI.openModal(mom ? `${mom.meeting_number||'MOM'} — ${mom.title||''}` : 'MOM Details', `
    ${mom ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span class="badge ${statusBadge}">${statusLabel}</span>
      <span style="font-size:12px;color:var(--muted)">${UI.fmtDate(mom.meeting_date)}</span>
    </div>` : ''}
    ${momActions}
    ${attendeesHtml}
    ${photosHtml}
    <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:.08em">${actions.length} action item${actions.length !== 1 ? 's' : ''}</div>
    ${actions.map(a => {
      const isDone = a.status === 'completed';
      const isOverdue = !isDone && a.due_date && new Date(a.due_date) < new Date();
      const text = a.action || a.action_text || '—';
      return `
    <div class="action-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)${isDone?';opacity:0.6':''}">
      <div class="ar-who" style="font-weight:600;font-size:12px;min-width:60px">${(a.assigned_to_name || a.assignee_name ||'—').split(' ')[0]}</div>
      <div class="ar-text" style="flex:1;font-size:13px${isDone?';text-decoration:line-through':''}">${UI.escapeText(text)}</div>
      <div class="ar-due ${isOverdue?'overdue':''}" style="font-size:11px;font-family:var(--mono);margin-right:8px">${UI.fmtDate(a.due_date)}</div>
      ${isDone ? `<span style="font-size:12px;color:var(--green);font-weight:600">Done</span>` :
        a.assigned_to === uid && a.status === 'pending' ? `<button class="btn-sm" onclick="APP.acknowledgeAction(${a.id}, ${id})">Ack</button>` :
        a.countersign_by === uid && a.status === 'acknowledged' ? `<div style="display:flex;gap:4px"><button class="btn-sm approve" onclick="APP.countersignAction(${a.id}, ${id}, true)">✓</button><button class="btn-sm reject" onclick="APP.countersignAction(${a.id}, ${id}, false)">✗</button></div>` :
        `<button class="btn-sm approve" onclick="APP.doneAction(${a.id}, ${id})">Done</button>`}
    </div>`;
    }).join('')}
    ${!actions.length ? UI.empty('','No action items') : ''}
  `);
};

APP._uploadMOMPhoto = function(momId) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async function() {
    const file = inp.files[0];
    if (!file) return;
    const caption = (await UI.prompt('Caption (optional):', '')) ?? '';
    if (caption === null) return; // user cancelled the dialog
    UI.toast('Uploading…');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', 'photo');
    if (caption.trim()) fd.append('caption', caption.trim());
    const json = await API.call('POST', `/meetings/${momId}/upload`, fd, true);
    if (json?.success) {
      UI.toast('Photo attached ✓');
      await APP.viewMOM(momId);
    } else {
      UI.toast(json?.error || 'Upload failed');
    }
  };
  inp.click();
};

APP.showAddObservation = function(momId) {
  UI.openModal('Add Observation', `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
      Record a site observation for this meeting. Attach a photo or document as evidence.
    </div>
    <div class="field-row">
      <label class="field-label">Observation *</label>
      <textarea id="obs-text" rows="3" placeholder="Describe the site observation, deficiency, or note..."></textarea>
    </div>
    <div class="field-row">
      <label class="field-label">Photo / Attachment <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
      <input type="file" id="obs-file" accept="image/*,.pdf">
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn-primary" onclick="APP._submitObservation(${momId})">Submit</button>
      <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
    </div>
  `);
};

APP._submitObservation = async function(momId) {
  const observation = document.getElementById('obs-text')?.value?.trim();
  if (!observation) { UI.toast('Observation text required'); return; }
  const file = document.getElementById('obs-file')?.files?.[0];
  const fd = new FormData();
  fd.append('observation', observation);
  if (file) fd.append('photo', file);
  const res = await API.call('POST', `/meetings/${momId}/observation`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Observation added ✓'); APP.viewMOM(momId); }
  else UI.toast(res?.error || 'Failed');
};

APP.doneAction = async function(id, momId) {
  const res = await API.patch(`/meetings/action-items/${id}/complete`, {});
  if (res?.success) {
    UI.toast('Marked done ✓');
    if (momId) await APP.viewMOM(momId);
  } else {
    UI.toast(res?.error || 'Failed to mark done');
  }
};

APP.acknowledgeAction = async function(id, momId) {
  const res = await API.patch(`/meetings/action-items/${id}/acknowledge`, {});
  if (res?.success) { UI.toast('Action acknowledged ✓'); if (momId) await APP.viewMOM(momId); }
  else UI.toast(res?.error || 'Failed to acknowledge');
};

APP.countersignAction = async function(id, momId, agree) {
  let reason = '';
  if (!agree) {
    reason = await UI.prompt('Reason for disagreement:', '');
    if (reason === null) return;
  }
  const res = await API.patch(`/meetings/action-items/${id}/countersign`, { agree, reason: reason || undefined });
  if (res?.success) {
    UI.toast(agree ? 'Countersigned ✓' : 'Disagreement recorded — MOM may need reissue');
    if (momId) await APP.viewMOM(momId);
  } else UI.toast(res?.error || 'Failed to countersign');
};

APP.unlockMOM = async function(id) {
  const reason = await UI.prompt('Reason for unlocking this MOM (required):', '');
  if (!reason || !reason.trim()) { UI.toast('Reason required to unlock'); return; }
  const res = await API.post(`/meetings/${id}/unlock`, { reason: reason.trim() });
  if (res?.success) { UI.toast('MOM unlocked — 1-day edit window open'); UI.closeModal(); APP.renderMOMs(); }
  else UI.toast(res?.error || 'Failed to unlock MOM');
};
APP.showMOMForm = function() {
  UI.openModal('New MOM', `
    <div class="field-row"><label class="field-label" for="mom-title">Title / Purpose</label>
      <input type="text" id="mom-title" placeholder="e.g. Site coordination meeting"></div>
    <div class="field-row"><label class="field-label" for="mom-date">Meeting Date</label>
      <input type="date" id="mom-date" value="${UI.todayIST()}"></div>
    <div class="field-row"><label class="field-label" for="mom-attendees">Attendees</label>
      <input type="text" id="mom-attendees" placeholder="Names separated by commas"></div>
    <div class="field-row">
      <label class="field-label">Site Photos <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
      <input type="file" id="mom-photos" accept="image/*" multiple style="font-size:13px;padding:6px 0">
      <div id="mom-photo-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
    </div>
    <button class="btn-primary" onclick="APP.submitMOM()">Create MOM</button>
  `);
  // Live preview
  setTimeout(() => {
    const inp = document.getElementById('mom-photos');
    const preview = document.getElementById('mom-photo-preview');
    if (inp && preview) {
      inp.addEventListener('change', () => {
        preview.innerHTML = '';
        Array.from(inp.files).forEach(f => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)';
          preview.appendChild(img);
        });
      });
    }
  }, 50);
};
APP.submitMOM = async function() {
  const pid = APP.state.selectedProject;
  const body = {
    title:        document.getElementById('mom-title').value,
    meeting_date: document.getElementById('mom-date').value,
    attendees:    document.getElementById('mom-attendees').value,
  };
  if (!body.title || !body.meeting_date) { UI.toast('Fill in title and date'); return; }
  const photoFiles = Array.from(document.getElementById('mom-photos')?.files || []);
  const res = await API.post(`/meetings/${pid}`, body);
  if (!res?.success) { UI.toast(res?.error || 'Failed to create MOM'); return; }
  const momId = res.meeting_id || res.id;
  if (photoFiles.length && momId) {
    UI.toast(`Uploading ${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''}…`);
    for (const file of photoFiles) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', 'photo');
      await API.call('POST', `/meetings/${momId}/upload`, fd, true).catch(() => {});
    }
  }
  APP.closeModal();
  UI.toast('MOM created ✓');
  APP.renderMOMs();
};

APP.approveMOM = async function(id) {
  const ok = await UI.confirm('Approve this MOM internally? You can then issue it to the client.');
  if (!ok) return;
  const res = await API.post(`/meetings/${id}/approve`, {});
  if (res?.success) { UI.toast('MOM approved ✓'); UI.closeModal(); APP.renderMOMs(); }
  else UI.toast(res?.error || 'Approval failed');
};

APP.issueToClient = async function(id, meetingNumber) {
  const entered = await UI.prompt(
    `To confirm sending MOM to client, type the MOM number exactly:\n(${meetingNumber})`,
    meetingNumber
  );
  if (!entered) return;
  if (entered.trim() !== meetingNumber) { UI.toast('MOM number does not match — send cancelled'); return; }
  const res = await API.post(`/meetings/${id}/issue-to-client`, { confirmation: 'SEND', meeting_number: meetingNumber });
  if (res?.success) { UI.toast(res.message || 'MOM issued to client ✓'); UI.closeModal(); APP.renderMOMs(); }
  else UI.toast(res?.error || 'Failed to issue MOM');
};

APP.reissueMOM = function(id) {
  UI.openModal('Reissue MOM', `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
      Opens a new revision window for the client. Upload a revised PDF if applicable.
    </div>
    <div class="field-row">
      <label class="field-label">Reason for Reissue *</label>
      <input id="mri-reason" placeholder="e.g. Updated action item due dates">
    </div>
    <div class="field-row">
      <label class="field-label">Revised PDF <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
      <input type="file" id="mri-doc" accept=".pdf">
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn-primary" onclick="APP._submitReissueMOM(${id})">Reissue</button>
      <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
    </div>
  `);
};

APP._submitReissueMOM = async function(id) {
  const reason = document.getElementById('mri-reason')?.value?.trim();
  if (!reason) { UI.toast('Reason required'); return; }
  const docFile = document.getElementById('mri-doc')?.files?.[0];
  const fd = new FormData();
  fd.append('reason', reason);
  if (docFile) fd.append('doc', docFile);
  const res = await API.call('POST', `/meetings/${id}/reissue`, fd, true);
  if (res?.success) { UI.toast('MOM reissued ✓'); UI.closeModal(); APP.renderMOMs(); }
  else UI.toast(res?.error || 'Failed to reissue MOM');
};

// ── LABOUR REGISTER — site manager enters, PMC validates
APP.renderLabour = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/labour/${pid}`);
  if (!data) return;
  const entries = data.records || [];

  const role = APP.user.role;
  const canEnter    = ['site_manager','senior_site_manager'].includes(role);
  const canValidate = ['pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderLabour()');

  const unvalidated = entries.filter(e => !e.validated_by);
  if (canValidate && unvalidated.length) {
    html += `<div class="sec-label">Pending Validation (${unvalidated.length})</div>
    <div class="action-item c-amber" style="margin-bottom:12px">
      <div class="ai-icon">👷</div>
      <div class="ai-body">
        <div class="ai-title">Validate ${unvalidated.length} labour entr${unvalidated.length>1?'ies':'y'}</div>
        <div class="ai-meta">Batch validate all pending</div>
      </div>
      <button class="btn-sm approve" onclick="APP.validateAllLabour('${pid}')">Validate All</button>
    </div>`;
    unvalidated.forEach(e => {
      html += `<div class="card" style="border-left:3px solid #C8A040;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="card-title">${e.trade}</div>
            <div class="card-meta">${UI.fmtDate(e.register_date)} · ${e.vendor_name||'—'}</div>
            ${e.notes ? `<div class="card-meta">${e.notes}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--mono);font-size:20px;font-weight:600;color:var(--navy)">${e.headcount}</div>
            <div style="font-size:10px;color:var(--muted)">workers</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-sm approve" onclick="APP.validateLabourEntry('${pid}',${e.id})">✓ Validate</button>
          <button class="btn-sm" style="color:#C84040" onclick="APP.rejectLabourEntry('${pid}',${e.id})">✗ Reject</button>
        </div>
      </div>`;
    });
  }

  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Labour Register</div>
    ${canEnter ? `<button class="btn-primary sec-hdr-btn" onclick="APP.showLabourForm()">+ Log Headcount</button>` : ''}
  </div>
  ${canEnter ? `<button class="btn-primary sec-action-mobile" onclick="APP.showLabourForm()">+ Log Headcount</button>` : ''}`;
  if (!entries.length) { html += UI.empty('','No labour entries yet'); }
  else entries.slice(0,14).forEach(e => {
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-title">${e.trade}</div>
          <div class="card-meta">${UI.fmtDate(e.register_date)} · ${e.recorded_by_name||e.vendor_name||'—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--mono);font-size:20px;font-weight:600;color:var(--navy)">${e.headcount}</div>
          <div style="font-size:10px;color:var(--muted)">workers</div>
          ${e.validated_by ? '<span class="badge b-green" style="margin-top:4px">Validated</span>' : '<span class="badge b-amber" style="margin-top:4px">Pending</span>'}
        </div>
      </div>
      ${e.wages_paid ? `<div class="card-meta" style="margin-top:6px">Wages: ${Money.formatRupee(e.wages_paid)}</div>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.validateAllLabour = async function(pid) {
  const today = UI.todayIST();
  const res = await API.post(`/labour/${pid}/validate-all`, { register_date: today });
  if (res?.success) { UI.toast(`${res.validated} entr${res.validated>1?'ies':'y'} validated ✓`); APP.renderLabour(); }
  else { UI.toast(res?.error || 'Validation failed'); }
};
APP.validateLabourEntry = async function(pid, id) {
  const res = await API.call('PATCH', `/labour/${pid}/${id}/validate`, {});
  if (res?.success) { UI.toast('Validated ✓'); APP.renderLabour(); }
  else { UI.toast(res?.error || 'Validation failed'); }
};
APP.rejectLabourEntry = function(pid, id) {
  UI.openModal('Reject Labour Entry', `
    <div class="field-row">
      <label class="field-label" for="lab-reject-reason">Reason for rejection</label>
      <input type="text" id="lab-reject-reason" placeholder="e.g. Headcount mismatch, incorrect trade">
    </div>
    <button class="btn-primary" style="width:100%;background:#C84040" onclick="APP.submitRejectLabour('${pid}',${id})">Reject Entry</button>
  `);
};
APP.submitRejectLabour = async function(pid, id) {
  const reason = document.getElementById('lab-reject-reason')?.value?.trim();
  if (!reason || reason.length < 3) { UI.toast('Enter a reason (min 3 chars)'); return; }
  const res = await API.call('PATCH', `/labour/${pid}/${id}/reject`, { reason });
  if (res?.success) { UI.closeModal(); UI.toast('Entry rejected'); APP.renderLabour(); }
  else { UI.toast(res?.error || 'Rejection failed'); }
};
APP.showLabourForm = async function() {
  UI.openModal('Log Headcount', `
    <div class="field-row"><label class="field-label" for="lab-engagement">Subcontractor</label>
      <select id="lab-engagement"><option value="">Loading…</option></select></div>
    <div class="field-row"><label class="field-label" for="lab-trade">Trade</label>
      <select id="lab-trade">
        <option>Civil</option><option>Structural</option><option>Electrical</option>
        <option>HVAC</option><option>Plumbing</option><option>Facade</option>
        <option>Finishes</option><option>Landscaping</option><option>Other</option>
      </select></div>
    <div class="field-row"><label class="field-label" for="lab-count">Headcount</label>
      <input type="number" id="lab-count" placeholder="0" min="0"></div>
    <div class="field-row"><label class="field-label" for="lab-date">Date</label>
      <input type="date" id="lab-date" value="${UI.todayIST()}"></div>
    <div class="field-row"><label class="field-label" for="lab-notes">Notes (optional)</label>
      <textarea id="lab-notes" rows="2" placeholder="Any notes..."></textarea></div>
    <button class="btn-primary" onclick="APP.submitLabour()">Save</button>
  `);

  // Load engagements for this project. Each engagement = one subcontractor's
  // contract on this site. BOCW + Karnataka muster-roll requirements: every
  // labour record must be attributed to the right contractor. Without an
  // engagement, the entry would be legally non-compliant.
  const pid = APP.state.selectedProject;
  const sel = document.getElementById('lab-engagement');
  try {
    const data = await API.get(`/vendors/${pid}/engagements`);
    const engagements = (data?.engagements || []).filter(e => e.status !== 'cancelled');
    if (!engagements.length) {
      sel.innerHTML = '<option value="">— No subcontractors engaged on this project —</option>';
      sel.disabled = true;
      return;
    }
    sel.innerHTML = '<option value="">— select subcontractor —</option>' +
      engagements.map(e =>
        `<option value="${e.id}">${e.vendor_name} — ${e.scope || e.trade || ''}</option>`
      ).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">— could not load —</option>';
  }
};
APP.submitLabour = async function() {
  const pid = APP.state.selectedProject;
  const engagementVal = document.getElementById('lab-engagement').value;
  if (!engagementVal) { UI.toast('Select a subcontractor'); return; }
  const body = {
    engagement_id: parseInt(engagementVal, 10),
    trade:         document.getElementById('lab-trade').value,
    headcount:     parseInt(document.getElementById('lab-count').value||0),
    register_date: document.getElementById('lab-date').value,
    notes:         document.getElementById('lab-notes').value || null,
  };
  if (!body.headcount) { UI.toast('Enter headcount'); return; }
  const res = await API.post(`/labour/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('Headcount logged ✓'); APP.renderLabour(); }
  else UI.toast(res?.error || 'Failed');
};

// ── SITE VISITS — log observation + link MOM
APP.renderVisits = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/meetings/${pid}`);
  if (!data) return;
  const visits = data.visits || [];

  const role = APP.user.role;
  const canLog = ['pmc_head','principal','design_principal','design_head','services_head'].includes(role);

  let html = APP._projectSelectHtml('APP.renderVisits()');
  if (canLog) {
    html += `<button class="btn-primary" onclick="APP.showVisitForm()" style="margin-bottom:16px">+ Log Site Visit</button>`;
  }

  html += `<div class="sec-label">Site Visits (${visits.length})</div>`;
  if (!visits.length) { html += UI.empty('','No visits logged yet'); }
  else visits.slice(0,12).forEach(v => {
    html += `<button class="card" style="min-height:44px" onclick="APP.viewVisit(${v.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-title">${UI.fmtDate(v.visit_date)}</div>
          <div class="card-meta">${v.visited_by_name||'—'}</div>
        </div>
        <span class="badge b-navy">${v.observations_count||0} obs</span>
      </div>
      ${v.summary ? `<div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.4">${v.summary.substring(0,100)}${v.summary.length>100?'...':''}</div>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showVisitForm = function() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-title">Log Visit <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div class="field-row"><label class="field-label" for="visit-date">Visit Date</label>
      <input type="date" id="visit-date" value="${UI.todayIST()}"></div>
    <div class="field-row"><label class="field-label" for="visit-summary">Summary</label>
      <textarea id="visit-summary" rows="3" placeholder="What was observed / discussed..."></textarea></div>
    <button class="btn-primary" onclick="APP.submitVisit()">Log Visit</button>`;
};
APP.submitVisit = async function() {
  const pid = APP.state.selectedProject;
  const body = { visit_date: document.getElementById('visit-date').value, summary: document.getElementById('visit-summary').value };
  if (!body.summary) { UI.toast('Add a summary'); return; }
  const res = await API.post(`/meetings/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('Visit logged ✓'); APP.renderVisits(); }
  else { UI.toast(res?.error || 'Failed to log visit'); }
};
APP.viewVisit = function(id) { UI.toast('Opening visit...'); };

// ── TASKS — site manager updates progress.
// The site-team Tasks tab is their daily-update + 7-day look-ahead tool.
// (Earlier this called renderScheduleView, which is the PMC multi-project view.
//  Site team needs renderSchedule — today's tasks with progress sliders, plus
//  the look-ahead planner for material / manpower / readiness.)
APP.renderTasks = async function() {
  return APP.renderSchedule();
};

// ── BUDGET — cost heads vs actual
// ── BUDGET — summary view with toggle to tree drill-down.
// Budget and Budget Tree were separate tabs before Sprint 2 Item 4; they now
// coexist in one "Budget" tab with a Summary/Drill-down toggle at the top.
// The budget_tree tab still exists for the Audit role (DB-driven nav).
APP._budgetToggleHTML = function() {
  const view = APP.state.budgetView || 'summary';
  return `<div style="display:flex;gap:6px;margin-bottom:14px">
    <button class="btn-sm ${view==='summary'?'navy':''}" onclick="APP.setBudgetView('summary')">Summary</button>
    <button class="btn-sm ${view==='tree'?'navy':''}" onclick="APP.setBudgetView('tree')">Drill-down</button>
  </div>`;
};
APP.setBudgetView = function(v) {
  APP.state.budgetView = v;
  APP.renderBudget();
};

APP.renderBudget = async function() {
  // Route to tree view if user toggled it
  if (APP.state.budgetView === 'tree') {
    return APP.renderBudgetTree();
  }
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/budget/${pid}`);
  if (!data) return;
  const heads = data.cost_heads || [];
  const totals = data.totals || {};

  const overallPct = totals.sanctioned > 0 ? ((totals.committed / totals.sanctioned)*100).toFixed(1) : '0.0';
  const totalColor = overallPct > 1.5 ? 'red' : overallPct > 1 ? 'amber' : 'green';
  const sanctioned = parseFloat(totals.sanctioned) || 0;
  const committed = parseFloat(totals.committed) || 0;

  let html = APP._projectSelectHtml('APP.renderBudget()') + APP._budgetToggleHTML() + `
  <div class="stat-row">
    <div class="stat-card">
      <span class="stat-val">₹${(sanctioned/100000).toFixed(1)}L</span>
      <span class="stat-lbl">Sanctioned</span>
    </div>
    <div class="stat-card">
      <span class="stat-val ${totalColor}">₹${(committed/100000).toFixed(1)}L</span>
      <span class="stat-lbl">Committed</span>
    </div>
    <div class="stat-card">
      <span class="stat-val ${totalColor}">${overallPct}%</span>
      <span class="stat-lbl">Used</span>
    </div>
  </div>
  <div class="sec-label">Cost Heads</div>`;

  if (!heads.length) { html += UI.empty('','No budget initialised — upload BOQ first'); }
  else heads.forEach(h => {
    const pct = parseFloat(h.variance_pct||0);
    const clr = h.status === 'critical' ? 'red' : h.status === 'over' ? 'amber' : h.status === 'watch' ? 'amber' : '';
    const fillColor = clr === 'red' ? 'red' : clr === 'amber' ? 'amber' : '';
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div class="card-title">${h.name}</div>
          <div class="card-meta">${h.stream} stream</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--navy)">₹${(parseFloat(h.committed)/100000).toFixed(1)}L</div>
          <div style="font-size:10px;color:var(--muted)">of ₹${(parseFloat(h.sanctioned)/100000).toFixed(1)}L</div>
        </div>
      </div>
      <div class="prog-row">
        <div class="prog-bar"><div class="prog-fill ${fillColor}" style="width:${Math.min(100,parseFloat(h.pct_committed||0))}%"></div></div>
        <div class="prog-pct" style="color:${clr?'var(--'+clr+')':'var(--muted)'}">${h.pct_committed||0}%</div>
      </div>
      ${pct > 0 ? `<div class="card-meta" style="color:var(--${clr||'muted'});margin-top:4px">${pct > 0 ? '+':''}${pct}% over sanctioned</div>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── PAYMENTS — Principal Saturday batch approval.
// Design Head / Services Head only see advance + final bills (Sprint 2 Item 4).
// They have design-stream oversight on these but not on weekly labour/material cycles.
APP.renderPayments = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/payment-requests/${pid}/weekly-batch`);
  if (!data) return;
  let pending = data.pending || [];

  // Filter for Design/Services Head — advance + final billings only
  const ADVANCE_FINAL_TYPES = [
    'advance','material_advance','mobilisation_advance',
    'final_bill','retention_release'
  ];
  if (['design_head','services_head'].includes(APP.user.role)) {
    pending = pending.filter(p => ADVANCE_FINAL_TYPES.includes(p.payment_type));
  }

  let html = APP._projectSelectHtml('APP.renderPayments()');

  const role = APP.user.role;
  const canApprove = ['principal','design_principal','pmc_head'].includes(role);
  // Raising a payment request is a site-level authority action — senior_site_manager
  // and up. Plain site_manager captures evidence/GRNs but does not raise (matches the
  // backend gate in payment-requests.js). They can still view the payments list.
  const canRaiseRequest = ['senior_site_manager','pmc_head','principal','design_principal'].includes(role);

  if (pending.length || canRaiseRequest) {
    const total = pending.reduce((s,p) => s + parseFloat(p.amount_requested||0), 0);
    if (canApprove) {
      html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;border-left:3px solid var(--navy)">
        <div style="padding:14px 16px;display:flex;align-items:center;gap:14px">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(29,61,98,0.10);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4263EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;color:var(--navy)">${Money.formatRupee(total)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">${pending.length} vendor${pending.length>1?'s':''} awaiting approval</div>
          </div>
          <button class="btn-sm approve" onclick="APP.batchApprovePayments('${pid}')">Approve All</button>
        </div>
      </div>`;
    }
    html += `<div class="sec-hdr-row" style="margin-bottom:8px">
      <div class="sec-label" style="margin:0;flex:1">Payment Queue</div>
      ${canRaiseRequest ? `<button class="btn-sm navy" onclick="APP.showRaisePaymentPicker(${pid})">+ Raise Request</button>` : ''}
    </div>`;
    html += APP._sortToggleHTML('payments', ['default','age']);
    const sortedPending = APP._applySort(pending, APP._getSortMode('payments'), { ageField:'created_at' });
    sortedPending.forEach(p => {
      const typeLabel = (p.payment_type||'').replace(/_/g,' ');
      html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px" data-pr-id="${p.id}">
        <div style="padding:14px 16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px;color:var(--navy)">${UI.escapeText(p.vendor_name||'—')}</div>
              <div style="font-size:12px;color:var(--text);margin-top:3px;line-height:1.4">${UI.escapeText((p.scope||'').substring(0,60))}</div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
                ${typeLabel ? `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;background:rgba(29,61,98,0.10);color:var(--navy);padding:2px 8px;border-radius:20px;border:1px solid rgba(29,61,98,0.20)">${typeLabel}</span>` : ''}
                <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">${UI.fmtDate(p.created_at)}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
              <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:var(--navy)">${Money.formatRupee(p.amount_requested)}</div>
              ${canApprove ? `<button class="btn-sm approve" onclick="APP.approvePayment(${p.id}, '${p.status}')">Approve</button>` : ''}
            </div>
          </div>
          ${p.evidence_files?.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 12px">
            ${p.evidence_files.map((f,i) => `<a href="${f.url}" target="_blank" class="btn-sm" style="text-decoration:none;font-size:11px">Evidence ${i+1}</a>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
    });
  } else {
    html += `<div class="sec-hdr-row" style="margin-bottom:8px">
      <div class="sec-label" style="margin:0;flex:1">Payment Queue</div>
      ${canRaiseRequest ? `<button class="btn-sm navy" onclick="APP.showRaisePaymentPicker(${pid})">+ Raise Request</button>` : ''}
    </div>`;
    html += `<div style="font-size:12px;color:var(--muted);padding:10px 0">No payments pending approval.</div>`;
  }

  // ── Urgent Payments section ──────────────────────────────────────
  const URGENT_ROLES = ['pmc_head','principal','design_principal','finance_admin'];
  if (URGENT_ROLES.includes(APP.user.role)) {
    const uData = await API.get(`/urgent-payments/${pid}`);
    const urgents = uData?.payments || [];
    html += `<div class="sec-hdr-row" style="margin-top:18px">
      <div class="sec-label" style="margin:0;flex:1">Urgent / Ad-hoc Payments (${urgents.length})</div>
      <button class="btn-sm navy" onclick="APP.showUrgentPaymentForm(${pid})">+ Raise Urgent</button>
    </div>`;
    if (!urgents.length) {
      html += `<div style="font-size:12px;color:var(--muted);padding:10px 0">No urgent payments raised yet.</div>`;
    } else {
      urgents.slice(0, 10).forEach(u => {
        const badge = u.status === 'approved' ? 'b-green' : u.status === 'rejected' ? 'b-red' : 'b-amber';
        html += `<div class="card" style="padding:12px 14px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px;color:var(--navy)">${UI.escapeText(u.reason||u.description||'Urgent payment')}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${u.is_adhoc ? '(Adhoc — '+UI.escapeText(u.adhoc_name||'no vendor') + ')' : 'Engagement-based'} · ${UI.fmtDate(u.created_at)}</div>
              ${u.evidence_files?.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">${u.evidence_files.map((f,i)=>`<a href="${f.url}" target="_blank" class="btn-sm" style="text-decoration:none;font-size:11px">${f.type==='upi_qr'?'QR Code':f.type==='invoice'?'Invoice':'File '+(i+1)}</a>`).join('')}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--navy)">₹${parseFloat(u.amount||0).toLocaleString('en-IN')}</div>
              <span class="badge ${badge}">${u.status}</span>
            </div>
          </div>
        </div>`;
      });
    }
  }

  // ── Direct Payments section (Principal / Design Principal / Finance Admin) ──
  const DIRECT_PAY_ROLES = ['principal','design_principal','finance_admin'];
  if (pid && DIRECT_PAY_ROLES.includes(APP.user.role)) {
    const dpData = await API.get(`/finance/${pid}/direct-payments`).catch(() => null);
    const directPayments = dpData?.payments || [];
    const canRecord = ['principal','design_principal'].includes(APP.user.role);
    html += `<div class="sec-hdr-row" style="margin-top:18px">
      <div class="sec-label" style="margin:0;flex:1">Direct Payments (${directPayments.length})</div>
      ${canRecord ? `<button class="btn-sm navy" onclick="APP.showAddDirectPayment(${pid})">+ Record</button>` : ''}
    </div>`;
    if (!directPayments.length) {
      html += `<div style="font-size:12px;color:var(--muted);padding:10px 0">No direct payments recorded yet.</div>`;
    } else {
      directPayments.slice(0, 10).forEach(p => {
        html += `<div class="card" style="padding:12px 14px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px;color:var(--navy)">${UI.escapeText(p.paid_to||'—')}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${UI.fmtDate(p.payment_date)} · ${(p.payment_type||'').replace(/_/g,' ')} · ${UI.escapeText(p.description||'—')}</div>
              ${p.upi_ref ? `<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">Ref: ${p.upi_ref}</div>` : ''}
              ${p.receipt_url ? `<a href="${p.receipt_url}" target="_blank" class="btn-sm" style="font-size:11px;margin-top:4px;display:inline-block">🧾 Receipt</a>` : ''}
            </div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--red);white-space:nowrap">-${Money.formatRupee(p.amount||0)}</div>
          </div>
        </div>`;
      });
    }
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showUrgentPaymentForm = async function(pid) {
  // Cleared vendors from the master — needed for the "Registered vendor" path
  // (sends vendor_id; without this the engagement option had no picker and
  // always fell back to adhoc validation).
  let vendorOptions = '';
  try {
    const vres = await API.call('GET', '/vendors/master');
    const cleared = (vres?.vendors || []).filter(v => v.is_active && v.clearance_status === 'cleared');
    vendorOptions = cleared.map(v => `<option value="${v.id}">${UI.escapeText(v.vendor_name)}${v.trade ? ' · ' + UI.escapeText(v.trade) : ''}</option>`).join('');
  } catch (_) { /* leave empty — engagement picker will show no options */ }

  UI.openModal('Raise Urgent Payment', `
    <div class="field-row"><label class="field-label">Amount (₹) *</label>
      <input type="number" id="up-amount" placeholder="e.g. 5000" min="1"></div>
    <div class="field-row"><label class="field-label">Description *</label>
      <input type="text" id="up-desc" placeholder="What is this payment for?"></div>
    <div class="field-row"><label class="field-label">Invoice Photo *</label>
      <input type="file" id="up-invoice" accept="image/*,.pdf"></div>
    <div class="field-row"><label class="field-label">Vendor type</label>
      <select id="up-type" onchange="var a=this.value==='adhoc';document.getElementById('up-adhoc-fields').style.display=a?'block':'none';document.getElementById('up-eng-fields').style.display=a?'none':'block';">
        <option value="adhoc">Adhoc / Shop (no vendor master)</option>
        <option value="engagement">Registered vendor engagement</option>
      </select></div>
    <div id="up-eng-fields" style="display:none">
      <div class="field-row"><label class="field-label">Vendor (from cleared master) *</label>
        <select id="up-eng-vendor">
          <option value="">${vendorOptions ? '— Select vendor —' : '— No cleared vendors —'}</option>
          ${vendorOptions}
        </select></div>
    </div>
    <div id="up-adhoc-fields">
      <div class="field-row"><label class="field-label">Shop owner name *</label>
        <input type="text" id="up-adhoc-name" placeholder="Name of shop/person"></div>
      <div class="field-row"><label class="field-label">Shop owner phone *</label>
        <input type="text" id="up-adhoc-phone" placeholder="10-digit mobile"></div>
      <div class="field-row" style="display:flex;gap:8px">
        <div style="flex:1"><label class="field-label">GSTIN <span style="color:var(--muted);font-weight:400">(or PAN — required above ₹10,000)</span></label>
          <input type="text" id="up-gstin" placeholder="15-char GSTIN" style="text-transform:uppercase"></div>
        <div style="flex:1"><label class="field-label">PAN</label>
          <input type="text" id="up-pan" placeholder="ABCDE1234F" style="text-transform:uppercase"></div>
      </div>
      <div class="field-row"><label class="field-label">UPI ID or Bank A/C + IFSC *</label>
        <input type="text" id="up-upi" placeholder="UPI ID (e.g. name@upi) or leave blank for bank details"></div>
      <div class="field-row"><label class="field-label">UPI QR Code <span style="color:var(--muted);font-weight:400">(optional — photo of QR)</span></label>
        <input type="file" id="up-upi-qr" accept="image/*" style="font-size:13px"></div>
      <div class="field-row" style="display:flex;gap:8px">
        <div style="flex:1"><label class="field-label">Bank Account</label>
          <input type="text" id="up-bank-acc" placeholder="Account number"></div>
        <div style="flex:1"><label class="field-label">IFSC</label>
          <input type="text" id="up-ifsc" placeholder="IFSC code"></div>
      </div>
    </div>
    <button class="btn-primary" onclick="APP.submitUrgentPayment(${pid})">Submit Urgent Payment</button>
  `);
};

APP.submitUrgentPayment = async function(pid) {
  const amount  = document.getElementById('up-amount')?.value;
  const desc    = document.getElementById('up-desc')?.value?.trim();
  const invoice = document.getElementById('up-invoice')?.files?.[0];
  const isAdhoc = document.getElementById('up-type')?.value === 'adhoc';
  const adhocName  = document.getElementById('up-adhoc-name')?.value?.trim();
  const adhocPhone = document.getElementById('up-adhoc-phone')?.value?.trim();
  const upi     = document.getElementById('up-upi')?.value?.trim();
  const bankAcc = document.getElementById('up-bank-acc')?.value?.trim();
  const ifsc    = document.getElementById('up-ifsc')?.value?.trim();
  const gstin   = document.getElementById('up-gstin')?.value?.trim().toUpperCase();
  const pan     = document.getElementById('up-pan')?.value?.trim().toUpperCase();
  const engVendorId = document.getElementById('up-eng-vendor')?.value;

  if (!amount || !desc) { UI.toast('Amount and description required'); return; }
  if (!invoice) { UI.toast('Invoice photo required'); return; }
  if (!isAdhoc && !engVendorId) { UI.toast('Select a vendor from the cleared master'); return; }
  if (isAdhoc && (!adhocName || !adhocPhone)) { UI.toast('Shop owner name and phone required'); return; }
  if (isAdhoc && !upi && (!bankAcc || !ifsc)) { UI.toast('UPI ID or bank account + IFSC required'); return; }
  // Mirror the backend rule so the user sees it before submitting.
  if (isAdhoc && parseFloat(amount) > 10000 && !gstin && !pan) {
    UI.toast('GST or PAN required for payments above ₹10,000'); return;
  }

  const fd = new FormData();
  fd.append('amount', amount);
  // Backend schema (UrgentPayment) requires `reason`; the form labels it
  // "Description". Send it as `reason` (was `description` → Zod rejected as
  // "Invalid input" because the required `reason` field was missing).
  fd.append('reason', desc);
  fd.append('is_adhoc', isAdhoc ? '1' : '0');
  fd.append('invoice', invoice);
  if (isAdhoc) {
    fd.append('adhoc_name', adhocName);
    fd.append('adhoc_phone', adhocPhone);
    if (upi) fd.append('adhoc_upi_id', upi);
    const upiQr = document.getElementById('up-upi-qr')?.files?.[0];
    if (upiQr) fd.append('upi_qr', upiQr);
    if (bankAcc) fd.append('adhoc_bank_account', bankAcc);
    if (ifsc) fd.append('adhoc_bank_ifsc', ifsc);
    if (gstin) fd.append('adhoc_gstin', gstin);
    if (pan) fd.append('adhoc_pan', pan);
  } else {
    // Registered vendor engagement — send vendor_id so the backend does not
    // treat it as adhoc (isAdhoc = is_adhoc || !vendor_id).
    fd.append('vendor_id', engVendorId);
  }
  const res = await API.call('POST', `/urgent-payments/${pid}`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Urgent payment raised ✓'); APP.renderPayments(); }
  else UI.toast(res?.error || 'Failed to raise urgent payment');
};

APP.batchApprovePayments = async function(pid) {
  // Role-aware endpoint selection:
  //   PMC Head → /payment-requests/:pid/batch-approve (pending_pmc → pmc_approved)
  //   Principal/Design Principal → /payments/:pid/batch-approve (pmc_approved → principal_approved)
  // The two stages show the same "Approve All" button UI but on different lists.
  const role = APP.user?.role;
  const isPMC = role === 'pmc_head';
  if (isPMC) {
    // Collect all visible PR ids from the current render
    const items = document.querySelectorAll('[data-pr-id]');
    const ids = Array.from(items).map(el => parseInt(el.getAttribute('data-pr-id'))).filter(Boolean);
    if (!ids.length) {
      // Fallback: fetch the weekly-batch payload to derive ids
      const d = await API.get(`/payment-requests/${pid}/weekly-batch`);
      (d?.pending || []).forEach(p => ids.push(p.id));
    }
    if (!ids.length) { UI.toast('No pending payments found'); return; }
    const res = await API.post(`/payment-requests/${pid}/batch-approve`, { ids });
    if (res?.success) { UI.toast(`${res.approved || ids.length} payment${ids.length>1?'s':''} approved ✓`); APP.renderPayments(); }
    else { UI.toast(res?.error || 'Approval failed'); }
  } else {
    const res = await API.post(`/payments/${pid}/batch-approve`, {});
    if (res?.success) { UI.toast(`${res.approved} payment${res.approved>1?'s':''} approved ✓`); APP.renderPayments(); }
    else { UI.toast(res?.error || 'Approval failed'); }
  }
};

// ── PAYMENTS FINANCE — Finance Admin view (Saturday workflow)
APP.renderPaymentsFin = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/payment-requests/${pid}/weekly-batch`);
  if (!data) return;
  const pending = data.pending || [];

  const total = pending.reduce((s,p) => s + parseFloat(p.amount_requested||0), 0);

  let html = APP._projectSelectHtml('APP.renderPaymentsFin()') + `
  <div class="sec-label">Saturday Payment Workflow</div>
  <div class="stat-row" style="grid-template-columns:1fr 1fr">
    <div class="stat-card">
      <span class="stat-val">${pending.length}</span>
      <span class="stat-lbl">Vendors</span>
    </div>
    <div class="stat-card">
      <span class="stat-val">₹${(total/100000).toFixed(1)}L</span>
      <span class="stat-lbl">Total</span>
    </div>
  </div>`;

  if (pending.length) {
    html += `<div class="sec-label" style="margin-bottom:8px">Steps</div>`;
    const steps = [
      { n:'1', title:'Run pre-upload check', meta:'Validates account numbers and checks for duplicates',
        action:`<button class="btn-sm" style="margin-top:10px;width:100%;justify-content:center" onclick="APP.runPreUploadCheck('${pid}')">Run Validation Check</button>` },
      { n:'2', title:'Generate ICICI Batch', meta:'Locks in payments, creates batch cycle record, and generates Excel',
        action:`<button class="btn-sm navy" style="margin-top:10px" onclick="APP.generateICICIBatch('${pid}')">Generate Batch</button>` },
      { n:'3', title:'Download & upload to ICICI', meta:'Finance Admin downloads Excel and uploads to ICICI Corporate Bulk Payments',
        action:`<button class="btn-sm" style="margin-top:10px" onclick="APP.downloadICICIExcel('${pid}')">Download Excel (Finance)</button>` },
      { n:'4', title:'Confirm payments (after bank processes)', meta:'Upload ICICI confirmation Excel to mark payments paid and notify vendors',
        action:`<button class="btn-sm approve" style="margin-top:10px" onclick="APP.showICICIConfirmForm('${pid}')">Upload Confirmation</button>` },
    ];
    steps.forEach(s => {
      html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:8px">
        <div style="padding:14px 16px;display:flex;align-items:flex-start;gap:12px">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--navy);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${s.n}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;color:var(--navy)">${s.title}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">${s.meta}</div>
            ${s.action}
          </div>
        </div>
      </div>`;
    });
    html += `<div class="card" id="precheck-results" style="display:none;margin-bottom:8px;padding:14px 16px"></div>`;
  } else {
    html += UI.empty('','No approved payments to process');
  }

  html += `<div class="sec-label" style="margin-bottom:8px">Payments</div>`;
  pending.forEach(p => {
    const xferType = (p.bank_ifsc||'').startsWith('ICIC') ? 'FT' : 'NEFT';
    html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">
      <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;color:var(--navy)">${UI.escapeText(p.vendor_name||'—')}</div>
          <div style="font-size:12px;color:var(--text);margin-top:3px">${UI.escapeText((p.scope||'').substring(0,60))}</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:4px">${p.bank_ifsc||'—'} · <span style="font-weight:600">${xferType}</span></div>
        </div>
        <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:var(--navy);flex-shrink:0">${Money.formatRupee(p.amount_requested)}</div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.runPreUploadCheck = async function(pid) {
  const data = await API.get(`/payment-requests/${pid}/weekly-batch`);
  if (!data?.pending?.length) { UI.toast('No payments to check'); return; }
  const ids = data.pending.map(p => p.id);
  const res = await API.post('/payments/pre-upload-check', { payment_ids: ids });
  if (!res) return;

  const card = document.getElementById('precheck-results');
  if (!card) return;
  card.style.display = 'block';

  const issues  = res.results?.filter(r => !r.cleared) || [];
  const warnings = res.results?.filter(r => r.warnings?.length) || [];

  let html = `<div class="card-title">${res.summary?.ready_to_upload ? ' All Clear — Safe to download' : '⚠ Issues Found'}</div>`;
  if (issues.length) {
    html += issues.map(r => `<div style="color:var(--red);font-size:12px;margin-top:6px">✗ ${r.vendor}: ${r.issues.join(', ')}</div>`).join('');
  }
  if (warnings.length) {
    html += warnings.map(r => r.warnings.map(w => `<div style="color:var(--amber);font-size:12px;margin-top:4px">⚠ ${r.vendor}: ${w}</div>`).join('')).join('');
  }
  if (!issues.length && !warnings.length) {
    html += `<div style="color:var(--green);font-size:12px;margin-top:6px">${res.summary?.cleared} payment${res.summary?.cleared!==1?'s':''} validated — accounts confirmed, no duplicates.</div>`;
  }
  card.innerHTML = html;
};

APP.downloadICICIExcel = async function(pid) {
  try {
    const fetchUrl = '/' + 'api/payments/' + pid + '/icici-excel';
    const resp = await fetch(fetchUrl, {
      credentials: 'same-origin',
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      UI.toast(err?.error || `Download failed (${resp.status})`);
      return;
    }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'ICICI_Bulk_Payment.xlsx';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    UI.toast('Download failed — check your connection');
  }
};

APP.generateICICIBatch = async function(pid) {
  const data = await API.get(`/payment-requests/${pid}/weekly-batch`);
  if (!data?.pending?.length) { UI.toast('No approved payments to batch'); return; }
  const ids = data.pending.map(p => p.id);
  const total = data.pending.reduce((s, p) => s + parseFloat(p.amount_requested || 0), 0);
  const ok = await UI.confirm(`Generate ICICI batch?\n\n${ids.length} payment(s) — ₹${Money.formatRupee(total)}\n\nThis will lock payments in as processed and create a cycle record.`);
  if (!ok) return;
  const res = await API.post(`/payments/${pid}/icici/generate`, {
    payment_ids: ids, confirmation: 'GENERATE', expected_total: total
  });
  if (res?.success) {
    UI.toast(`Batch generated ✓ — Cycle #${res.cycle_id} for ₹${Money.formatRupee(res.total)}`);
    APP._lastICICICycleId = res.cycle_id;
  } else {
    UI.toast(res?.error || 'Batch generation failed');
  }
};

APP.showICICIConfirmForm = async function(pid) {
  // Pick the batch cycle from a list of generated/uploaded (awaiting-confirmation)
  // cycles instead of typing an unknown number. Falls back to a number input only
  // if the list can't be fetched.
  let cycleField;
  try {
    const res = await API.getICICICycles(pid);
    const cycles = res?.cycles || [];
    if (cycles.length) {
      const opts = cycles.map((c, i) => {
        const label = `Cycle #${c.id} · ${UI.fmtDate(c.cycle_date)} · ${c.payment_count} payment${c.payment_count === 1 ? '' : 's'}`;
        const sel = (String(c.id) === String(APP._lastICICICycleId) || (i === 0 && !APP._lastICICICycleId)) ? ' selected' : '';
        return `<option value="${c.id}"${sel}>${label}</option>`;
      }).join('');
      cycleField = `<select id="icici-cycle-id">${opts}</select>`;
    } else {
      cycleField = `<div style="font-size:12px;color:var(--muted);padding:8px 0">No batches awaiting confirmation. Generate a batch first (step 2).</div>
        <input type="hidden" id="icici-cycle-id" value="">`;
    }
  } catch (_) {
    cycleField = `<input type="number" id="icici-cycle-id" placeholder="e.g. 42" value="${APP._lastICICICycleId || ''}">`;
  }
  UI.openModal('Upload ICICI Confirmation', `
    <div class="field-row">
      <label class="field-label">Cycle</label>
      ${cycleField}
    </div>
    <div class="field-row">
      <label class="field-label">ICICI Confirmation Excel</label>
      <input type="file" id="icici-confirm-file" accept=".xlsx,.xls">
    </div>
    <div id="icici-preview-area"></div>
    <button class="btn-primary" onclick="APP.previewICICIConfirm('${pid}')">Preview</button>
  `);
};

APP.previewICICIConfirm = async function(pid) {
  const cycleId = document.getElementById('icici-cycle-id')?.value;
  const fileInput = document.getElementById('icici-confirm-file');
  if (!cycleId || !fileInput?.files?.length) { UI.toast('Cycle ID and file required'); return; }
  const fd = new FormData();
  fd.append('confirmation', fileInput.files[0]);
  fd.append('cycle_id', cycleId);
  const res = await API.call('POST', `/payments/${pid}/icici/confirm/preview`, fd, true);
  if (!res?.preview) { UI.toast(res?.error || 'Preview failed'); return; }
  APP._iciciPreviewToken = res.file_token;
  APP._iciciPreviewCycleId = res.cycle_id;
  const rows = res.preview;
  let html = `<div style="font-size:12px;color:var(--amber);margin:10px 0">${res.warning}</div>`;
  html += `<div style="overflow-x:auto"><table style="width:100%;font-size:11px;border-collapse:collapse">
    <thead><tr style="background:var(--surface-2)">
      <th style="padding:6px 8px;text-align:left">Vendor</th>
      <th style="padding:6px 8px;text-align:right">Amount</th>
      <th style="padding:6px 8px;text-align:left">UTR</th>
      <th style="padding:6px 8px;text-align:left">Status</th>
    </tr></thead><tbody>`;
  rows.forEach(r => {
    const ok = r.will_mark_paid;
    html += `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 8px">${UI.escapeText(r.vendor_name || '—')}</td>
      <td style="padding:6px 8px;text-align:right;font-family:var(--mono)">${Money.formatRupee(r.amount)}</td>
      <td style="padding:6px 8px;font-family:var(--mono);font-size:10px">${r.utr || '—'}</td>
      <td style="padding:6px 8px;color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? '✓ Will mark paid' : '✗ ' + (r.status || 'Failed')}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  html += `<button class="btn-primary" style="margin-top:12px;width:100%" onclick="APP.confirmICICIPayments('${pid}', ${res.summary.will_mark_paid})">Confirm ${res.summary.will_mark_paid} Payments Paid</button>`;
  document.getElementById('icici-preview-area').innerHTML = html;
};

APP.confirmICICIPayments = async function(pid, expectedCount) {
  if (!APP._iciciPreviewToken) { UI.toast('Run preview first'); return; }
  const ok = await UI.confirm(`Mark ${expectedCount} payment(s) as paid and send WhatsApp to vendors?`);
  if (!ok) return;
  const res = await API.post(`/payments/${pid}/icici/confirm`, {
    confirmation: 'CONFIRM_PAID',
    file_token: APP._iciciPreviewToken,
    cycle_id: APP._iciciPreviewCycleId,
    expected_success_count: expectedCount,
  });
  if (res?.success) {
    UI.toast(`${res.confirmed_count || expectedCount} payments confirmed ✓ — vendors notified`);
    APP._iciciPreviewToken = null;
    UI.closeModal();
    APP.renderPayments();
  } else UI.toast(res?.error || 'Confirmation failed');
};

// ── PI — proforma invoices
APP.renderPI = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  const data = await API.get(`/invoices/${pid}/pi`);
  if (!data) return;
  const pis = data.invoices || [];
  const canRaise = ['pmc_head','principal','design_principal','finance_admin'].includes(APP.user.role);
  const isFinance = ['finance_admin','pmc_head','principal','design_principal'].includes(APP.user.role);

  let html = APP._projectSelectHtml('APP.renderPI()') + `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sec-label" style="margin:0">Proforma Invoices</div>
      <div style="display:flex;gap:6px">
        ${isFinance ? `<button class="btn-sm" onclick="APP.showFeeScheduleUpload(${pid})">Fee Schedule</button>` : ''}
        ${isFinance ? `<button class="btn-sm" onclick="APP.downloadAllTally(${pid})">All Tally</button>` : ''}
        ${canRaise ? `<button class="btn-sm navy" onclick="APP.showRaisePI(${pid})">+ Raise PI</button>` : ''}
      </div>
    </div>`;
  if (!pis.length) { html += UI.empty('','No invoices raised yet'); }
  else pis.forEach(pi => {
    const badge = pi.status === 'paid' ? 'b-green' : pi.status === 'issued' ? 'b-navy' : 'b-amber';
    html += `<div class="pay-item">
      <div style="display:flex;justify-content:space-between">
        <div>
          <div class="pay-vendor">${pi.pi_number||'PI-'+pi.id}</div>
          <div class="pay-scope">${pi.milestone_description||''}</div>
          <div class="pay-meta">${UI.fmtDate(pi.raised_at)}</div>
        </div>
        <div style="text-align:right">
          <div class="pay-amount">${Money.formatRupee(pi.amount||0)}</div>
          <span class="badge ${badge}" style="margin-top:4px">${pi.status||'draft'}</span>
        </div>
      </div>
      ${isFinance ? `<div style="display:flex;gap:6px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
        <a href="/api/pi-generator/${pi.id}/pdf" target="_blank" class="btn-sm" style="flex:1;text-align:center;text-decoration:none">📄 PDF</a>
        <a href="/api/pi-generator/${pi.id}/tally?type=sales" download class="btn-sm" style="flex:1;text-align:center;text-decoration:none">📥 Sales</a>
        <a href="/api/pi-generator/${pi.id}/tally?type=receipt" download class="btn-sm" style="flex:1;text-align:center;text-decoration:none">📥 Receipt</a>
      </div>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── Download all tally XMLs for paid PIs in a project
APP.downloadAllTally = async function(pid) {
  const data = await API.get(`/pi-generator/all/${pid}/tally`);
  if (!data?.tally_urls?.length) { UI.toast('No paid invoices found'); return; }
  data.tally_urls.forEach((url, i) => {
    setTimeout(() => { const a = document.createElement('a'); a.href = url; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); }, i * 600);
  });
  UI.toast(`Downloading ${data.count} Tally XML(s)…`);
};

// ── Raise PI against a fee-schedule milestone
APP.showRaisePI = async function(pid) {
  const fs = await API.call('GET', `/invoices/${pid}/fee-schedule`);
  const items = (fs && fs.items) || [];
  // Exclude milestones that already have an issued/paid PI (best-effort — backend is source of truth)
  const available = items.filter(i => !['issued','paid','acknowledged'].includes(i.pi_status));

  if (!available.length) {
    UI.openModal('Raise PI', `
      <div style="color:var(--muted);padding:8px 0">
        No fee-schedule milestones are available for PI generation.
        Either upload the fee schedule first, or all milestones already have PIs raised.
      </div>
      <button class="btn-secondary" onclick="UI.closeModal()">Close</button>`);
    return;
  }

  const opts = available.map(i =>
    `<option value="${i.id}">${i.milestone_name} — ${Money.formatRupee(i.amount||0)}</option>`
  ).join('');

  UI.openModal('Raise Proforma Invoice', `
    <div class="field-row"><label class="field-label" for="rpi-fs">Milestone *</label>
      <select id="rpi-fs">${opts}</select></div>
    <div class="field-row"><label class="field-label" for="rpi-notes">Notes (optional)</label>
      <textarea id="rpi-notes" rows="2" placeholder="Any additional context for this PI"></textarea></div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px">
      GSTIN and Tally ledger come from client master — confirm both are set before raising.
    </div>
    <button class="btn-primary" onclick="APP.submitRaisePI(${pid})">Raise PI</button>
  `);
};

APP.submitRaisePI = async function(pid) {
  const fs = parseInt(document.getElementById('rpi-fs').value);
  const notes = document.getElementById('rpi-notes').value.trim() || null;
  if (!fs) { UI.toast('Select a milestone'); return; }
  const res = await API.call('POST', `/invoices/${pid}/pi`, { fee_schedule_id: fs, notes });
  if (res?.success) {
    UI.closeModal();
    UI.toast(`PI raised — ${res.pi_number || ''} ✓`);
    APP.renderPI();
    return;
  }

  // ── Graceful error handling for incomplete client master
  if (res?.code === 'CLIENT_INCOMPLETE' && res?.client_id) {
    UI.closeModal();
    if (APP.user.role === 'finance_admin') {
      // Finance Admin: offer to complete master right now
      const name = (res.error || '').match(/"([^"]+)"/)?.[1] || 'this client';
      if (confirm(`${res.error}\n\nOpen completion form now?`)) {
        APP.showCompleteClient(res.client_id, name);
      }
    } else {
      UI.toast('Client master incomplete — ask Finance Admin (finance) to complete it before raising PI');
    }
    return;
  }
  if (res?.code === 'CLIENT_NOT_LINKED') {
    UI.toast('This project has no client on record — contact finance');
    return;
  }

  UI.toast(res?.error || 'Failed to raise PI');
};

// ── PETTY CASH — Finance Admin
APP.renderPettyCash = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  const data = await API.get(`/finance/${pid}/petty-cash`);
  if (!data) return;
  const entries = data.transactions || data.entries || [];
  const balance = data.balance || 0;

  let html = APP._projectSelectHtml('APP.renderPettyCash()') + `
  <div class="stat-row" style="grid-template-columns:1fr 1fr">
    <div class="stat-card">
      <span class="stat-val">${Money.formatRupee(balance)}</span>
      <span class="stat-lbl">Balance</span>
    </div>
    <div class="stat-card">
      <span class="stat-val">${entries.length}</span>
      <span class="stat-lbl">Transactions</span>
    </div>
  </div>
  ${['pmc_head','principal','design_principal'].includes(APP.user.role) ? `<button class="btn-primary" style="width:100%;margin-bottom:12px" onclick="APP.showAddPettyCashAdmin(${pid})">+ Add Spend</button>` : ''}
  <div class="sec-label">Recent Transactions</div>`;
  entries.slice(0,10).forEach(e => {
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div class="card-title">${e.description||'—'}</div>
          <div class="card-meta">${UI.fmtDate(e.txn_date||e.created_at)} · ${e.recorded_by_name||e.created_by_name||'—'} · ${(e.category||'').replace(/_/g,' ')}</div>
          ${e.bill_url ? `<a href="${e.bill_url}" target="_blank" class="btn-sm" style="margin-top:5px;text-decoration:none;display:inline-block;font-size:11px">View Bill</a>` : ''}
        </div>
        <div style="font-family:var(--mono);font-size:15px;font-weight:600;color:var(--red);flex-shrink:0;margin-left:12px">-${Money.formatRupee(e.amount)}</div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showAddPettyCashAdmin = function(pid) {
  UI.showModal('Add Petty Cash Spend', `
    <div class="field"><label>Date</label><input type="date" id="pct-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Description</label><input id="pct-desc" placeholder="e.g. Nails and screws from hardware shop"></div>
    <div class="field"><label>Amount (₹)</label><input id="pct-amount" type="number" min="0"></div>
    <div class="field"><label>Category</label>
      <select id="pct-cat">
        <option value="material">Material</option>
        <option value="labour">Labour</option>
        <option value="site_expense">Site Expense</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="field"><label>Bill / Receipt <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <input type="file" id="pct-bill" accept="image/*,.pdf" style="font-size:13px">
    </div>
    <button class="btn-primary" onclick="APP._submitPettyCashAdmin(${pid})" style="width:100%;margin-top:8px">Save</button>
  `);
};

APP._submitPettyCashAdmin = async function(pid) {
  const txn_date    = document.getElementById('pct-date')?.value;
  const description = document.getElementById('pct-desc')?.value;
  const amount      = document.getElementById('pct-amount')?.value;
  const category    = document.getElementById('pct-cat')?.value;
  const billFile    = document.getElementById('pct-bill')?.files?.[0];
  if (!txn_date || !description || !amount) { UI.toast('Fill all fields'); return; }
  const fd = new FormData();
  fd.append('txn_date', txn_date);
  fd.append('description', description);
  fd.append('amount', amount);
  fd.append('category', category);
  if (billFile) fd.append('bill', billFile);
  const res = await API.call('POST', `/finance/${pid}/petty-cash`, fd, true);
  if (res?.success) { UI.closeModal(); APP.renderPettyCash(); UI.toast('Transaction saved ✓'); }
  else UI.toast(res?.error || 'Failed');
};

// ── USERS — Principal user management
APP.renderUsers = async function() {
  const el = UI.contentEl();

  const [pending, all, resettable] = await Promise.all([
    API.get('/user-management/pending'),
    API.get('/users'),
    API.get('/admin-reset/resettable-users'),
  ]);

  const resettableIds = new Set((resettable?.users||[]).map(u => u.id));

  // Avatar helpers
  const _uInitials = n => (n||'').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const _roleAvatar = role => {
    const map = {
      principal:['#E3EAFD','#3B5BDB'], design_principal:['#E3EAFD','#3B5BDB'],
      pmc_head:['#F3F0FF','#7048E8'],
      design_head:['#E6FCF5','#0CA678'], services_head:['#E6FCF5','#0CA678'],
      site_manager:['#FFF3BF','#E67700'], senior_site_manager:['#FFF3BF','#E67700'],
      finance_admin:['#E8F5E9','#2E7D32'], audit:['#F1F3F5','#868E96'],
    };
    return map[role] || ['#EEF2FF','#4263EB'];
  };

  // ── Bulk Upload card — icon + two action buttons in footer bar
  let html = `
  <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
    <div style="display:flex;align-items:center;gap:14px;padding:16px">
      <div style="width:44px;height:44px;border-radius:10px;background:rgba(12,166,120,0.12);color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;color:var(--navy)">Bulk Upload Users</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Upload Excel with all team members at once — download the template first</div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);display:flex">
      <a href="/templates/nu_PMC_BulkUpload_Templates_v1.xlsx" download style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 8px;font-size:13px;font-weight:600;color:var(--navy);text-decoration:none;border-right:1px solid var(--border)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Template
      </a>
      <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 8px;font-size:13px;font-weight:600;color:#fff;background:var(--navy);cursor:pointer">
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="APP.bulkUploadUsers(this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
        Upload Excel
      </label>
    </div>
  </div>`;

  // ── Pending Approvals
  const approvals = pending?.pending || [];
  if (approvals.length) {
    html += `<div class="sec-label">Pending Approval (${approvals.length})</div>`;
    approvals.forEach(u => {
      const [bg, fg] = _roleAvatar(u.role);
      html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:8px;border-left:3px solid var(--amber)">
        <div style="display:flex;align-items:center;gap:14px;padding:14px 16px">
          <div style="width:40px;height:40px;border-radius:50%;background:${bg};color:${fg};font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${_uInitials(u.full_name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;color:var(--text)">${UI.escapeText(u.full_name)}</div>
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${APP._roleLabel(u.role)} · ${u.email||u.phone||'—'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn-sm approve" onclick="APP.approveUser(${u.id})">Approve</button>
            <button class="btn-sm reject"  onclick="APP.rejectUser(${u.id})">Reject</button>
          </div>
        </div>
      </div>`;
    });
  }

  // ── Active Users
  const isPrincipal = ['principal','design_principal'].includes(APP.user?.role);
  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Active Users</div>
    ${isPrincipal ? `<button class="btn-primary sec-hdr-btn" onclick="APP.openAddUserModal()">+ Add User</button>` : ''}
  </div>
  ${isPrincipal ? `<button class="btn-primary sec-action-mobile" onclick="APP.openAddUserModal()">+ Add User</button>` : ''}`;

  const users = all?.users || [];
  if (users.length) {
    html += `<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">`;
    users.forEach((u, i) => {
      const [bg, fg] = _roleAvatar(u.role);
      const canReset = resettableIds.has(u.id);
      html += `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px${i > 0 ? ';border-top:1px solid var(--border)' : ''}">
        <div style="width:40px;height:40px;border-radius:50%;background:${bg};color:${fg};font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${_uInitials(u.full_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(u.full_name)}</div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${APP._roleLabel(u.role)} · ${u.email||u.phone||'—'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;width:160px;justify-content:flex-end">
          <span style="display:inline-flex;align-items:center;justify-content:center;height:28px;width:72px;border-radius:4px;background:rgba(12,166,120,0.15);color:var(--green);font-size:11px;font-weight:700;letter-spacing:0.5px;box-sizing:border-box;border:1px solid rgba(12,166,120,0.35)">ACTIVE</span>
          ${canReset
            ? `<button onclick="APP.resetUserPassword(${u.id},'${UI.escapeText(u.full_name)}')" style="height:28px;width:72px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:11px;font-weight:600;cursor:pointer;box-sizing:border-box">Reset PW</button>`
            : `<div style="height:28px;width:72px"></div>`}
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── GOVERNANCE ADMIN ────────────────────────────────────────────────────────
// ── ACCOUNT SETUP (Principal-only) ─────────────────────────────────────────
// Manage company entities and their bank details.
// Principals see full details. Finance sees masked account numbers.

APP.renderAccountSetup = async function() {
  const el = UI.contentEl();
  UI.loading(el);

  const data = await API.get('/company-entities');
  if (!data) return;

  const isPrincipal = ['principal', 'design_principal'].includes(APP.user?.role);

  const entityCard = (e) => {
    const statusBadge = e.is_active
      ? `<span class="badge b-green">Active</span>`
      : `<span class="badge b-amber">Inactive</span>`;
    const bankLine = e.bank_account_no
      ? `${e.bank_name || '—'} · ${e.bank_account_no} · ${e.bank_ifsc || '—'}`
      : `<span style="color:var(--muted)">No bank details entered</span>`;

    return `
    <div class="card" style="margin-bottom:12px" id="entity-card-${e.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span class="badge b-steel">${e.entity_code}</span>
            ${statusBadge}
          </div>
          <div class="card-title" style="margin-top:4px">${e.legal_name}</div>
          ${e.gstin ? `<div class="card-meta">GSTIN: ${e.gstin}</div>` : ''}
          <div class="card-meta" style="margin-top:6px">${bankLine}</div>
          ${e.upi_id ? `<div class="card-meta">UPI: ${e.upi_id}</div>` : ''}
        </div>
        ${isPrincipal ? `
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="btn btn-sm" onclick="APP.editEntity(${e.id})">Edit</button>
          <button class="btn btn-sm btn-ghost"
            onclick="APP.toggleEntityStatus(${e.id}, ${e.is_active ? 'false' : 'true'}, '${e.legal_name.replace(/'/g, "\\'")}')">
            ${e.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>` : ''}
      </div>
    </div>`;
  };

  const cardsHtml = data.entities.length
    ? data.entities.map(entityCard).join('')
    : `<div style="color:var(--muted);padding:16px 0">No entities configured yet.</div>`;

  el.innerHTML = `<div class="fade-in">
    <div class="sec-label">Account Setup — Company Entities</div>
    <div style="color:var(--muted);font-size:13px;margin-bottom:16px">
      Each entity maps to a legal company. Projects are linked to an entity at setup.
      ICICI bulk payments debit from the entity's bank account.
      GSTIN and entity code cannot be changed here — contact your accountant if these need correcting.
    </div>

    ${cardsHtml}

    ${isPrincipal ? `
    <button class="btn" style="margin-top:8px" onclick="APP.addEntity()">
      + Add Company
    </button>` : ''}
  </div>`;
};

APP._entityFormHtml = function(entity) {
  const v = entity || {};
  const isEdit = !!v.id;
  const title = isEdit ? `Edit — ${v.legal_name}` : 'Add Company';

  return `
  <div class="modal-body">
    <div class="sec-label" style="margin-bottom:12px">${title}</div>

    ${!isEdit ? `
    <div style="margin-bottom:10px">
      <label class="field-label">Entity Code <span style="color:var(--muted);font-size:11px">(permanent, e.g. LLP / PROP)</span></label>
      <input class="input" id="ef-entity_code" value="${v.entity_code||''}" placeholder="LLP" maxlength="20">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">GSTIN <span style="color:var(--muted);font-size:11px">(permanent)</span></label>
      <input class="input" id="ef-gstin" value="${v.gstin||''}" placeholder="29AAAAA0000A1Z0" maxlength="15">
    </div>` : `
    <div style="margin-bottom:10px;padding:8px;background:var(--surface2);border-radius:6px">
      <div class="card-meta">Entity code and GSTIN cannot be changed here.</div>
    </div>`}

    <div style="margin-bottom:10px">
      <label class="field-label">Legal Name</label>
      <input class="input" id="ef-legal_name" value="${v.legal_name||''}" placeholder="Your Company LLP">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Address</label>
      <input class="input" id="ef-address_line1" value="${v.address_line1||''}" placeholder="Street address">
      <input class="input" style="margin-top:4px" id="ef-address_line2" value="${v.address_line2||''}" placeholder="Line 2 (optional)">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <label class="field-label">City</label>
        <input class="input" id="ef-city" value="${v.city||'Bengaluru'}">
      </div>
      <div>
        <label class="field-label">Pincode</label>
        <input class="input" id="ef-pincode" value="${v.pincode||''}" maxlength="6">
      </div>
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Primary Email</label>
      <input class="input" id="ef-email_primary" type="email" value="${v.email_primary||''}">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Finance Email</label>
      <input class="input" id="ef-email_finance" type="email" value="${v.email_finance||''}">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Phone</label>
      <input class="input" id="ef-phone" type="tel" value="${v.phone||''}">
    </div>

    <div class="sec-label" style="margin:14px 0 8px">Bank Details</div>
    <div style="margin-bottom:10px">
      <label class="field-label">Bank Name</label>
      <input class="input" id="ef-bank_name" value="${v.bank_name||''}" placeholder="ICICI Bank">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Account Number</label>
      <input class="input" id="ef-bank_account_no" value="${v.bank_account_no||''}"
             placeholder="Account number" autocomplete="off">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">IFSC</label>
      <input class="input" id="ef-bank_ifsc" value="${v.bank_ifsc||''}" placeholder="ICIC0000000" maxlength="11">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Account Holder Name</label>
      <input class="input" id="ef-bank_account_holder" value="${v.bank_account_holder||''}">
    </div>
    <div style="margin-bottom:10px">
      <label class="field-label">Branch</label>
      <input class="input" id="ef-bank_branch" value="${v.bank_branch||''}">
    </div>
    <div style="margin-bottom:16px">
      <label class="field-label">UPI ID <span style="color:var(--muted);font-size:11px">(optional)</span></label>
      <input class="input" id="ef-upi_id" value="${v.upi_id||''}">
    </div>
  </div>`;
};

APP._entityFormValues = function() {
  const f = id => (document.getElementById(id)?.value || '').trim();
  return {
    entity_code:          f('ef-entity_code'),
    gstin:                f('ef-gstin'),
    legal_name:           f('ef-legal_name'),
    address_line1:        f('ef-address_line1'),
    address_line2:        f('ef-address_line2'),
    city:                 f('ef-city'),
    pincode:              f('ef-pincode'),
    email_primary:        f('ef-email_primary'),
    email_finance:        f('ef-email_finance'),
    phone:                f('ef-phone'),
    bank_name:            f('ef-bank_name'),
    bank_account_no:      f('ef-bank_account_no'),
    bank_ifsc:            f('ef-bank_ifsc'),
    bank_account_holder:  f('ef-bank_account_holder'),
    bank_branch:          f('ef-bank_branch'),
    upi_id:               f('ef-upi_id'),
  };
};

APP.addEntity = function() {
  UI.modal(
    APP._entityFormHtml(null),
    [{
      label: 'Save', primary: true,
      action: async () => {
        const body = APP._entityFormValues();
        if (!body.entity_code) { UI.toast('Entity code required', 'error'); return false; }
        if (!body.legal_name)  { UI.toast('Legal name required', 'error'); return false; }
        if (!body.bank_account_no) { UI.toast('Bank account required', 'error'); return false; }
        if (!body.bank_ifsc)   { UI.toast('IFSC required', 'error'); return false; }
        const res = await API.post('/company-entities', body);
        if (res?.error) { UI.toast(res.error, 'error'); return false; }
        UI.toast('Company added');
        APP.renderAccountSetup();
        return true;
      },
    }]
  );
};

APP.editEntity = async function(id) {
  const data = await API.get('/company-entities');
  if (!data) return;
  const entity = data.entities.find(e => e.id === id);
  if (!entity) return;

  UI.modal(
    APP._entityFormHtml(entity),
    [{
      label: 'Save', primary: true,
      action: async () => {
        const body = APP._entityFormValues();
        if (!body.legal_name)  { UI.toast('Legal name required', 'error'); return false; }
        if (!body.bank_account_no) { UI.toast('Bank account required', 'error'); return false; }
        if (!body.bank_ifsc)   { UI.toast('IFSC required', 'error'); return false; }

        // Confirm bank account change
        const acct = body.bank_account_no;
        const tail = acct.slice(-4);
        const confirmed = await UI.confirm(
          `Payments from ${entity.legal_name} will debit account ending ${tail}. Confirm?`
        );
        if (!confirmed) return false;

        const res = await API.patch(`/company-entities/${id}`, body);
        if (res?.error) { UI.toast(res.error, 'error'); return false; }
        UI.toast('Entity updated');
        APP.renderAccountSetup();
        return true;
      },
    }]
  );
};

APP.toggleEntityStatus = async function(id, makeActive, name) {
  const action = makeActive ? 'activate' : 'deactivate';
  const confirmed = await UI.confirm(`${makeActive ? 'Activate' : 'Deactivate'} ${name}?`);
  if (!confirmed) return;
  const res = await API.patch(`/company-entities/${id}/status`, { is_active: makeActive });
  if (res?.error) { UI.toast(res.error, 'error'); return; }
  UI.toast(`${name} ${action}d`);
  APP.renderAccountSetup();
};

// ── AI SETTINGS (Principal-only) ────────────────────────────────────────────
APP.renderAISettings = async function() {
  const el = UI.contentEl();
  UI.loading(el);

  const data = await API.get('/ai-settings');
  if (!data?.features) { el.innerHTML = UI.empty('', 'Could not load AI settings'); return; }

  const keySet = data.api_key_set;
  const keyBanner = keySet
    ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#EDF7EE;border:1px solid #B2DFBC;border-radius:var(--r);margin-bottom:16px;font-size:12px;color:#2E7D32">
        <span>●</span> Anthropic API key configured — all AI features active
       </div>`
    : `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#FFF3E0;border:1px solid #FFCC80;border-radius:var(--r);margin-bottom:16px;font-size:12px;color:#E65100">
        <span>⚠</span> Anthropic API key not set on server — AI features will show fallback messages. Set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> to activate.
       </div>`;

  let html = keyBanner;
  html += '<div class="sec-label">Phase 1 — Always Active</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">These run automatically on relevant actions. When AI is unavailable they show an alert and let work continue — nothing is blocked.</div>';
  const phase1 = [
    'BOQ → Vendor Mapping', 'Schedule Look-Ahead Plan', 'Weekly Report Drag Analysis',
    'Payment Anomaly Narrative', 'Vendor Upload Validation', 'Project Date Sanity Check',
    'Lessons Learned Draft', 'Drawing Title Block Extraction', 'CN Text Drafting', 'Invoice Scan → Pre-fill',
  ];
  html += `<div class="card" style="margin-bottom:16px;padding:12px 16px">`;
  phase1.forEach((name, i) => {
    html += `<div style="font-size:12px;color:var(--text);padding:4px 0${i < phase1.length - 1 ? ';border-bottom:1px solid var(--border)' : ''}">
      <span style="color:${keySet ? '#2E7D32' : 'var(--muted)'}">●</span> ${UI.escapeText(name)}
    </div>`;
  });
  html += '</div>';

  html += '<div class="sec-label">Phase 2 — Toggle-Gated</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Off by default. Enable individually. Background checks — upload/save actions complete immediately regardless of AI result.</div>';

  data.features.forEach(f => {
    const checked = f.enabled ? 'checked' : '';
    const disabledAttr = keySet ? '' : 'disabled title="Set ANTHROPIC_API_KEY first"';
    html += `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${UI.escapeText(f.label)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${UI.escapeText(f.description || '')}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" ${checked} ${disabledAttr} onchange="APP.toggleAIFeature('${f.feature_key}', this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.toggleAIFeature = async function(key, enabled) {
  const res = await API.call('PATCH', '/ai-settings/' + key, { enabled });
  if (res?.success) {
    // Update local cache immediately
    if (!APP.state.aiToggles) APP.state.aiToggles = {};
    if (enabled) APP.state.aiToggles[key] = true;
    else delete APP.state.aiToggles[key];
    UI.toast(enabled ? 'Enabled' : 'Disabled');
  } else {
    UI.toast(res?.error || 'Failed to update');
    APP.renderAISettings(); // revert UI
  }
};

// ── GOVERNANCE ──────────────────────────────────────────────────────────────
// the current state of permissions, workflows, and notification triggers.
// All data served from DB tables populated by the 8 governance sheets.

APP.renderGovernance = async function() {
  const el = UI.contentEl();
  UI.loading(el);

  // Load status from DB — 10s timeout guard against hung DB queries
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 10000));
  const status = await Promise.race([
    API.get('/governance/status').catch(() => null),
    timeout,
  ]);
  if (!status) {
    el.innerHTML = UI.empty('', 'Governance status unavailable — the role_permissions table may be empty. Upload Sheet 1 to initialise.');
    return;
  }

  const perm = status.permissions;
  const wf   = status.workflows;
  const nt   = status.notifications;

  const sourceTag = perm.source === 'database'
    ? `<span class="badge b-green">DB-driven</span>`
    : `<span class="badge b-amber">Legacy hardcoded</span>`;

  const uploadCard = (type, label, icon, desc) => `
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:20px">${icon}</span>
        <div>
          <div class="card-title">${label}</div>
          <div class="card-meta">${desc}</div>
        </div>
      </div>
      <input type="file" accept=".xlsx" id="gov-file-${type}"
             style="display:none" onchange="APP.uploadGovernanceSheet('${type}', this)">
      <button class="btn btn-sm" onclick="document.getElementById('gov-file-${type}').click()">
        Upload updated sheet
      </button>
    </div>`;

  let recentHtml = '';
  if (status.recent_uploads?.length) {
    recentHtml = status.recent_uploads.map(u => `
      <div class="action-item">
        <div class="ai-body">
          <div class="ai-title">${u.sheet_type}</div>
          <div class="ai-meta">${u.rows_updated} updated · ${u.rows_added} added · ${new Date(u.uploaded_at).toLocaleDateString('en-IN')}</div>
        </div>
      </div>`).join('');
  } else {
    recentHtml = `<div style="color:var(--muted);font-size:13px;padding:12px 0">No uploads yet</div>`;
  }

  el.innerHTML = `<div class="fade-in">
    <div class="sec-label">Governance — Permission Architecture</div>

    <div class="stat-row" style="margin-bottom:16px">
      <div class="card" style="text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--navy)">${perm.db_rows || perm.rules}</div>
        <div style="font-size:11px;color:var(--muted)">Permission rules</div>
        <div style="margin-top:4px">${sourceTag}</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--navy)">${wf.db_rows}</div>
        <div style="font-size:11px;color:var(--muted)">Workflow transitions</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--navy)">${nt.db_rows}</div>
        <div style="font-size:11px;color:var(--muted)">Notification triggers</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:4px">
      <button class="btn btn-sm" onclick="APP.viewGovernancePermissions()">View permissions</button>
      <button class="btn btn-sm" onclick="APP.viewGovernanceWorkflows()">View workflows</button>
      <button class="btn btn-sm" onclick="APP.reloadGovernancePermissions()">Force reload from DB</button>
    </div>

    <div class="sec-label" style="margin-top:20px">Upload governance sheets</div>
    <div style="color:var(--muted);font-size:12px;margin-bottom:12px">
      Edit the Excel sheet, save it, then upload here. Permissions reload automatically.
    </div>

    ${uploadCard('permissions',     'Sheet 1 — Role Permission Matrix',     '', '15 role tabs · W/R/A access per action')}
    ${uploadCard('workflows',       'Sheet 2 — Workflow Status Transitions', '', '9 object types · all state transitions')}
    ${uploadCard('notifications',   'Sheet 3 — Notification Trigger Map',   '', '50+ events · who gets notified for what')}
    ${uploadCard('slas',            'Sheet 4 — SLA & Escalation Table',     '', 'Days per item type before escalation')}
    ${uploadCard('visibility',      'Sheet 5 — Tab Visibility Map',         '', 'Which roles see which screens')}
    ${uploadCard('audit_events',    'Sheet 6 — Audit Event Registry',       '', 'Events that write to audit log')}
    ${uploadCard('sequences',       'Sheet 7 — Sequence Number Registry',   '', 'Prefix, table, and padding per entity')}
    ${uploadCard('open_gaps',       'Sheet 8 — Open Permission Gaps',       '', 'Scanner-flagged ungated routes')}

    <div class="sec-label" style="margin-top:20px">Recent uploads</div>
    ${recentHtml}
  </div>`;
};

APP.uploadGovernanceSheet = async function(sheetType, input) {
  const file = input.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append('sheet', file);
  fd.append('sheet_type', sheetType);

  UI.toast('Uploading…');
  try {
    const data = await API.call('POST', '/governance/upload', fd, true);
    if (data?.error) {
      UI.toast('Upload failed: ' + data.error, 'error');
      return;
    }
    if (!data || (data.rows_added === undefined && data.rows_updated === undefined)) {
      UI.toast('Upload failed', 'error');
      return;
    }
    const msg = `✓ ${data.rows_added} added · ${data.rows_updated} updated`;
    UI.toast(msg);
    if (data.permissions_reloaded) {
      UI.toast('Permissions reloaded from DB');
    }
    APP.renderGovernance();
  } catch (err) {
    UI.toast('Upload error: ' + err.message, 'error');
  }
  input.value = '';
};

APP.reloadGovernancePermissions = async function() {
  const res = await API.post('/governance/reload', {});
  if (res?.success) {
    UI.toast(`Permissions reloaded — ${res.rules} rules from DB`);
    APP.renderGovernance();
  }
};

// ── ERROR LOG (Principal-only) ──────────────────────────────────────────
// Surfaces dead routes and other failed API calls captured by the API
// wrapper. Group by (method, path) so a broken button doesn't fill the
// screen with one row per click.
APP.renderErrorsLog = async function() {
  const el = UI.contentEl();
  UI.loading(el);

  const [summary, list] = await Promise.all([
    API.get('/client-errors/summary'),
    API.get('/client-errors?untriaged=1&limit=200'),
  ]);
  if (!summary || !list) { el.innerHTML = UI.empty('️','Could not load error log'); return; }

  const tile = (label, n, tone) => `
    <div class="card" style="text-align:center">
      <div style="font-size:28px;font-weight:700;color:var(--${tone||'navy'})">${n||0}</div>
      <div style="font-size:11px;color:var(--muted)">${label}</div>
    </div>`;

  let clusters = '';
  if (list.clusters?.length) {
    clusters = list.clusters.map(c => {
      const sample = c.samples[0];
      const status = sample?.http_status || 'NET';
      const tone = c.untriaged > 0 ? 'amber' : 'green';
      return `
        <div class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="min-width:0;flex:1">
              <div style="font-weight:600;font-size:13px;font-family:monospace;color:var(--navy)">
                ${UI.escapeText(c.key)}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">
                ${c.count} hits · ${c.untriaged} untriaged · last ${new Date(c.latest).toLocaleString('en-IN')}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">
                Status ${status} · code ${UI.escapeText(sample?.error_code || '—')}
              </div>
              ${sample?.user_full_name ? `<div style="font-size:11px;color:var(--muted)">Last: ${UI.escapeText(sample.user_full_name)} (${UI.escapeText(sample.user_role||'')})</div>` : ''}
            </div>
            <div>
              <span class="badge b-${tone}" style="margin-bottom:6px;display:block">${c.untriaged}</span>
              ${c.untriaged > 0 ? `<button class="btn-sm" onclick="APP._triageErrorCluster('${UI.escapeAttr(c.key)}')">Triage</button>` : ''}
            </div>
          </div>
          ${sample?.response_excerpt ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">Sample response</summary><pre style="font-size:10px;white-space:pre-wrap;background:var(--bg);padding:6px;border-radius:4px;margin-top:4px">${UI.escapeText(sample.response_excerpt)}</pre></details>` : ''}
        </div>`;
    }).join('');
  } else {
    clusters = `<div class="card"><div style="text-align:center;color:var(--muted);padding:20px">No untriaged errors. Clean.</div></div>`;
  }

  el.innerHTML = `<div class="fade-in">
    <div class="sec-label">Error Log</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
      Failed API calls captured from users' browsers. A cluster groups identical (method, path) pairs.
    </div>

    <div class="stat-row" style="margin-bottom:16px">
      ${tile('Total', summary.total)}
      ${tile('Untriaged', summary.untriaged, 'amber')}
      ${tile('Last 24h', summary.last_24h)}
      ${tile('Last 7d', summary.last_7d)}
    </div>

    <div class="sec-label" style="margin-top:18px">Untriaged clusters</div>
    ${clusters}
  </div>`;
};

// Triage a cluster — bulk mark-as-triaged matching method+path-prefix.
APP._triageErrorCluster = async function(clusterKey) {
  // clusterKey looks like "POST /api/issues/:id/snag-signoff"
  const space = clusterKey.indexOf(' ');
  if (space < 0) return UI.toast('Invalid cluster');
  const method = clusterKey.slice(0, space);
  // Convert ":id" segments back to wildcard for LIKE — DB stores literal paths
  // with concrete IDs. Simplest correct-enough approach: take the stable prefix
  // up to the first ":id" and use that as the LIKE prefix.
  const path = clusterKey.slice(space + 1);
  const colon = path.indexOf('/:');
  const prefix = colon >= 0 ? path.slice(0, colon + 1) : path;

  const note = prompt('Triage note (optional — what is the resolution?):', '');
  if (note === null) return;   // cancelled

  const res = await API.post('/client-errors/triage-pattern', {
    method, path_prefix: prefix, note: note || null,
  });
  if (res?.ok) {
    UI.toast(`✓ ${res.triaged} marked as triaged`);
    APP.renderErrorsLog();
  } else {
    UI.toast(res?.error || 'Triage failed');
  }
};

APP.viewGovernancePermissions = async function() {
  const data = await API.get('/governance/permissions');
  if (!data) return;
  const rows = data.permissions;
  // Group by action for readability
  const byAction = {};
  for (const r of rows) {
    if (!byAction[r.action]) byAction[r.action] = { group: r.group_name, label: r.label, roles: {} };
    byAction[r.action].roles[r.role] = r.level;
  }
  const html = Object.entries(byAction).slice(0, 30).map(([action, v]) => `
    <div style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="font-weight:600;font-size:12px;color:var(--navy)">${v.label}</div>
      <div style="font-size:10px;color:var(--muted);margin:2px 0">${action}</div>
      <div style="font-size:11px">${Object.entries(v.roles).map(([r,l])=>`${r}:${l}`).join(' · ')}</div>
    </div>`).join('');
  UI.openModal(`Permissions (first 30 of ${rows.length})`, `<div style="max-height:60vh;overflow-y:auto">${html}</div>`);
};

APP.viewGovernanceWorkflows = async function() {
  const data = await API.get('/governance/workflows');
  if (!data) return;
  const rows = data.transitions;
  const html = rows.map(r => `
    <div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <strong>${r.object_type}</strong> · ${r.from_state} → ${r.to_state}
      ${r.is_exception ? '<span class="badge b-amber">exception</span>' : ''}
      <div style="color:var(--muted);font-size:10px">${r.roles_who}</div>
    </div>`).join('');
  UI.openModal(`Workflow transitions (${rows.length})`, `<div style="max-height:60vh;overflow-y:auto">${html}</div>`);
};

APP.resetUserPassword = function(userId, fullName) {
  UI.openModal(`Reset password — ${fullName}`, `
    <p style="font-size:15px;color:var(--text2);margin-bottom:16px;line-height:1.5">
      This will generate a temporary password you can read to <b>${UI.escapeText(fullName)}</b> over the phone or in person.
      They will be forced to change it on their next login.
    </p>
    <p style="font-size:13px;color:var(--muted);margin-bottom:20px">
      No WhatsApp message or email will be sent automatically.
      You tell them the password directly.
    </p>
    <button class="btn-primary" style="width:100%" onclick="APP._doResetUserPassword(${userId})">Generate temporary password</button>
    <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="UI.closeModal()">Cancel</button>
  `);
};

APP._doResetUserPassword = async function(userId) {
  const res = await API.post(`/admin-reset/reset/${userId}`, {});
  if (!res?.success) { UI.toast(res?.error || 'Reset failed'); return; }

  // Show the temp password — caller reads it to the user.
  // Uses Apple-style memorable format: Word-NN-Word
  const pw = res.temp_password;
  UI.openModal(`Temporary password — ${res.full_name}`, `
    <p style="font-size:15px;color:var(--text2);margin-bottom:14px;line-height:1.5">
      Read this password to <b>${UI.escapeText(res.full_name)}</b> (username: <b>${UI.escapeText(res.username)}</b>).
      They must change it when they next log in.
    </p>
    <div class="temp-pw-display">
      <div class="temp-pw-word" id="tmp-pw-val">${UI.escapeText(pw)}</div>
      <div class="temp-pw-note">Tap to select · expires after first login</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn-secondary" style="flex:1" onclick="
        navigator.clipboard?.writeText('${pw}').then(()=>UI.toast('Copied ✓'))
      ">Copy</button>
      <button class="btn-primary" style="flex:1" id="send-wa-btn"
        onclick="APP.sendTempPasswordViaWA(${userId}, '${UI.escapeAttr(res.full_name)}')">
        Send via WhatsApp
      </button>
    </div>
    <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="UI.closeModal()">Done</button>
    <p style="font-size:13px;color:var(--muted);margin-top:12px;text-align:center">
      This password is not logged anywhere after you close this screen.
    </p>
  `);
};

APP.sendTempPasswordViaWA = async function(userId, fullName) {
  const btn = document.getElementById('send-wa-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const res = await API.post(`/admin-reset/send-wa/${userId}`, {});
  if (res?.success) {
    UI.toast(`Sent to ${fullName} on WhatsApp ✓`);
    if (btn) { btn.textContent = 'Sent ✓'; btn.style.background = 'var(--green)'; }
  } else {
    UI.toast(res?.error || 'WhatsApp send failed — read the password over phone instead');
    if (btn) { btn.disabled = false; btn.textContent = 'Send via WhatsApp'; }
  }
};
APP.bulkUploadUsers = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('users', file);
  UI.toast('Uploading users…');
  const res = await API.call('POST', '/users/bulk-upload', fd, true);
  if (res?.success) {
    UI.toast(`${res.added} users created ✓`);
    APP.renderUsers();
  } else {
    UI.toast(res?.error || 'Upload failed');
  }
};

// ── ADD USER (Principal) ────────────────────────────────────────────────────
APP.openAddUserModal = function() {
  const roles = [
    'principal','design_principal','pmc_head','design_head','services_head',
    'team_lead','jr_architect','jr_engineer','services_engineer',
    'coordinator','site_manager','senior_site_manager','finance_admin',
    'trainee','audit','it_admin'
  ];
  const roleOptions = roles.map(r =>
    `<option value="${r}">${APP._roleLabel(r)}</option>`
  ).join('');

  UI.openModal('Add New User', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="form-label">Full Name <span style="color:var(--red)">*</span></label>
        <input id="au-name" class="form-input" type="text" placeholder="e.g. Rahul Sharma" autocomplete="off">
      </div>
      <div>
        <label class="form-label">Username <span style="color:var(--red)">*</span></label>
        <input id="au-user" class="form-input" type="text" placeholder="e.g. rahul_s" autocomplete="off"
          oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9_.]/g,'')">
        <div style="font-size:11px;color:var(--muted);margin-top:3px">Lowercase letters, numbers, _ and . only — this is the login username</div>
      </div>
      <div>
        <label class="form-label">Role <span style="color:var(--red)">*</span></label>
        <select id="au-role" class="form-input">
          <option value="">Select role…</option>
          ${roleOptions}
        </select>
      </div>
      <div>
        <label class="form-label">Stream</label>
        <select id="au-stream" class="form-input">
          <option value="all">All</option>
          <option value="design">Design</option>
          <option value="services">Services</option>
          <option value="pmc">PMC</option>
          <option value="site">Site</option>
        </select>
      </div>
      <div>
        <label class="form-label">Phone <span style="font-size:11px;color:var(--muted);font-weight:400">(optional — temp password sent via WhatsApp if provided)</span></label>
        <input id="au-phone" class="form-input" type="tel" placeholder="10-digit Indian mobile number">
      </div>
      <div>
        <label class="form-label">Email <span style="font-size:11px;color:var(--muted);font-weight:400">(optional)</span></label>
        <input id="au-email" class="form-input" type="email" placeholder="e.g. rahul@nuassociates.in">
      </div>
      <div id="au-error" style="display:none;color:var(--red);font-size:13px;padding:8px;background:var(--red-bg,#fff0f0);border-radius:6px"></div>
      <button class="btn-primary" style="width:100%;margin-top:4px" id="au-submit-btn" onclick="APP.submitAddUser()">Create User</button>
      <button class="btn-secondary" style="width:100%" onclick="UI.closeModal()">Cancel</button>
    </div>
  `);
};

APP.submitAddUser = async function() {
  const name   = document.getElementById('au-name')?.value.trim();
  const user   = document.getElementById('au-user')?.value.trim();
  const role   = document.getElementById('au-role')?.value;
  const stream = document.getElementById('au-stream')?.value || 'all';
  const phone  = document.getElementById('au-phone')?.value.trim();
  const email  = document.getElementById('au-email')?.value.trim();
  const errEl  = document.getElementById('au-error');
  const btn    = document.getElementById('au-submit-btn');

  const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
  if (errEl) errEl.style.display = 'none';

  if (!name)  return showErr('Full Name is required.');
  if (!user)  return showErr('Username is required.');
  if (!role)  return showErr('Please select a role.');

  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

  const body = { full_name: name, username: user, role, stream };
  if (phone) body.phone = phone;
  if (email) body.email = email;

  const res = await API.post('/users?reveal_password=1', body);

  if (btn) { btn.disabled = false; btn.textContent = 'Create User'; }

  if (!res?.success) {
    showErr(res?.error || (res?.fields ? res.fields.join('; ') : 'Failed to create user'));
    return;
  }

  // Refresh the users list in the background
  APP.renderUsers();

  // Show outcome — password sent via WhatsApp or show temp password once
  if (res.temp_password) {
    const pw = res.temp_password;
    UI.openModal(`User Created — ${UI.escapeText(name)}`, `
      <p style="font-size:15px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        <b>${UI.escapeText(name)}</b> has been created with username <b>${UI.escapeText(user)}</b>.
        Read this temporary password to them — they must change it on first login.
      </p>
      <div class="temp-pw-display">
        <div class="temp-pw-word" id="tmp-pw-val">${UI.escapeText(pw)}</div>
        <div class="temp-pw-note">Tap to select · expires after first login</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-secondary" style="flex:1" onclick="
          navigator.clipboard?.writeText('${pw}').then(()=>UI.toast('Copied ✓'))
        ">Copy</button>
      </div>
      <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="UI.closeModal()">Done</button>
      <p style="font-size:13px;color:var(--muted);margin-top:12px;text-align:center">
        This password is not stored — record it now.
      </p>
    `);
  } else {
    UI.openModal(`User Created — ${UI.escapeText(name)}`, `
      <p style="font-size:15px;color:var(--text2);margin-bottom:14px;line-height:1.5">
        <b>${UI.escapeText(name)}</b> has been created with username <b>${UI.escapeText(user)}</b>.
      </p>
      <p style="font-size:14px;color:var(--text2);line-height:1.5">${UI.escapeText(res.message || 'User created.')}</p>
      <button class="btn-primary" style="width:100%;margin-top:16px" onclick="UI.closeModal()">Done</button>
    `);
  }
};

APP.approveUser = async function(id) {
  const res = await API.post(`/user-management/${id}/approve`, {});
  if (res?.success) { UI.toast('User approved ✓'); APP.renderUsers(); }
};
APP.rejectUser = async function(id) {
  const res = await API.post(`/user-management/${id}/reject`, {});
  if (res?.success) { UI.toast('Rejected'); APP.renderUsers(); }
};

// ═══ CLIENTS MASTER ═══

// Migrated to Alpine component in public/js/components/clients.js (v3)
APP.renderClients = async function() {
  if (window.Components?.mount && window.Alpine) {
    const mountFn = Components.mount('content-area', 'clients');
    return mountFn();
  }
  return APP._renderClientsLegacy();
};

APP._renderClientsLegacy = async function() {
  const el = UI.contentEl();
  el.innerHTML = UI.empty('','Loading clients…');

  const [allRes, incompleteRes] = await Promise.all([
    API.call('GET', '/clients'),
    API.call('GET', '/clients/incomplete'),
  ]);

  if (!allRes || allRes.error) {
    el.innerHTML = UI.empty('', allRes?.error || 'Access denied');
    return;
  }

  const incomplete = incompleteRes?.clients || [];
  const all        = allRes.clients || [];
  const complete   = all.filter(c => c.master_complete === 1);

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="sec-label" style="margin:0">Client Master</div>
      <button class="btn-primary" onclick="APP.showNewClient()">+ New Client</button>
    </div>`;

  if (incomplete.length) {
    html += `<div class="sec-label" style="color:#C8A040;margin-top:14px">⚠ Pending Completion (${incomplete.length})</div>`;
    html += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">
      These were auto-created when a project was added. Complete master data (GSTIN, Tally ledger, payment terms) before first PI.</div>`;
    incomplete.forEach(c => {
      html += `
        <div class="card" style="border-left:3px solid #C8A040;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:600">${c.client_name}</div>
              <div style="font-size:11px;color:var(--muted)">
                Projects: ${c.project_codes || '—'} ·
                Added by ${c.created_by_name || '—'} on ${c.created_at?.split('T')[0] || ''}
              </div>
              ${c.stub_reason ? `<div style="font-size:11px;color:var(--muted);font-style:italic">${c.stub_reason}</div>` : ''}
            </div>
            <button class="btn-sm gold" onclick="APP.showCompleteClient(${c.id},'${UI.escapeAttr(c.client_name||'')}')">Complete →</button>
          </div>
        </div>`;
    });
  }

  html += `<div class="sec-label" style="margin-top:18px">All Clients (${complete.length})</div>`;
  if (!complete.length) {
    html += UI.empty('','No clients in master yet');
  } else {
    complete.forEach(c => {
      html += `
        <button class="card" style="min-height:44px;margin-bottom:6px;cursor:pointer" onclick="APP.showEditClient(${c.id})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600">${c.client_name}</div>
              <div style="font-size:11px;color:var(--muted)">
                GSTIN: ${c.gstin} · ${c.state_name || ''} · Terms: ${c.payment_terms_days}d
              </div>
            </div>
            <span class="badge b-green">✓</span>
          </div>
        </button>`;
    });
  }

  el.innerHTML = html;
};

// ── Modal: complete stub client (pre-fills name)
APP.showCompleteClient = function(id, name) {
  UI.openModal(`Complete Client: ${name}`, `
    <div class="field-row"><label class="field-label" for="cc-name">Client Name</label>
      <input type="text" id="cc-name" value="${name}"></div>
    <div class="field-row"><label class="field-label" for="cc-gstin">GSTIN *</label>
      <input type="text" id="cc-gstin" placeholder="15-char GSTIN, e.g. 29ABCDE1234F1Z5" maxlength="15"></div>
    <div class="field-row"><label class="field-label" for="cc-pan">PAN</label>
      <input type="text" id="cc-pan" placeholder="10-char PAN" maxlength="10"></div>
    <div class="field-row"><label class="field-label" for="cc-state">State Name</label>
      <input type="text" id="cc-state" placeholder="Auto-derived from GSTIN if blank"></div>
    <div class="field-row"><label class="field-label" for="cc-tally">Tally Party Ledger</label>
      <input type="text" id="cc-tally" placeholder="Defaults to client name"></div>
    <div class="field-row"><label class="field-label" for="cc-terms">Payment Terms (days)</label>
      <input type="number" id="cc-terms" value="30" min="1" max="365"></div>
    <div class="field-row"><label class="field-label" for="cc-cp">Contact Person</label>
      <input type="text" id="cc-cp"></div>
    <div class="field-row"><label class="field-label" for="cc-phone">Contact Phone</label>
      <input type="text" id="cc-phone" placeholder="With country code e.g. 919876543210"></div>
    <div class="field-row"><label class="field-label" for="cc-email">Contact Email</label>
      <input type="email" id="cc-email"></div>
    <div class="field-row"><label class="field-label" for="cc-address">Registered Address</label>
      <textarea id="cc-address" rows="2"></textarea></div>
    <button class="btn-primary" onclick="APP.submitCompleteClient(${id})">Save & Mark Complete</button>
  `);
};

APP.submitCompleteClient = async function(id) {
  const body = {
    client_name:        document.getElementById('cc-name').value.trim(),
    gstin:              document.getElementById('cc-gstin').value.trim().toUpperCase(),
    pan:                document.getElementById('cc-pan').value.trim().toUpperCase() || null,
    state_name:         document.getElementById('cc-state').value.trim() || null,
    tally_party_ledger: document.getElementById('cc-tally').value.trim() || null,
    payment_terms_days: parseInt(document.getElementById('cc-terms').value) || 30,
    contact_person:     document.getElementById('cc-cp').value.trim() || null,
    contact_phone:      document.getElementById('cc-phone').value.trim() || null,
    contact_email:      document.getElementById('cc-email').value.trim() || null,
    registered_address: document.getElementById('cc-address').value.trim() || null,
  };
  if (!body.client_name || !body.gstin) { UI.toast('Name and GSTIN required'); return; }
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/.test(body.gstin)) {
    UI.toast('GSTIN format invalid'); return;
  }
  const res = await API.call('PATCH', `/clients/${id}/complete`, body);
  if (res?.success) {
    UI.closeModal();
    UI.toast('Client master completed ✓');
    APP.renderClients();
  } else {
    UI.toast(res?.error || 'Failed');
  }
};

// ── Modal: proactively add a new client (master-complete from the start)
APP.bulkUploadClients = async function(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  const fd = new FormData();
  fd.append('clients', file);
  UI.toast('Uploading clients…');
  const res = await API.call('POST', '/clients/bulk-upload', fd, true);
  if (res?.success) {
    let summary = `<p style="font-size:13px">Added <strong>${res.added || 0}</strong> &middot; Skipped <strong>${res.skipped || 0}</strong></p>`;
    if (Array.isArray(res.errors) && res.errors.length) {
      summary += `<div class="sec-label" style="color:#C87060;margin-top:8px">Rows needing attention (${res.errors.length})</div>`;
      res.errors.forEach(e => { summary += `<div style="padding:6px;border-left:3px solid #C87060;background:var(--bg);margin-bottom:4px;font-size:12px">${UI.escapeText(String(e))}</div>`; });
    }
    summary += `<p style="font-size:11px;color:var(--muted);margin-top:10px">GSTIN is required (15 chars); state is auto-derived. Duplicates are skipped.</p>`;
    UI.openModal('Bulk Upload Result', summary);
    APP.renderClients();
  } else {
    UI.toast(res?.error || 'Bulk upload failed');
  }
};

APP.showNewClient = function() {
  UI.openModal('New Client', `
    <div class="field-row"><label class="field-label" for="nc-name">Client Name *</label>
      <input type="text" id="nc-name" placeholder="Full legal name"></div>
    <div class="field-row"><label class="field-label" for="nc-gstin">GSTIN *</label>
      <input type="text" id="nc-gstin" placeholder="15-char GSTIN" maxlength="15"></div>
    <div class="field-row"><label class="field-label" for="nc-pan">PAN</label>
      <input type="text" id="nc-pan" placeholder="10-char PAN" maxlength="10"></div>
    <div class="field-row"><label class="field-label" for="nc-state">State Name *</label>
      <input type="text" id="nc-state" placeholder="e.g. Karnataka"></div>
    <div class="field-row"><label class="field-label" for="nc-stcode">State Code *</label>
      <input type="number" id="nc-stcode" placeholder="e.g. 29" min="1" max="38"></div>
    <div class="field-row"><label class="field-label" for="nc-tally">Tally Party Ledger</label>
      <input type="text" id="nc-tally"></div>
    <div class="field-row"><label class="field-label" for="nc-terms">Payment Terms (days)</label>
      <input type="number" id="nc-terms" value="30" min="1" max="365"></div>
    <div class="field-row"><label class="field-label" for="nc-cp">Contact Person</label>
      <input type="text" id="nc-cp"></div>
    <div class="field-row"><label class="field-label" for="nc-phone">Contact Phone</label>
      <input type="text" id="nc-phone"></div>
    <div class="field-row"><label class="field-label" for="nc-email">Contact Email</label>
      <input type="email" id="nc-email"></div>
    <button class="btn-primary" onclick="APP.submitNewClient()">Create Client</button>
  `);
};

APP.submitNewClient = async function() {
  const body = {
    client_name:        document.getElementById('nc-name').value.trim(),
    gstin:              document.getElementById('nc-gstin').value.trim().toUpperCase(),
    pan:                document.getElementById('nc-pan').value.trim().toUpperCase() || null,
    state_name:         document.getElementById('nc-state').value.trim(),
    state_code:         parseInt(document.getElementById('nc-stcode').value) || null,
    tally_party_ledger: document.getElementById('nc-tally').value.trim() || null,
    payment_terms_days: parseInt(document.getElementById('nc-terms').value) || 30,
    contact_person:     document.getElementById('nc-cp').value.trim() || null,
    contact_phone:      document.getElementById('nc-phone').value.trim() || null,
    contact_email:      document.getElementById('nc-email').value.trim() || null,
  };
  if (!body.client_name || !body.gstin || !body.state_name || !body.state_code) {
    UI.toast('Name, GSTIN, State required'); return;
  }
  const res = await API.call('POST', '/clients', body);
  if (res?.id) {
    UI.closeModal();
    UI.toast('Client created ✓');
    APP.renderClients();
  } else {
    UI.toast(res?.error || 'Failed');
  }
};

// Edit an existing client master — finance + principals only (backend gates via can())
APP.showEditClient = async function(id) {
  const res = await API.call('GET', '/clients');
  const client = (res?.clients || []).find(c => c.id === id);
  if (!client) { UI.toast('Client not found'); return; }

  UI.openModal(`Edit: ${client.client_name}`, `
    <div class="field-row"><label class="field-label" for="ec-display">Display Name</label>
      <input type="text" id="ec-display" value="${UI.escapeAttr(client.display_name || '')}"></div>
    <div class="field-row"><label class="field-label" for="ec-prefix">Invoice Prefix</label>
      <input type="text" id="ec-prefix" value="${UI.escapeAttr(client.invoice_prefix || '')}" placeholder="e.g. WESCH"></div>
    <div class="field-row"><label class="field-label" for="ec-terms">Payment Terms (days)</label>
      <input type="number" id="ec-terms" value="${client.payment_terms_days || 30}" min="1" max="365"></div>
    <div class="field-row"><label class="field-label" for="ec-tally-p">Tally Party Ledger</label>
      <input type="text" id="ec-tally-p" value="${UI.escapeAttr(client.tally_party_ledger || '')}"></div>
    <div class="field-row"><label class="field-label" for="ec-tally-i">Tally Income Ledger</label>
      <input type="text" id="ec-tally-i" value="${UI.escapeAttr(client.tally_income_ledger || '')}"></div>
    <div class="field-row"><label class="field-label" for="ec-address">Registered Address</label>
      <textarea id="ec-address" rows="3">${UI.escapeText(client.registered_address || '')}</textarea></div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px">
      GSTIN, PAN, and state are locked after creation — raise a new client stub if these change.
    </div>
    <button class="btn-primary" onclick="APP.submitEditClient(${id})">Save changes</button>
  `);
};

APP.submitEditClient = async function(id) {
  const body = {
    display_name:        document.getElementById('ec-display').value.trim() || null,
    invoice_prefix:      document.getElementById('ec-prefix').value.trim() || null,
    payment_terms_days:  parseInt(document.getElementById('ec-terms').value) || 30,
    tally_party_ledger:  document.getElementById('ec-tally-p').value.trim() || null,
    tally_income_ledger: document.getElementById('ec-tally-i').value.trim() || null,
    registered_address:  document.getElementById('ec-address').value.trim() || null,
  };
  const res = await API.call('PATCH', `/clients/${id}`, body);
  if (res?.success) { UI.closeModal(); UI.toast('Client updated ✓'); APP.renderClients(); }
  else UI.toast(res?.error || 'Failed');
};

// ── CLOSE MODAL HELPER (ensure exists)
// ── VENDOR PICKER — trade-filtered searchable dropdown
APP.showVendorPicker = function(onSelect, trade) {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-title">Select Vendor <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div class="field-row">
      <label class="field-label" for="vp-trade">Trade</label>
      <select id="vp-trade" onchange="APP.loadVendorList()" >
        <option value="">All trades</option>
        ${['Civil','Structural','Electrical','HVAC','Plumbing','Facade','Finishes','Landscaping','Furniture','Other']
          .map(t => '<option value="'+t+'"'+(t===trade?' selected':'')+'>'+t+'</option>').join('')}
      </select>
    </div>
    <div class="field-row">
      <input type="text" id="vp-search" placeholder="Search vendor name…" oninput="APP._debouncedVendorSearch()">
    </div>
    <div id="vp-list" style="max-height:300px;overflow-y:auto;margin-top:8px"></div>`;
  APP._vendorPickerCallback = onSelect;
  APP.loadVendorList();
};

APP._debouncedVendorSearch = function() {
  clearTimeout(APP._vendorSearchTimer);
  APP._vendorSearchTimer = setTimeout(() => APP.loadVendorList(), 250);
};

APP.loadVendorList = async function() {
  const trade = document.getElementById('vp-trade')?.value;
  const q     = document.getElementById('vp-search')?.value;
  const list  = document.getElementById('vp-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">Loading…</div>';

  const params = new URLSearchParams();
  if (trade) params.set('trade', trade);
  if (q)     params.set('q', q);
  const data = await API.get('/vendors/master/search?' + params.toString());
  const vendors = data?.vendors || [];

  if (!vendors.length) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">No vendors found</div>';
    return;
  }

  list.innerHTML = vendors.map(v => `
    <button onclick="APP._selectVendor(${JSON.stringify(v).replace(/"/g,'&quot;')})"
      style="min-height:44px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r);
             margin-bottom:6px;cursor:pointer;background:var(--white);transition:background .12s;width:100%;text-align:left;"
      onmouseover="this.style.background='var(--bg)'"
      onmouseout="this.style.background='var(--white)'">
      <div style="font-size:13px;font-weight:600;color:var(--text)">\${v.vendor_name}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">\${v.trade} · \${v.contact_person||'—'}</div>
      \${v.bank_account ? \`<div style="font-family:var(--mono);font-size:10px;color:var(--steel);margin-top:2px">\${v.bank_ifsc}</div>\` : ''}
    </div>`).join('');
};

APP._selectVendor = function(vendor) {
  APP.closeModal();
  if (APP._vendorPickerCallback) APP._vendorPickerCallback(vendor);
};

// ── FUZZY DUPLICATE CHECK — call before creating vendor/client
APP.checkVendorDuplicate = async function(name, trade) {
  if (!name || name.length < 3) return null;
  const params = new URLSearchParams({ name, ...(trade?{trade}:{}) });
  const res = await API.get('/vendors/master/check?' + params.toString());
  if (res?.isDuplicate) {
    const s = res.suggestions[0];
    return confirm('Similar vendor found: "' + s.vendor_name + '" (' + Math.round(s.similarity*100) + '% match).\n\nClick OK to use existing vendor, Cancel to create new.')
      ? s : null; // returns existing vendor if OK, null if create new
  }
  return null; // no duplicate
};

APP.checkClientDuplicate = async function(name) {
  if (!name || name.length < 3) return null;
  const res = await API.get('/clients/check?name=' + encodeURIComponent(name));
  if (res?.isDuplicate) {
    const s = res.suggestions[0];
    return confirm('Similar client found: "' + s.client_name + '" (' + Math.round(s.similarity*100) + '% match).\n\nClick OK to use existing, Cancel to create new.')
      ? s : null;
  }
  return null;
};

APP.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
};

// ═══════════════════════════════════════════════════
// ADDITIONAL SCREENS — NOTIFICATIONS, NCR, SUBMITTALS,
// DEPUTY, WEEKLY HEALTH, SCHEDULE COMPLIANCE,
// PROJECT DETAIL, CLIENT RECEIPTS, TALLY EXPORT
// ═══════════════════════════════════════════════════

// ── NOTIFICATIONS INBOX
// Migrated to Alpine component in public/js/components/notifications.js (v3)
APP.renderNotifications = async function() {
  if (window.Components?.mount && window.Alpine) {
    const mountFn = Components.mount('content-area', 'notifications');
    return mountFn();
  }
  return APP._renderNotificationsLegacy();
};

APP._renderNotificationsLegacy = async function() {
  const el = UI.contentEl();
  const data = await API.get('/notifications/log');
  if (!data) return;
  const msgs = data.notifications || [];

  const unreadCount = msgs.filter(m => !m.read_at).length;

  let html = '';

  // Mark all read button — B8
  if (unreadCount > 0) {
    html += `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn-secondary" style="font-size:13px;padding:8px 14px"
        onclick="APP._markAllNotifsRead()">Mark all read (${unreadCount})</button>
    </div>`;
  }

  if (!msgs.length) {
    html += UI.empty('', 'No notifications yet');
  } else {
    const today = APP.state.serverToday || UI.todayIST();
    const todayMsgs = msgs.filter(m => (m.sent_at||'').startsWith(today));
    const older     = msgs.filter(m => !(m.sent_at||'').startsWith(today));

    if (todayMsgs.length) {
      html += '<div class="sec-label">Today</div>';
      todayMsgs.forEach(m => { html += APP._notifCard(m); });
    }
    if (older.length) {
      html += '<div class="sec-label">Earlier</div>';
      older.slice(0,20).forEach(m => { html += APP._notifCard(m); });
    }
  }

  // Hide the red dot
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = 'none';
  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP._notifCard = function(m) {
  // B1: SVG icons per type — no emoji, unique per type
  const TYPE_ICON = {
    morning_priorities:     `<svg viewBox="0 0 24 24" style="stroke:var(--amber)"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`,
    evening_digest:         `<svg viewBox="0 0 24 24" style="stroke:var(--navy)"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>`,
    morning_site_prep:      `<svg viewBox="0 0 24 24" style="stroke:var(--steel)"><path d="M2 22L12 2l10 20H2z"/><line x1="12" y1="10" x2="12" y2="14"/></svg>`,
    evening_close:          `<svg viewBox="0 0 24 24" style="stroke:var(--green)"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
    report_anomaly:         `<svg viewBox="0 0 24 24" style="stroke:var(--red)"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    budget_flag:            `<svg viewBox="0 0 24 24" style="stroke:var(--amber)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    budget_escalation:      `<svg viewBox="0 0 24 24" style="stroke:var(--red)"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
    task_outlier:           `<svg viewBox="0 0 24 24" style="stroke:var(--steel)"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
    drawing_query:          `<svg viewBox="0 0 24 24" style="stroke:var(--navy)"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
    grn_pending:            `<svg viewBox="0 0 24 24" style="stroke:var(--amber)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    issue_raised:           `<svg viewBox="0 0 24 24" style="stroke:var(--red)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    urgent_payment:         `<svg viewBox="0 0 24 24" style="stroke:var(--red)"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    utr_consolidated:       `<svg viewBox="0 0 24 24" style="stroke:var(--green)"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    weekly_digest:          `<svg viewBox="0 0 24 24" style="stroke:var(--navy)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    saturday_payment_digest:`<svg viewBox="0 0 24 24" style="stroke:var(--navy)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
  };

  // B4: Human-readable type labels — no raw type strings shown to user
  const TYPE_LABEL = {
    morning_priorities:     'Morning priorities',
    evening_digest:         'Evening digest',
    morning_site_prep:      'Site prep briefing',
    evening_close:          'Day close',
    report_anomaly:         'Report anomaly',
    budget_flag:            'Budget flag',
    budget_escalation:      'Budget alert',
    task_outlier:           'Task alert',
    drawing_query:          'Drawing query',
    grn_pending:            'GRN pending',
    issue_raised:           'Issue raised',
    urgent_payment:         'Payment alert',
    utr_consolidated:       'Payment confirmed',
    weekly_digest:          'Weekly digest',
    saturday_payment_digest:'Payment summary',
  };

  // Deep-link map: tap notification → navigate to relevant tab  B7
  const TYPE_TAB = {
    report_anomaly: 'reports_weekly', grn_pending: 'grn', issue_raised: 'issues',
    urgent_payment: 'payments', drawing_query: 'drawings', task_outlier: 'tasks',
    budget_flag: 'budget', budget_escalation: 'budget',
  };

  const iconSvg  = TYPE_ICON[m.message_type]  || `<svg viewBox="0 0 24 24" style="stroke:var(--muted)"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`;
  const label    = TYPE_LABEL[m.message_type] || (m.message_type||'').replace(/_/g,' ');
  const deepTab  = TYPE_TAB[m.message_type];
  const isUnread = !m.read_at;

  // B3: Word-boundary truncation — no mid-word cuts
  const raw  = (m.message_body || '').trim();
  const body = raw.length > 120
    ? raw.substring(0, 120).replace(/\s+\S*$/, '') + '…'
    : raw;

  // B5: Left border = shape + colour indicator for unread, not colour alone
  const borderStyle = isUnread
    ? 'border-left:3px solid var(--navy);'
    : 'border-left:3px solid transparent;';

  const tapHandler = deepTab
    ? `onclick="APP.switchTab('${deepTab}');APP._markNotifRead(${m.id})"
       style="cursor:pointer;${borderStyle}opacity:${isUnread?1:.7}"`
    : `onclick="APP._markNotifRead(${m.id})"
       style="cursor:pointer;${borderStyle}opacity:${isUnread?1:.7}"`;

  // B2: message body at 15px (ai-title), meta at 13px (ai-meta)
  return `<div class="action-item" ${tapHandler}>
    <div class="ai-icon" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px">
      <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke-width:1.8;fill:none;${iconSvg.match(/style="([^"]+)"/)?.[1]||'stroke:var(--muted)'}">
        ${iconSvg.replace(/<svg[^>]*>/,'').replace('</svg>','')}
      </svg>
    </div>
    <div class="ai-body">
      <div class="ai-title" style="font-size:15px;white-space:normal;line-height:1.4">${UI.escapeText(body)}</div>
      <div class="ai-meta">${UI.fmtDate((m.sent_at||'').split('T')[0])} · ${UI.escapeText(label)}</div>
    </div>
    ${isUnread ? '<span class="badge b-navy" style="flex-shrink:0">New</span>' : ''}
  </div>`;
};

APP._markNotifRead = async function(id) {
  if (!id) return;
  await API.post(`/notifications/${id}/read`, {}).catch(() => {});
};

APP._markAllNotifsRead = async function() {
  await API.post('/notifications/read-all', {}).catch(() => {});
  APP.renderNotifications();
};

// ── NCR — Non-Conformance Reports
APP.renderNCR = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/issues/ncr/${pid}`);
  if (!data) return;
  const ncrs = data.ncrs || [];

  const role = APP.user.role;
  const canRaise = ['pmc_head','principal','design_principal','site_manager','senior_site_manager'].includes(role);
  const canResolve = ['pmc_head','site_manager','senior_site_manager'].includes(role);

  let html = APP._projectSelectHtml('APP.renderNCR()');
  if (canRaise) {
    html += `<button class="btn-primary" onclick="APP.showNCRForm()" style="margin-bottom:16px">+ Raise NCR</button>`;
  }

  const open = ncrs.filter(n => !n.resolved_at);
  const resolved = ncrs.filter(n => n.resolved_at);

  if (open.length) {
    html += `<div class="sec-label">Open NCRs (${open.length})</div>`;
    open.forEach(n => {
      html += `<div class="card" style="border-left:3px solid var(--red)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="font-family:var(--mono);font-size:11px;font-weight:500;color:var(--navy)">${n.ncr_number||'NCR-'+n.id}</div>
            <div class="card-title">${n.description||'—'}</div>
            <div class="card-meta">${n.vendor_name||'Internal'} · ${UI.fmtDate(n.created_at)}</div>
          </div>
          <span class="badge b-red">Open</span>
        </div>
        ${!n.vendor_acknowledged ? '<div class="card-meta" style="margin-top:6px;color:var(--amber)">⏳ Awaiting vendor acknowledgement</div>' : ''}
        ${canResolve ? `<button class="btn-sm approve" style="width:100%;margin-top:8px" onclick="APP.showResolveNCR(${n.id})">✓ Mark Resolved</button>` : ''}
      </div>`;
    });
  }

  if (resolved.length) {
    html += `<div class="sec-label">Resolved (${resolved.length})</div>`;
    resolved.slice(0,5).forEach(n => {
      html += `<div class="card" style="opacity:.65">
        <div style="font-family:var(--mono);font-size:11px;color:var(--navy)">${n.ncr_number||'NCR-'+n.id}</div>
        <div class="card-title">${n.description||'—'}</div>
        <div class="card-meta">Resolved ${UI.fmtDate(n.resolved_at)}</div>
      </div>`;
    });
  }

  if (!ncrs.length) html = UI.empty('','No NCRs raised');
  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showResolveNCR = function(ncrId) {
  UI.showModal('Resolve NCR', `
    <div class="field"><label>Resolution Note</label><textarea id="ncr-res-note" rows="3" placeholder="Describe what was rectified…"></textarea></div>
    <div class="field"><label>Rectification Date</label><input type="date" id="ncr-rect-date" value="${UI.todayIST()}"></div>
    <button class="btn-primary approve" onclick="APP.resolveNCR(${ncrId})" style="width:100%;margin-top:8px">Mark Resolved</button>
  `);
};

APP.resolveNCR = async function(ncrId) {
  const resolution_note    = document.getElementById('ncr-res-note')?.value?.trim();
  const rectification_date = document.getElementById('ncr-rect-date')?.value;
  if (!resolution_note) { UI.toast('Resolution note required'); return; }
  const res = await API.patch(`/issues/ncr/${ncrId}/resolve`, { resolution_note, rectification_date });
  if (res?.success) { UI.closeModal(); UI.toast('NCR resolved ✓'); APP.renderNCR(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showNCRForm = function() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-title">Raise NCR <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div class="field-row"><label class="field-label" for="ncr-desc">Description</label>
      <textarea id="ncr-desc" rows="3" placeholder="Describe the non-conformance..."></textarea></div>
    <div class="field-row"><label class="field-label" for="ncr-vendor">Vendor / Party</label>
      <input type="text" id="ncr-vendor" placeholder="Vendor name or 'Internal'"></div>
    <button class="btn-primary" onclick="APP.submitNCR()">Raise NCR</button>`;
};
APP.submitNCR = async function() {
  const pid = APP.state.selectedProject;
  const body = { description: document.getElementById('ncr-desc').value, vendor_name: document.getElementById('ncr-vendor').value };
  if (!body.description) { UI.toast('Add a description'); return; }
  const res = await API.post(`/issues/ncr/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('NCR raised ✓'); APP.renderNCR(); }
  else { UI.toast(res?.error || 'Failed to raise NCR'); }
};

// ── SUBMITTALS — review queue
APP.renderSubmittals = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  const data = await API.get(`/submittals/${pid}`);
  if (!data) return;
  const subs = data.submittals || [];

  const role = APP.user.role;
  const canSubmit = ['pmc_head','site_manager','senior_site_manager','design_head','services_head',
                         'team_lead','jr_architect','services_engineer','jr_engineer',
                         'principal','design_principal'].includes(role);
  const canReview = ['design_head','services_head','pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderSubmittals()');
  if (canSubmit) {
    html += `<button class="btn-primary" onclick="APP.showSubmittalForm()" style="margin-bottom:16px">+ New Submittal</button>`;
  }

  const pending = subs.filter(s => (s.status === 'submitted' || s.status === 'under_review') && canReview);
  if (pending.length) {
    html += `<div class="sec-label">Pending Review (${pending.length})</div>`;
    pending.forEach(s => {
      html += `<div class="card" style="border-left:3px solid var(--amber)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="font-family:var(--mono);font-size:11px;font-weight:500;color:var(--navy)">${s.submittal_number||'SUB-'+s.id}</div>
            <div class="card-title">${s.title||'—'}</div>
            <div class="card-meta">${s.vendor_name||'—'} · ${UI.fmtDate(s.submitted_at)}</div>
          </div>
          <span class="badge b-amber">${s.status === 'under_review' ? 'Under Review' : 'Submitted'}</span>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn-approve" onclick="APP.reviewSubmittal(${s.id},'approved')">Approve</button>
          <button class="btn-sm" onclick="APP.reviewSubmittal(${s.id},'approved_with_comments')">Approve w/ Comments</button>
          <button class="btn-sm" style="color:#C8A040" onclick="APP.reviewSubmittal(${s.id},'resubmit_required')">Resubmit</button>
          <button class="btn-reject" onclick="APP.reviewSubmittal(${s.id},'rejected')">Reject</button>
        </div>
      </div>`;
    });
  }

  html += `<div class="sec-label">All Submittals</div>`;
  if (!subs.length) { html += UI.empty('','No submittals yet'); }
  else {
    html += APP._sortToggleHTML('submittals', ['default','age']);
    const sortedSubs = APP._applySort(subs, APP._getSortMode('submittals'), { ageField:'submitted_at' });
    sortedSubs.slice(0,12).forEach(s => {
      const statusMap = { approved:'b-green', approved_with_comments:'b-green', rejected:'b-red', resubmit_required:'b-amber', submitted:'b-silver', under_review:'b-navy' };
      const labelMap = { approved:'Approved', approved_with_comments:'Approved*', rejected:'Rejected', resubmit_required:'Resubmit', submitted:'Submitted', under_review:'Under Review' };
      const b = statusMap[s.status] || 'b-silver';
      html += `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1">
            <div style="font-family:var(--mono);font-size:11px;color:var(--navy)">${s.submittal_number||'SUB-'+s.id}</div>
            <div class="card-title">${s.title||'—'}</div>
            <div class="card-meta">${s.vendor_name||'—'}</div>
          </div>
          <span class="badge ${b}">${labelMap[s.status]||s.status||'draft'}</span>
        </div>
      </div>`;
    });
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.reviewSubmittal = async function(id, status) {
  const res = await API.patch(`/submittals/${id}/review`, { status });
  if (res?.success) { UI.toast(status==='approved'?'Approved ✓':'Returned'); APP.renderSubmittals(); }
  else if (res?.error) { UI.toast(res.error, 'error'); }
};
APP.showSubmittalForm = async function() {
  const pid = APP.state.selectedProject;
  // Fetch vendor engagements for this project
  const engData = await API.get(`/vendors/${pid}/engagements`).catch(() => null);
  const engs = (engData?.engagements || []).filter(e => e.approval_status === 'approved' || !e.approval_status);

  const vendorOptions = engs.length
    ? engs.map(e => `<option value="${e.id}">${UI.escapeText(e.vendor_name)} (${UI.escapeText(e.trade||'')})</option>`).join('')
    : '';

  UI.showModal('New Submittal', `
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Title *</label>
      <input type="text" id="sub-title" placeholder="e.g. Structural steel shop drawings"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Type</label>
      <select id="sub-type" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box">
        <option value="shop_drawing">Shop Drawing</option>
        <option value="material_sample">Material Sample</option>
        <option value="product_data">Product Data</option>
        <option value="test_report">Test Report</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div style="margin-bottom:18px">
      <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Vendor</label>
      ${vendorOptions
        ? `<select id="sub-engagement" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box">
            <option value="">Select vendor…</option>
            ${vendorOptions}
           </select>`
        : `<div style="font-size:13px;color:var(--muted);padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r)">
            No approved vendor engagements found for this project.
            Vendors must be engaged via the Vendors tab before raising a submittal.
           </div>`}
    </div>
    ${vendorOptions ? '<button class="btn-primary" style="width:100%" onclick="APP.submitSubmittal()">Submit</button>' : ''}
  `);
};
APP.submitSubmittal = async function() {
  const pid = APP.state.selectedProject;
  const title = document.getElementById('sub-title')?.value?.trim();
  const engagement_id = document.getElementById('sub-engagement')?.value;
  const submittal_type = document.getElementById('sub-type')?.value || 'shop_drawing';
  if (!title) { UI.toast('Add a title'); return; }
  if (!engagement_id) { UI.toast('Select a vendor'); return; }
  const res = await API.post(`/submittals/${pid}`, { title, engagement_id, submittal_type });
  if (res?.success) { UI.closeModal(); UI.toast('Submittal submitted ✓'); APP.renderSubmittals(); }
  else { UI.toast(res?.error || 'Failed to submit'); }
};

// ── PMC DEPUTY — declare unavailable / return
// ── WEEKLY HEALTH REPORT — Principal consolidated view
APP.renderWeeklyHealth = async function() {
  const el = UI.contentEl();
  const data = await API.get('/weekly-health/summary');
  if (!data) return;
  const projects = data.projects || [];

  let html = `<div class="sec-label">Weekly Health — All Projects</div>`;
  if (!projects.length) { html += UI.empty('','No active projects'); }
  else {
    html += `<div class="projects-grid">`;
    projects.forEach(p => {
      const sched = p.schedule || {};
      const drift = sched.drift_days || 0;
      const driftCls = drift > 14 ? 'red' : drift > 7 ? 'amber' : 'green';
      const healthStatus = p.health_status || 'active';
      const borderColor = healthStatus === 'critical' ? 'var(--red)' : healthStatus === 'at_risk' ? 'var(--amber)' : 'var(--green)';

      html += `<div class="proj-card" style="border-left:3px solid ${borderColor}">
        <div class="pc-top">
          <div style="flex:1">
            <div class="pc-name">${p.name}</div>
            <div class="pc-client">${p.client_name||'—'}</div>
          </div>
          ${UI.statusBadge(healthStatus)}
        </div>
        <div class="pc-stats">
          <div class="pc-stat"><span class="pc-stat-val ${driftCls}">${drift>0?'+':''}${drift}d</span><span class="pc-stat-lbl">Schedule</span></div>
          <div class="pc-stat"><span class="pc-stat-val ${(p.open_issues||0)>0?'amber':''}">${p.open_issues||0}</span><span class="pc-stat-lbl">Issues</span></div>
          <div class="pc-stat"><span class="pc-stat-val ${(p.pending_payments||0)>0?'amber':''}">${p.pending_payments||0}</span><span class="pc-stat-lbl">Payments</span></div>
          <div class="pc-stat"><span class="pc-stat-val ${(p.open_cns||0)>0?'amber':''}">${p.open_cns||0}</span><span class="pc-stat-lbl">CNs</span></div>
        </div>
        ${p.riskNarratives?.length ? `<div class="pc-progress">
          ${p.riskNarratives.slice(0,2).map(n => {
            const lvlColor = (n.escalation_level==='critical'||n.escalation_level==='red') ? 'var(--red)' : 'var(--amber)';
            return `<div style="font-size:11px;color:${lvlColor};line-height:1.4;margin-bottom:4px;border-left:2px solid ${lvlColor};padding-left:7px">
              <strong>${n.trade}:</strong> ${(n.narrative||'').replace(/\s*\(AI narrative.*?\)/i,'')}
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;
    });
    html += `</div>`;
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── SCHEDULE COMPLIANCE — PMC Saturday trigger
APP.renderScheduleCompliance = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  if (APP._guardInitialisingProject(el, pid)) return;

  let html = APP._projectSelectHtml('APP.renderScheduleCompliance()') + `
  <div class="card" style="margin-bottom:16px;border-left:3px solid var(--navy)">
    <div class="card-title">Schedule Compliance Check</div>
    <div class="card-meta">Run before Saturday payment batch. Clears vendors with sufficient progress.</div>
    <button class="btn-primary" style="margin-top:12px" onclick="APP.runComplianceCheck('${pid}')">Run Check Now</button>
  </div>`;

  // Show last check results if any
  if (APP.state.complianceResults) {
    const r = APP.state.complianceResults;
    html += `<div class="sec-label">Last Check Results</div>
    <div class="stat-row">
      <div class="stat-card"><span class="stat-val green">${r.cleared}</span><span class="stat-lbl">Cleared</span></div>
      <div class="stat-card"><span class="stat-val red">${r.held}</span><span class="stat-lbl">Held</span></div>
      <div class="stat-card"><span class="stat-val">${r.results?.length||0}</span><span class="stat-lbl">Total</span></div>
    </div>`;

    (r.results||[]).forEach(p => {
      const clr = p.compliant ? 'green' : 'red';
      html += `<div class="card" style="border-left:3px solid var(--${clr})">
        <div style="display:flex;justify-content:space-between">
          <div>
            <div class="card-title">${p.vendor}</div>
            <div class="card-meta">Progress: ${p.avg_progress}% · ${Money.formatRupee(p.amount)}</div>
          </div>
          <span class="badge b-${clr}">${p.compliant?'Cleared':'Held'}</span>
        </div>
        ${!p.compliant?`<div class="card-meta" style="margin-top:4px;color:var(--red)">${p.reason}</div>`:''}
      </div>`;
    });
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};
APP.runComplianceCheck = async function(pid) {
  UI.toast('Running compliance check…');
  const res = await API.post(`/payments/${pid}/compliance-check`, {});
  if (res?.success) {
    APP.state.complianceResults = res;
    UI.toast(`${res.cleared} cleared · ${res.held} held`);
    APP.renderScheduleCompliance();
  }
};

// ── PROJECT DETAIL — summary screen
// ── PROJECT SUMMARY — role-aware (Sprint 3 Item 11)
// Backend returns `summary.buttons` already filtered + counted per role.
// Team roster and team-count stat are dropped for all roles.
// Approvals button opens an inline 5-tab strip with category counts.
APP.handleProjectSummarySelect = function(id) {
  APP.state.selectedProject = id;
  if (APP._updateTopbar) APP._updateTopbar();
  APP.renderProjectDetail();
};

APP.renderProjectDetail = async function() {
  const el = UI.contentEl();

  const projectsData = await API.getProjects();
  const projectsList = (projectsData && projectsData.projects) ? projectsData.projects : [];

  if (!projectsList.length) {
    el.innerHTML = UI.empty('', 'No projects found');
    return;
  }

  let currentPid = APP.state.selectedProject;
  if (!currentPid || !projectsList.some(proj => String(proj.id) === String(currentPid))) {
    currentPid = projectsList[0].id;
    APP.state.selectedProject = currentPid;
  }

  const pid = currentPid;

  const data = await API.get(`/projects/${pid}`);
  if (!data) return;
  const p = data.project || data;
  const summary = data.summary || { buttons: [] };
  const buttons = summary.buttons || [];

  // Button key → tab it navigates to (Approvals is handled inline)
  const BUTTON_TARGET = {
    schedule:       'schedule_view',
    issues:         'issues',
    cns:            'changes',
    reports:        'reports_weekly',
    submittals:     'submittals',
    payments_queue: 'payments_fin',
    todays_tasks:   'tasks',
  };

  // Count pill shown on button; suppressed for Schedule (no count)
  const countPill = (c) => {
    if (c == null) return '';
    const color = c === 0 ? 'var(--muted)' : 'var(--navy)';
    return `<span style="background:var(--bg);color:${color};padding:2px 10px;border-radius:12px;font-size:13px;font-weight:700;font-family:var(--mono);margin-left:auto">${c}</span>`;
  };

  let html = `
  <div class="card" style="margin-bottom:16px; display:flex; flex-direction:column; gap:8px">
    <div style="font-size:11px; font-weight:bold; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Select Project</div>
    <div style="position:relative; width:100%">
      <select id="ps-project-select" style="padding:8px 30px 8px 12px; border-radius:6px; border:1px solid #ddd; font-size:14px; width:100%; color:var(--text); background: #fff; cursor: pointer; -webkit-appearance: none; -moz-appearance: none; appearance: none" onchange="APP.handleProjectSummarySelect(this.value)">
        ${projectsList.map(proj => `<option value="${proj.id}" ${String(proj.id) === String(pid) ? 'selected' : ''}>${UI.escapeText(proj.name)} (${proj.code})</option>`).join('')}
      </select>
      <div style="position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--muted); font-size:12px">▼</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:4px">${p.name||'—'}</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:8px">${p.client_name||p.client||'—'}</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.5">${p.location||''}</div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      ${p.jurisdiction ? `<span class="badge b-navy">${p.jurisdiction}</span>` : ''}
      ${UI.statusBadge(p.status||'active')}
    </div>
  </div>

  <div class="sec-label">Key Dates</div>
  <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr">
      <div style="padding:14px 16px;border-right:1px solid var(--border)">
        <div style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px">Start</div>
        <div style="font-size:14px;font-weight:600;color:${p.start_date ? 'var(--text)' : 'var(--muted)'}">${UI.fmtDate(p.start_date) || '—'}</div>
      </div>
      <div style="padding:14px 16px;border-right:1px solid var(--border)">
        <div style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px">Completion</div>
        <div style="font-size:14px;font-weight:600;color:${p.completion_date ? 'var(--text)' : 'var(--muted)'}">${UI.fmtDate(p.completion_date) || '—'}</div>
      </div>
      <div style="padding:14px 16px">
        <div style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px">Contract Value</div>
        <div style="font-size:14px;font-weight:600;color:${p.contract_value ? 'var(--navy)' : 'var(--muted)'}">${p.contract_value ? Money.formatRupee(p.contract_value) : '—'}</div>
      </div>
    </div>
  </div>`;

  // ── PMC Assignment card — modern person-card layout
  const pmc = summary.pmc || {};
  const canChange = summary.can_change_pmc;
  const _initials = n => (n||'').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const _personRow = (name, roleLabel, avatarBg, avatarFg, onclick, unassignedSub, border) => {
    const b = border ? 'border-top:1px solid var(--border);' : '';
    if (name) {
      return `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;${b}">
        <div style="width:40px;height:40px;border-radius:50%;background:${avatarBg};color:${avatarFg};font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:0.3px">${_initials(name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(name)}</div>
          <div style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px">${roleLabel}</div>
        </div>
        ${onclick ? `<button class="btn-sm" onclick="${onclick}">Change</button>` : ''}
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;${b}">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--bg);border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:var(--muted)">Not assigned</div>
        <div style="font-size:11px;color:#CED4DA;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px">${unassignedSub}</div>
      </div>
      ${onclick ? `<button class="btn-sm" onclick="${onclick}">Assign</button>` : ''}
    </div>`;
  };
  html += `
  <div class="sec-label">PMC Assignment</div>
  <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
    ${_personRow(pmc.primary_name, 'Primary PMC', '#E3EAFD', '#3B5BDB', canChange ? `APP.openChangePmc(${pid},'primary')` : null, 'Primary PMC', false)}
    ${_personRow(pmc.backup_name, 'Backup PMC', '#E6FCF5', '#0CA678', canChange ? `APP.openChangePmc(${pid},'backup')` : null, 'Backup · Optional leave cover', true)}
  </div>`;

  // ── Site Manager Assignment card — same person-card layout
  const canAssignSM = ['pmc_head','principal','design_principal'].includes(APP.user?.role);
  if (canAssignSM) {
    const teamData = await API.get(`/projects/${pid}/team`).catch(() => null);
    const siteManagers = (teamData?.team || []).filter(m => ['site_manager','senior_site_manager'].includes(m.role));
    const _smColors = { site_manager: ['#FFF3BF','#E67700'], senior_site_manager: ['#F3F0FF','#7048E8'] };
    const _smLabel  = role => role === 'senior_site_manager' ? 'Senior Site Manager' : 'Site Manager';
    const smRows = siteManagers.length
      ? siteManagers.map((sm, i) => {
          const [bg, fg] = _smColors[sm.role] || ['#F1F3F5','#868E96'];
          return _personRow(sm.full_name, _smLabel(sm.role), bg, fg, `APP.showAssignSiteManager(${pid})`, '', i > 0);
        }).join('')
      : _personRow(null, 'Site Manager', '', '', `APP.showAssignSiteManager(${pid})`, 'Site Manager', false);
    html += `
    <div class="sec-label">Site Manager</div>
    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">${smRows}</div>`;

    // ── Project Team — the other project-scoped office roles. Firm-wide roles
    // (heads/principals/finance) see every project automatically and are not
    // listed here. One row per role, same person-card layout as Site Manager.
    const TEAM_ROLES = [
      ['team_lead',         'Team Lead',          ['#E7F5FF','#1971C2']],
      ['jr_architect',      'Junior Architect',   ['#FFF0F6','#C2255C']],
      ['services_engineer', 'Services Engineer',  ['#E6FCF5','#0CA678']],
      ['coordinator',       'Coordinator',        ['#FFF9DB','#E67700']],
      ['jr_engineer',       'Junior Engineer',    ['#F3F0FF','#7048E8']],
      ['trainee',           'Trainee',            ['#F1F3F5','#868E96']],
    ];
    const teamRows = TEAM_ROLES.map(([role, label, [bg, fg]], idx) => {
      const members = (teamData?.team || []).filter(m => m.role === role);
      if (members.length) {
        return members.map((m, j) =>
          _personRow(m.full_name, label, bg, fg, `APP.showAssignRole(${pid},'${role}')`, label, idx > 0 || j > 0)
        ).join('');
      }
      return _personRow(null, label, '', '', `APP.showAssignRole(${pid},'${role}')`, label, idx > 0);
    }).join('');
    html += `
    <div class="sec-label">Project Team</div>
    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">${teamRows}</div>`;
  }

  // Documents render here (built below, injected at this slot so it sits under
  // the team cards rather than at the very bottom of the summary).
  html += '<!--DOCSSLOT-->';

  if (buttons.length) {
    html += `<div class="sec-label">Actions</div>`;
    html += `<div class="action-nav-group">`;
    html += buttons.map(b => {
      if (b.key === 'approvals') {
        // Approvals widget — self-contained accordion, categories expand BELOW
        // the card without affecting sibling cards (position:relative + absolute child)
        const cats = (b.categories || []).map(c => `
          <button class="appr-cat-row" onclick="event.stopPropagation(); APP._psApprovalsJump('${c.key}')">
            <span class="appr-cat-label">${c.label}</span>
            ${c.count > 0
              ? `<span class="appr-cat-pill appr-cat-pill--active">${c.count}</span>`
              : `<span class="appr-cat-pill">${c.count}</span>`}
          </button>`).join('');
        return `<div class="card ps-btn appr-widget" id="ps-appr-widget">
          <button class="appr-trigger" onclick="APP._togglePsApprovals()" aria-expanded="false" aria-controls="ps-appr-dropdown">
            <span class="appr-trigger-label">Approvals</span>
            <div style="display:flex;align-items:center;gap:6px">
              ${countPill(b.count)}
              <span class="appr-caret" id="ps-appr-caret">▾</span>
            </div>
          </button>
          <div class="appr-dropdown" id="ps-appr-categories" hidden>
            ${cats}
          </div>
        </div>`;
      }
      // Regular button
      const target = BUTTON_TARGET[b.key];
      const onclick = target ? `APP.switchTab('${target}')` : '';
      return `<button class="card ps-btn" onclick="${onclick}">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:10px">
          <div style="font-weight:600;font-size:14px;color:var(--navy)">${b.label}</div>
          ${countPill(b.count)}
        </div>
      </button>`;
    }).join('');
    html += `</div>`;
  }

  // ── SLA Settings card — principal/design_principal only (Item 12)
  // Single card at the bottom that opens a modal for editing the 6 SLA
  // thresholds. Hidden for everyone else.
  if (['principal','design_principal'].includes(APP.user?.role)) {
    html += `<button class="card ps-btn" style="padding:14px 16px;margin-top:16px;cursor:pointer;text-align:left;width:100%;display:block" onclick="APP.openSlaSettings(${pid})">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(29,61,98,0.12);color:var(--navy);font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0">⏱</div>
        <div style="flex:1;min-width:0;text-align:left">
          <div style="font-weight:600;font-size:14px;color:var(--navy)">SLA Settings</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">Per-project thresholds for when items escalate to the Pending tab</div>
        </div>
        <div style="color:var(--muted);font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:3px;flex-shrink:0">
          Edit <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </button>`;
  }

  // ── Documents section ──
  const docRoles = ['principal','design_principal','pmc_head','design_head','services_head',
                    'senior_site_manager','site_manager','team_lead','services_engineer',
                    'coordinator','finance_admin'];
  if (docRoles.includes(APP.user.role)) {
    let docsHtml = '';
    const docsRes = await API.get(`/documents/${pid}`).catch(() => null);
    const docs = docsRes?.documents || [];
    const canUpload = ['principal','design_principal','pmc_head','design_head','services_head',
                       'senior_site_manager','site_manager'].includes(APP.user.role);
    const catLabels = { contract:'Contracts', drawing:'Drawings', quote:'Quotes', approval:'Approvals',
      statutory:'Statutory', invoice:'Invoices', photo:'Photos', report:'Reports', other:'Other' };
    const catOrder = ['contract','approval','statutory','drawing','quote','invoice','report','photo','other'];

    docsHtml += `<div class="sec-hdr-row" style="margin-top:20px">
      <div class="sec-label" style="margin:0;flex:1">Documents (${docs.length})</div>
      ${canUpload ? `<button class="btn-sm navy" onclick="APP._docRefresh=APP.renderProjectDetail;APP.showNewDocumentForm(${pid})">+ Upload</button>` : ''}
    </div>`;

    if (!docs.length) {
      docsHtml += `<div style="font-size:12px;color:var(--muted);padding:10px 0">No documents uploaded yet.</div>`;
    } else {
      const byCat = {};
      docs.forEach(d => { const c = d.category||d.doc_type||'other'; (byCat[c]=byCat[c]||[]).push(d); });
      catOrder.forEach(cat => {
        const list = byCat[cat];
        if (!list?.length) return;
        docsHtml += `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 6px">${catLabels[cat]||cat}</div>`;
        list.forEach(d => {
          docsHtml += `<div class="card" style="padding:10px 14px;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(29,61,98,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px">
                ${d.category==='photo'?'🖼️':d.category==='drawing'?'📐':d.category==='contract'?'📜':'📄'}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(d.title||d.file_name)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:1px">v${d.current_version_number} · ${Math.round(d.file_size_kb||0)} KB · ${UI.fmtDate(d.uploaded_at)}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn-sm" onclick="APP.viewDocumentFile(${d.latest_version_id})">View</button>
                ${canUpload ? `<button class="btn-sm" onclick="APP.uploadDocumentVersion(${pid},${d.id})" title="Upload new version">↑</button>` : ''}
              </div>
            </div>
          </div>`;
        });
      });
    }
    html = html.replace('<!--DOCSSLOT-->', docsHtml);
  }

  // Any unreplaced slot (role without docs access) is an invisible comment — strip it.
  html = html.replace('<!--DOCSSLOT-->', '');
  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// Toggle Approvals category accordion open/closed
APP._togglePsApprovals = function() {
  const dropdown = document.getElementById('ps-appr-categories');
  const caret    = document.getElementById('ps-appr-caret');
  const trigger  = document.querySelector('.appr-trigger');
  if (!dropdown) return;
  const isOpen = !dropdown.hidden;
  dropdown.hidden = isOpen;
  if (caret)   caret.textContent = isOpen ? '▾' : '▴';
  if (trigger) trigger.setAttribute('aria-expanded', String(!isOpen));
};

// Jump from an Approvals category pill to the relevant tab
APP._psApprovalsJump = function(catKey) {
  // Each category maps to the tab that shows the actionable items.
  // Principal/DP don't have meetings/approvals tabs — they use 'pending'.
  const role = APP.user?.role;
  const isPrincipal = ['principal','design_principal'].includes(role);
  const isSiteRole = ['site_manager','senior_site_manager'].includes(role);
  const CAT_TAB = {
    drawings: isPrincipal ? 'pending' : 'drawings',
    payments: isPrincipal ? 'pending' : isSiteRole ? 'grn' : 'payments',
    budget:   'budget',
    moms:     isPrincipal ? 'pending' : 'meetings',
    other:    'pending',
  };
  const target = CAT_TAB[catKey];
  if (target) APP.switchTab(target);
};

// ── CHANGE PMC MODAL (v4.3) ────────────────────────────────────────────────
// Principal / DP only. Shows dropdown of all active pmc_head users.
// On save: POST /api/pmc-assignments/:pid with user_id, kind, effective_from.
// Backend handles effective_to closure on the outgoing row automatically.
APP.openChangePmc = async function(pid, kind) {
  // Fetch list of pmc_head users and current assignment
  const [usersRes, assignmentRes] = await Promise.all([
    API.get('/users'),
    API.get(`/pmc-assignments/${pid}`),
  ]);
  const pmcUsers = (usersRes?.users || []).filter(u => u.role === 'pmc_head' && u.is_active);
  const current  = assignmentRes?.assignment || {};
  const currentId = kind === 'primary' ? current.primary_pmc_id : current.backup_pmc_id;

  const today = UI.todayIST();

  UI.openModal(`Change ${kind === 'primary' ? 'Primary' : 'Backup'} PMC`, `
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px">PMC Head</label>
        <select id="pmc-assign-user" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--r2);font-size:14px">
          ${pmcUsers.map(u => `<option value="${u.id}" ${u.id===currentId?'selected':''}>${u.full_name}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px">Effective From</label>
        <input id="pmc-assign-from" type="date" value="${today}"
          style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--r2);font-size:14px">
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px">Note <span style="color:var(--muted2)">(optional)</span></label>
        <input id="pmc-assign-note" type="text" placeholder="e.g. PMC Head on leave Apr 25 – May 2"
          style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--r2);font-size:14px">
      </div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn-primary" onclick="APP._savePmcAssignment(${pid},'${kind}')">Save</button>
        ${currentId ? `<button class="btn-secondary" onclick="APP._removePmcAssignment(${pid},'${kind}')">Remove</button>` : ''}
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
      </div>`);
};

APP._savePmcAssignment = async function(pid, kind) {
  const userId = parseInt(document.getElementById('pmc-assign-user').value, 10);
  const from   = document.getElementById('pmc-assign-from').value;
  const note   = document.getElementById('pmc-assign-note').value.trim();
  if (!userId || !from) { UI.toast('User and date required'); return; }

  const res = await API.post(`/pmc-assignments/${pid}`, {
    user_id: userId, kind, effective_from: from, note: note || null,
  });
  if (res?.success) {
    UI.closeModal();
    const msg = res.auto_cleared_backup
      ? 'Primary assigned ✓ (backup slot auto-cleared)'
      : `${kind === 'primary' ? 'Primary' : 'Backup'} PMC assigned ✓`;
    UI.toast(msg);
    APP.renderProjectDetail();
  } else {
    UI.toast(res?.error || 'Assignment failed');
  }
};

APP._removePmcAssignment = async function(pid, kind) {
  if (!confirm(`Remove ${kind} PMC assignment? This cannot be undone without a new assignment.`)) return;
  const res = await API.call('DELETE', `/pmc-assignments/${pid}/${kind}`);
  if (res?.success) {
    UI.closeModal();
    UI.toast(`${kind} PMC removed ✓`);
    APP.renderProjectDetail();
  } else {
    UI.toast(res?.error || 'Removal failed');
  }
};

// ── ASSIGN SITE MANAGER TO PROJECT ───────────────────────────────────────
APP.showAssignSiteManager = async function(pid) {
  const usersRes = await API.get('/users');
  const allUsers = usersRes?.users || [];
  const siteManagers = allUsers.filter(u => u.role === 'site_manager' && u.is_active);
  const seniorSiteManagers = allUsers.filter(u => u.role === 'senior_site_manager' && u.is_active);

  const smOptions = siteManagers.length
    ? siteManagers.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('')
    : '<option value="">— No site managers available —</option>';
  const ssmOptions = seniorSiteManagers.length
    ? seniorSiteManagers.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('')
    : '<option value="">— No senior site managers available —</option>';

  UI.showModal('Assign Site Managers', `
    <div class="field" style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Site Manager</label>
      <select id="sm-assign-user" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r)">
        <option value="">— None —</option>
        ${smOptions}
      </select>
    </div>
    <div class="field" style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Senior Site Manager</label>
      <select id="ssm-assign-user" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r)">
        <option value="">— None —</option>
        ${ssmOptions}
      </select>
    </div>
    <button class="btn-primary" style="width:100%;margin-top:12px" onclick="APP.doAssignSiteManager(${pid})">Assign</button>
  `);
};

APP.doAssignSiteManager = async function(pid) {
  const smId = document.getElementById('sm-assign-user')?.value;
  const ssmId = document.getElementById('ssm-assign-user')?.value;
  if (!smId && !ssmId) { UI.toast('Select at least one'); return; }
  let success = true;
  if (smId) {
    const res = await API.post(`/projects/${pid}/assign-site-manager`, { user_id: parseInt(smId) });
    if (!res?.success) { UI.toast(res?.error || 'Failed to assign site manager'); success = false; }
  }
  if (ssmId) {
    const res = await API.post(`/projects/${pid}/assign-site-manager`, { user_id: parseInt(ssmId) });
    if (!res?.success) { UI.toast(res?.error || 'Failed to assign senior site manager'); success = false; }
  }
  if (success) {
    UI.closeModal();
    UI.toast('Site manager(s) assigned ✓');
    APP.renderProjectDetail();
  }
};

// ── ASSIGN A PROJECT-SCOPED OFFICE ROLE ──────────────────────────────────
// Generic version of the site-manager assign, for team_lead / jr_architect /
// services_engineer / coordinator / jr_engineer / trainee. One dropdown of the
// active users who hold that role.
APP.showAssignRole = async function(pid, role) {
  const usersRes = await API.get('/users');
  const allUsers = usersRes?.users || [];
  const eligible = allUsers.filter(u => u.role === role && u.is_active);
  const label = APP._roleLabel ? APP._roleLabel(role) : role.replace(/_/g, ' ');
  const options = eligible.length
    ? eligible.map(u => `<option value="${u.id}">${UI.escapeText ? UI.escapeText(u.full_name) : u.full_name}</option>`).join('')
    : `<option value="">— No ${label.toLowerCase()} available —</option>`;
  UI.showModal(`Assign ${label}`, `
    <div class="field" style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">${label}</label>
      <select id="role-assign-user" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r)">
        <option value="">— None —</option>
        ${options}
      </select>
    </div>
    <button class="btn-primary" style="width:100%;margin-top:12px" onclick="APP.doAssignRole(${pid},'${role}')">Assign</button>
  `);
};

APP.doAssignRole = async function(pid, role) {
  const uid = document.getElementById('role-assign-user')?.value;
  if (!uid) { UI.toast('Select a person'); return; }
  const res = await API.assignRole(pid, parseInt(uid), role);
  if (res?.success) {
    UI.closeModal();
    UI.toast('Team member assigned ✓');
    APP.renderProjectDetail();
  } else {
    UI.toast(res?.error || 'Failed to assign');
  }
};

// ── SLA SETTINGS MODAL (Sprint 3 Item 12) ────────────────────────────────
// Principal-only. Lists the 6 item types with current days + default + an
// editable input. Save updates one item at a time (PUT). Revert deletes the
// override and reverts to default (DELETE). Modal stays open during edits;
// each save triggers a fresh fetch so the "overridden" badge updates.
APP.openSlaSettings = async function(pid) {
  if (!pid) return;
  APP._slaProjectId = pid;
  UI.openModal('SLA Settings', '<div style="padding:20px;text-align:center;color:var(--muted)">Loading…</div>');
  await APP._refreshSlaModal();
};

APP._refreshSlaModal = async function() {
  const pid = APP._slaProjectId;
  if (!pid) return;
  const data = await API.get(`/project-slas/${pid}`);
  if (!data) {
    UI.toast('Failed to load SLAs');
    return;
  }
  const items = data.items || [];

  const content = document.getElementById('modal-content');
  if (!content) return;

  content.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
      Days before an item escalates into the Pending tab.
      Defaults apply unless overridden here. Range: 1–60 days.
    </div>
    ${items.map(it => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="font-weight:600;font-size:13px;color:var(--navy);flex:1">${UI.escapeText(it.label)}</div>
          ${it.overridden
            ? '<span style="background:rgba(218,165,32,0.12);color:var(--amber);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;border:1px solid rgba(218,165,32,0.30)">CUSTOM</span>'
            : '<span style="color:var(--muted);font-size:10px">default</span>'}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" id="sla-${it.item_type}" value="${it.sla_days}" min="1" max="60"
                 style="width:64px;padding:6px 8px;border:1.5px solid var(--border2);border-radius:6px;font-family:var(--mono);font-size:13px;text-align:center">
          <span style="font-size:11px;color:var(--muted)">days · default ${it.default_days}</span>
          <button class="btn-sm navy" style="margin-left:auto" onclick="APP._saveSla('${it.item_type}')">Save</button>
          ${it.overridden ? `<button class="btn-sm" onclick="APP._revertSla('${it.item_type}')">Revert</button>` : ''}
        </div>
      </div>
    `).join('')}
  `;
};

APP._saveSla = async function(itemType) {
  const pid = APP._slaProjectId;
  const input = document.getElementById(`sla-${itemType}`);
  if (!input) return;
  const days = parseInt(input.value, 10);
  if (!Number.isFinite(days) || days < 1 || days > 60) {
    UI.toast('Days must be 1–60'); return;
  }
  const res = await API.call('PUT', `/project-slas/${pid}/${itemType}`, { sla_days: days });
  if (res?.ok) {
    UI.toast(`${itemType} SLA set to ${days} days ✓`);
    await APP._refreshSlaModal();
  } else {
    UI.toast(res?.error || 'Save failed');
  }
};

APP._revertSla = async function(itemType) {
  const pid = APP._slaProjectId;
  if (!confirm('Revert this SLA to the default?')) return;
  const res = await API.del(`/project-slas/${pid}/${itemType}`);
  if (res?.ok) {
    UI.toast('Reverted to default ✓');
    await APP._refreshSlaModal();
  } else {
    UI.toast(res?.error || 'Revert failed');
  }
};

// ── CLIENT RECEIPTS — Finance Admin logs incoming payments
APP.renderClientReceipts = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/finance/${pid}/client-receipts`);
  if (!data) return;
  const receipts = data.receipts || [];

  let html = APP._projectSelectHtml('APP.renderClientReceipts()') +
    `<button class="btn-primary" onclick="APP.showReceiptForm()" style="margin-bottom:16px">+ Log Receipt</button>
  <div class="sec-label">Client Receipts</div>`;

  if (!receipts.length) { html += UI.empty('','No receipts logged yet'); }
  else receipts.forEach(r => {
    html += `<div class="pay-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="pay-vendor">Receipt from ${r.client_name||'Client'}</div>
          <div class="pay-meta">${UI.fmtDate(r.receipt_date)} · ${r.mode||'—'}</div>
          ${r.reference ? `<div class="pay-meta">Ref: ${r.reference}</div>` : ''}
        </div>
        <div class="pay-amount">${Money.formatRupee(r.amount||0)}</div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};
APP.showReceiptForm = async function() {
  const pid = APP.state.selectedProject;
  // Fetch PIs to let user select which invoice this receipt is against
  const data = await API.get(`/invoices/${pid}/pi`);
  const pis = (data?.invoices || []).filter(p => p.status === 'issued' || p.status === 'partially_paid');
  const piOptions = pis.map(p => `<option value="${p.id}">${p.pi_number || 'PI-'+p.id} — ${Money.formatRupee(p.amount||0)}</option>`).join('');

  UI.openModal('Log Client Receipt', `
    <div class="field-row">
      <label class="field-label" for="rcpt-pi">Against Invoice</label>
      <select id="rcpt-pi" style="width:100%;height:38px;padding:6px;border-radius:var(--r);border:1px solid var(--border)">
        <option value="">-- Select PI --</option>
        ${piOptions}
      </select>
    </div>
    <div class="field-row">
      <label class="field-label" for="rcpt-amount">Amount Received (₹)</label>
      <input type="number" id="rcpt-amount" placeholder="0">
    </div>
    <div class="field-row">
      <label class="field-label" for="rcpt-tds">TDS Deducted (₹)</label>
      <input type="number" id="rcpt-tds" placeholder="0" value="0">
    </div>
    <div class="field-row">
      <label class="field-label" for="rcpt-date">Date</label>
      <input type="date" id="rcpt-date" value="${UI.todayIST()}">
    </div>
    <div class="field-row">
      <label class="field-label" for="rcpt-utr">UTR / Reference</label>
      <input type="text" id="rcpt-utr" placeholder="Transaction reference">
    </div>
    <div class="field-row">
      <label class="field-label" for="rcpt-notes">Notes</label>
      <input type="text" id="rcpt-notes" placeholder="Optional notes">
    </div>
    <button class="btn-primary" style="margin-top:16px;width:100%" onclick="APP.submitReceipt()">Save</button>
  `);
};
APP.submitReceipt = async function() {
  const pid = APP.state.selectedProject;
  const piId = document.getElementById('rcpt-pi')?.value;
  if (!piId) { UI.toast('Select an invoice'); return; }
  const body = {
    pi_id:            parseInt(piId, 10),
    amount_received:  parseFloat(document.getElementById('rcpt-amount')?.value || 0),
    tds_deducted:     parseFloat(document.getElementById('rcpt-tds')?.value || 0),
    receipt_date:     document.getElementById('rcpt-date')?.value,
    utr:              document.getElementById('rcpt-utr')?.value || null,
    notes:            document.getElementById('rcpt-notes')?.value || null,
  };
  if (!body.amount_received) { UI.toast('Enter amount'); return; }
  if (!body.receipt_date) { UI.toast('Enter date'); return; }
  const res = await API.post(`/finance/${pid}/client-receipts`, body);
  if (res?.success) { UI.closeModal(); UI.toast('Receipt logged ✓'); APP.renderClientReceipts(); }
  else { UI.toast(res?.error || 'Failed to save receipt'); }
};

// ── TALLY XML EXPORT — Finance Admin
APP.renderTallyExport = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/invoices/${pid}/pi`);
  if (!data) return;
  const pis = (data.invoices||[]).filter(p => p.status === 'paid');

  let html = APP._projectSelectHtml('APP.renderTallyExport()') + `
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Tally XML Export</div>
    <div class="card-meta">${pis.length} paid invoice${pis.length!==1?'s':''} available for export</div>
  </div>
  <div class="sec-label">Select Invoices to Export</div>`;

  if (!pis.length) {
    html += UI.empty('','No paid invoices to export');
  } else {
    html += `<button class="btn-primary" style="margin-bottom:12px" onclick="APP.exportAllTally('${pid}')">Export All to Tally XML</button>`;
    pis.forEach(pi => {
      html += `<div class="pay-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="pay-vendor">${pi.pi_number||'PI-'+pi.id}</div>
            <div class="pay-scope">${pi.milestone_description||''}</div>
            <div class="pay-meta">${UI.fmtDate(pi.payment_date||pi.raised_at)}</div>
          </div>
          <div style="text-align:right">
            <div class="pay-amount">${Money.formatRupee(pi.amount||0)}</div>
            <button class="btn-sm navy" style="margin-top:6px" onclick="APP.exportTally('${pi.id}')">Export</button>
          </div>
        </div>
      </div>`;
    });
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};
APP.exportTally = function(piId) {
  window.open(`/api/pi-generator/${piId}/tally`, '_blank');
};
APP.exportAllTally = function(pid) {
  window.open(`/api/pi-generator/all/${pid}/tally`, '_blank');
};

// ── DASHBOARD — role-aware PMC version
// SETUP STATUS BANNER HELPER
APP.renderSetupBanner = async function(projectId) {
  if (!projectId) return '';
  
  try {
    const setup = await API.get(`/project-setup/${projectId}/checklist`);
    if (!setup || setup.percent === 100) return ''; // No banner if complete
    
    const incomplete = setup.items.filter(i => !i.is_complete);
    const blocking = incomplete.filter(i => i.blocks_operations);
    
    let statusClass = 'green';
    let statusText = 'On track';
    if (setup.percent < 50) { statusClass = 'red'; statusText = 'Needs attention'; }
    else if (setup.percent < 80) { statusClass = 'amber'; statusText = 'In progress'; }
    
    return `
      <button class="setup-banner c-${statusClass}" style="min-height:44px;cursor:pointer" onclick="APP.showSetupChecklist()">
        <div class="setup-banner-icon">${blocking.length > 0 ? '' : ''}</div>
        <div class="setup-banner-body">
          <div class="setup-banner-title">Project Setup ${statusText}</div>
          <div class="setup-banner-meta">
            ${setup.completed} of ${setup.total} tasks complete (${setup.percent}%)
            ${blocking.length > 0 ? ` • ${blocking.length} blocking operations` : ''}
          </div>
        </div>
        <div class="setup-banner-action">View Checklist →</div>
      </div>`;
  } catch (err) {
    console.error('Failed to load setup status:', err);
    return '';
  }
};

APP.showSetupChecklist = async function() {
  const pid = APP.state.selectedProject;
  if (!pid) return;
  
  const setup = await API.get(`/project-setup/${pid}/checklist`);
  if (!setup) return;
  
  const groupByCategory = (items) => {
    const groups = {};
    items.forEach(item => {
      if (!groups[item.task_category]) groups[item.task_category] = [];
      groups[item.task_category].push(item);
    });
    return groups;
  };
  
  const categoryLabels = {
    core: 'Core Setup',
    boq: 'BOQ & Costing',
    vendors: 'Vendors & Engagements',
    drawings: 'Drawings',
    schedule: 'Schedule',
    finance: 'Finance'
  };
  
  const groups = groupByCategory(setup.items);
  
  let html = `
    <div class="modal-header">
      <h3>Project Setup Checklist</h3>
      <div class="modal-subtitle">${setup.project_name} • ${setup.completed}/${setup.total} complete (${setup.percent}%)</div>
    </div>
    <div class="modal-body">
      <div class="progress-bar" style="margin-bottom:20px">
        <div class="progress-fill" style="width:${setup.percent}%"></div>
      </div>`;
  
  Object.entries(groups).forEach(([cat, items]) => {
    const catComplete = items.filter(i => i.is_complete).length;
    const catTotal = items.length;
    const catPercent = Math.round((catComplete / catTotal) * 100);
    
    html += `
      <div class="setup-category">
        <div class="setup-category-header">
          <span class="setup-category-title">${categoryLabels[cat] || cat}</span>
          <span class="setup-category-progress">${catComplete}/${catTotal}</span>
        </div>`;
    
    items.forEach(item => {
      const icon = item.is_complete ? '' : (item.is_mandatory ? '⚠️' : '○');
      const statusClass = item.is_complete ? 'complete' : (item.blocks_operations ? 'blocking' : 'pending');
      
      html += `
        <div class="setup-item ${statusClass}">
          <div class="setup-item-icon">${icon}</div>
          <div class="setup-item-body">
            <div class="setup-item-title">${item.task_name}</div>
            ${item.task_description ? `<div class="setup-item-desc">${item.task_description}</div>` : ''}
            ${item.completed_by_name ? `<div class="setup-item-meta">Completed by ${item.completed_by_name}</div>` : ''}
          </div>
          ${!item.is_complete && item.validation_type === 'manual' && item.owner_role === APP.user.role ? 
            `<button class="btn btn-sm" onclick="APP.completeSetupItem(${item.id})">Mark Complete</button>` : ''}
        </div>`;
    });
    
    html += `</div>`;
  });
  
  html += `</div>`;
  
  UI.openModal('Project Setup Checklist', html);
};

APP.completeSetupItem = async function(itemId) {
  const pid = APP.state.selectedProject;
  const result = await API.post(`/project-setup/${pid}/checklist/${itemId}/complete`, {});
  if (result.success) {
    UI.toast('✓ Item marked complete');
    APP.closeModal();
    APP.showSetupChecklist(); // Refresh modal
  }
};

// ── FIX 5: DASHBOARD ACTION TRIAGE ──
// When a dashboard action card ("Approve Drawings (6)") is clicked, show the
// 6 items with per-item action buttons — not the full tab. "View all →" at
// bottom navigates to the tab for fuller context.
APP._dashTriageMeta = {
  overdue_queries:   { title: 'Drawing queries — overdue',    tab: 'issues',   icon: '',
                       label: it => `${it.drawing_number || '?'} · ${(it.description||'').slice(0,60)}`,
                       sub:   it => `${it.project_name} · ${it.days_open}d open` },
  fresh_queries:     { title: 'Drawing queries — open',       tab: 'queries',  icon: '💬',
                       label: it => `${it.drawing_number || '?'} · ${(it.description||'').slice(0,60)}`,
                       sub:   it => `${it.project_name} · ${it.days_open}d open` },
  open_flags:        { title: 'Site flags open',              tab: 'flags',    icon: '',
                       label: it => `${it.task_name||''} (${it.trade||''})`,
                       sub:   it => `${it.project_name} · ${(it.flag_note||'').slice(0,80)}` },
  overdue_materials: { title: 'Materials overdue',            tab: 'materials',icon: '📦',
                       label: it => it.item_name || it.material_name || 'Material',
                       sub:   it => `${it.project_name||''}` },
  pending_approvals: { title: 'Approvals pending',            tab: 'approvals',icon: '',
                       label: it => `${it.title||''} (${it.request_type||''})`,
                       sub:   it => `${it.project_name} · raised by ${it.raised_by_name||'—'}` },
  pending_changes:   { title: 'Change notices — signatures',  tab: 'changes',  icon: '🔄',
                       label: it => it.cn_number || `CN ${it.id||''}`,
                       sub:   it => `${it.project_name||''}` },
};

APP.showActionTriage = function(key) {
  const items = (APP._dashAC && APP._dashAC[key]) || [];
  const meta  = APP._dashTriageMeta[key];
  if (!meta) return APP.switchTab('dashboard');
  if (!items.length) { UI.toast('No items to review'); return; }

  const rowFor = (it) => {
    const label = UI.escapeText(meta.label(it));
    const sub   = UI.escapeText(meta.sub(it));
    const pid = it.project_id || APP.state.selectedProject || '';
    // For flags, also set flagFilterProject so the Flags tab pre-filters to this project
    const extraState = key === 'open_flags' ? `APP.state.flagFilterProject=${pid};` : '';
    // pending_approvals: route per request_type to the correct tab.
    // Drawing approvals no longer appear for principal (removed approvals.register call).
    // Other types: payment → payments tab, change → changes tab, fallback → pending.
    let navCall;
    if (key === 'pending_approvals') {
      const rt = it.request_type || '';
      const tabNav = rt.includes('payment') ? 'payments' :
                     rt.includes('change')  ? 'changes'  : 'pending';
      navCall = `APP._tryNav('${tabNav}')`;
    } else {
      navCall = `APP._tryNav('${meta.tab}')`;
    }
    return `
      <div class="triage-row">
        <div class="triage-row-icon">${meta.icon}</div>
        <div class="triage-row-body">
          <div class="triage-row-label">${label}</div>
          <div class="triage-row-sub">${sub}</div>
        </div>
        <button class="btn-sm navy" onclick="UI.closeModal();APP.state.selectedProject=${pid};${extraState}${navCall};">Review →</button>
      </div>`;
  };

  const html = `
    <div class="triage-body">
      <div class="triage-meta">${items.length} item${items.length===1?'':'s'} awaiting review</div>
      ${items.map(rowFor).join('')}
      <button class="btn-secondary" style="margin-top:12px;width:100%" onclick="UI.closeModal();">Close</button>
    </div>`;

  UI.openModal(meta.title, html);
};

// Override the existing renderDashboard to be role-aware
const _origRenderDashboard = APP.renderDashboard;
APP._dashGreeting = function() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
  const name = (APP.user?.full_name||'').split(' ')[0] || '';
  return `<div class="dash-greeting" style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--muted);letter-spacing:0.4px;text-transform:uppercase;margin-bottom:2px">${dateStr}</div>
    <div style="font-size:18px;font-weight:700;color:var(--navy)">${greeting}${name ? ', ' + name : ''}</div>
  </div>`;
};

APP.renderDashboard = async function() {
  const role = APP.user?.role;
  if (role === 'finance_admin') return APP.renderFinanceDashboard(); // has its own greeting
  let sub;
  if (role === 'site_manager' || role === 'senior_site_manager') sub = APP.renderSiteDashboard();
  else if (role === 'design_head' || role === 'services_head') sub = APP.renderDesignDashboard();
  else if (['team_lead','coordinator','jr_architect','services_engineer'].includes(role)) sub = APP.renderTeamDashboard();
  else sub = _origRenderDashboard.call(APP); // principal / design_principal
  try { await sub; } catch (e) { /* sub-render manages its own errors */ }
  const el = UI.contentEl();
  if (el && !el.querySelector('.dash-greeting')) el.insertAdjacentHTML('afterbegin', APP._dashGreeting());
};

// PMC DASHBOARD
APP.renderPMCDashboard = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const [dash, budget] = await Promise.all([
    API.get(`/dashboard?project_id=${pid}`),
    API.get(`/budget/${pid}/digest`),
  ]);

  if (!dash) return;
  const ac = dash.action_centre || {};

  let html = `<div class="sec-label">Today's Priorities</div>`;

  const addItem = (icon, title, meta, c, b, badge, tab) =>
    `<button class="action-item c-${c}" style="min-height:44px" onclick="APP.switchTab('${tab}')">
      <div class="ai-icon">${icon}</div>
      <div class="ai-body"><div class="ai-title">${title}</div><div class="ai-meta">${meta}</div></div>
      <span class="badge b-${b}">${badge}</span>
    </div>`;

  let hasItems = false;

  const proj_id = parseInt(pid, 10);
  const filterByPid = (arr) => (arr || []).filter(item => parseInt(item.project_id, 10) === proj_id);

  const pending_approvals = filterByPid(ac.pending_approvals);
  const overdue_queries = filterByPid(ac.overdue_queries);
  const open_flags = filterByPid(ac.open_flags);
  const overdue_materials = filterByPid(ac.overdue_materials);
  const pending_changes = filterByPid(ac.pending_changes);

  if (pending_approvals.length) { hasItems=true; html += addItem('✍️','Approvals Pending',`${pending_approvals.length} requests awaiting PMC sign-off`,'blue','blue',pending_approvals.length,'pending'); }
  if (overdue_queries.length)   { hasItems=true; html += addItem('','Design Queries Overdue',`${overdue_queries.length} queries blocked > 3 days`,'red','red',overdue_queries.length,'issues'); }
  if (open_flags.length)        { hasItems=true; html += addItem('🚩','Task Updates Flagged',`${open_flags.length} tasks marked delayed by site team`,'amber','orange',open_flags.length,'schedule'); }
  if (overdue_materials.length) { hasItems=true; html += addItem('','Materials Overdue',`${overdue_materials.length} material requests past needed date`,'amber','amber',overdue_materials.length,'materials'); }
  if (pending_changes.length)   { hasItems=true; html += addItem('','Changes Pending',`${pending_changes.length} change notices pending signature`,'blue','blue',pending_changes.length,'changes'); }
  if (budget?.has_alerts)       { hasItems=true; html += addItem('','Budget variance flagged','One or more heads over threshold','amber','amber','ALERT','budget'); }

  if (!hasItems) html += `<div class="card" style="text-align:center;padding:20px">
    <div style="font-size:24px;margin-bottom:8px"></div>
    <div style="font-size:13px;font-weight:600;color:var(--navy)">All clear</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px">No priority items today</div>
  </div>`;

  // Quick stats
  const projSummary = (dash.projects || []).find(p => parseInt(p.id, 10) === proj_id) || {};
  html += `<div class="sec-label">Project Snapshot</div>
  <div class="stat-row">
    <button class="stat-card" style="min-height:44px;cursor:pointer" onclick="APP.state.issuesViewMode='all';APP.state.selectedProjectFilter=APP.state.selectedProject;APP.switchTab('issues')">
      <span class="stat-val ${(projSummary.open_queries||0)>0?'red':'green'}">${projSummary.open_queries||0}</span>
      <span class="stat-lbl">Open Queries</span>
    </button>
    <button class="stat-card" style="min-height:44px;cursor:pointer" onclick="APP.switchTab('schedule')">
      <span class="stat-val">${projSummary.open_flags||0}</span>
      <span class="stat-lbl">Task Flags</span>
    </button>
    <button class="stat-card" style="min-height:44px;cursor:pointer" onclick="APP.switchTab('changes')">
      <span class="stat-val">${projSummary.open_changes||0}</span>
      <span class="stat-lbl">Open Changes</span>
    </button>
  </div>`;

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// SITE MANAGER DASHBOARD
APP.renderSiteDashboard = async function() {
  const el = UI.contentEl();
  // Only show active projects in the selector for site roles
  const activeProjects = APP._visibleProjects();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','No active project assigned'); return; }

  const today = APP.state.serverToday || UI.todayIST();

  // Fetch all three in parallel — schedule for tasks, dedicated endpoints for
  // issues/GRNs so counts are accurate even when no schedule version exists
  const [scheduleData, issuesData, grnsData] = await Promise.all([
    API.get(`/schedule/${pid}?date=${today}`).catch(() => null),
    API.get(`/issues/${pid}`).catch(() => null),
    API.get(`/grn/${pid}`).catch(() => null),
  ]);

  // Active tasks: tasks in today's schedule that are not yet 100%
  const activeTasks = scheduleData?.active_tasks_count
    ?? scheduleData?.tasks?.filter(t => (t.pct_complete ?? 0) < 100).length
    ?? 0;

  // Issues: open + in_progress from the issues register
  const openIssues = issuesData?.issues
    ? issuesData.issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
    : (scheduleData?.open_issues ?? 0);

  // GRNs: pending from the GRN list
  const pendingGRNs = grnsData?.grns
    ? grnsData.grns.filter(g => g.status === 'pending').length
    : (scheduleData?.pending_grns ?? 0);

  const projectName = activeProjects.find(p => String(p.id) === String(pid))?.name
    || APP.user?.project_name || APP.state.projectName || 'Site';

  const projSelector = activeProjects.length > 1
    ? `<select style="width:100%;margin-top:10px;padding:6px 10px;border:none;border-radius:var(--r);font-size:13px;font-weight:600;background:rgba(255,255,255,.15);color:var(--white);cursor:pointer;-webkit-appearance:none"
        onchange="APP.state.selectedProject=parseInt(this.value);APP._updateTopbar();APP.renderSiteDashboard()">
        ${activeProjects.map(p => `<option value="${p.id}" style="color:var(--text);background:var(--white)" ${String(p.id)===String(pid)?'selected':''}>${UI.escapeText(p.name)}</option>`).join('')}
      </select>`
    : '';

  let html = `
  <div class="card" style="margin-bottom:16px;background:var(--navy);border:none">
    <div style="color:rgba(255,255,255,.7);font-size:11px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
    <div style="color:var(--white);font-size:22px;font-weight:700;margin-top:4px">${UI.escapeText(projectName)}</div>
    ${projSelector}
  </div>

  <div class="stat-row">
    <button class="stat-card" onclick="APP.switchTab('tasks')">
      <span class="stat-val">${activeTasks}</span>
      <span class="stat-lbl">Active Tasks</span>
    </button>
    <button class="stat-card" onclick="APP.state.issuesViewMode='all';APP.state.selectedProjectFilter=APP.state.selectedProject;APP.switchTab('issues')">
      <span class="stat-val">${openIssues}</span>
      <span class="stat-lbl">Issues</span>
    </button>
    <button class="stat-card" onclick="APP.switchTab('grn')">
      <span class="stat-val">${pendingGRNs}</span>
      <span class="stat-lbl">GRNs</span>
    </button>
  </div>

  <div class="sec-label">Quick Actions</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <button class="action-card" onclick="APP.switchTab('tasks')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <span style="font-size:13px;font-weight:600">Update Tasks</span>
    </button>
    <button class="action-card" onclick="APP.switchTab('grn')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      <span style="font-size:13px;font-weight:600">Raise GRN</span>
    </button>
    <button class="action-card" onclick="APP.state.issuesViewMode='all';APP.state.selectedProjectFilter=APP.state.selectedProject;APP.switchTab('issues')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="font-size:13px;font-weight:600">Raise Issue</span>
    </button>
    <button class="action-card" onclick="APP.switchTab('issues_site')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 2l20 20"/><path d="M5.5 5.5L2 22l16.5-3.5"/><path d="M14 14l8-8"/><path d="M18 6l4-4"/></svg>
      <span style="font-size:13px;font-weight:600">Drawing Query</span>
    </button>
  </div>`;

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// DESIGN HEAD / SERVICES HEAD DASHBOARD
APP.renderDesignDashboard = async function() {
  const el = UI.contentEl();
  const data = await API.get('/dashboard');
  if (!data) return;

  const role = APP.user.role;
  const streamLabel = role === 'design_head' ? 'Design' : 'Services';
  const ac = data.action_centre || {};
  APP._dashAC = ac;

  // Deduplicate queries by id — a query can appear in both overdue and fresh
  const allQueryIds = new Set();
  const allQueries = [...(ac.overdue_queries || []), ...(ac.fresh_queries || [])].filter(q => {
    if (allQueryIds.has(q.id)) return false;
    allQueryIds.add(q.id);
    return true;
  });

  const pending = (ac.pending_approvals || []).slice(0, 5);
  const queries = allQueries.slice(0, 5);
  const pendingChanges = (ac.pending_changes || []);
  const totalPending = pending.length;
  const totalQueries = allQueries.length;
  const totalChanges = pendingChanges.length;

  // Summary stats row
  let html = `<div class="sec-label">Pending — ${streamLabel} Stream</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    <button class="stat-card" style="background:var(--navy);border-color:var(--navy);color:#fff" onclick="APP.switchTab('drawings')">
      <span class="stat-val" style="color:#fff;font-size:24px;font-weight:800">${totalPending}</span>
      <span class="stat-lbl" style="color:rgba(255,255,255,0.75)">Pending Review</span>
    </button>
    <button class="stat-card" style="background:var(--navy);border-color:var(--navy);color:#fff" onclick="APP.switchTab('issues')">
      <span class="stat-val" style="color:#fff;font-size:24px;font-weight:800">${totalQueries}</span>
      <span class="stat-lbl" style="color:rgba(255,255,255,0.75)">Queries Open</span>
    </button>
    <button class="stat-card" style="background:var(--navy);border-color:var(--navy);color:#fff" onclick="APP.showActionTriage('pending_changes')">
      <span class="stat-val" style="color:#fff;font-size:24px;font-weight:800">${totalChanges}</span>
      <span class="stat-lbl" style="color:rgba(255,255,255,0.75)">CNs Pending</span>
    </button>
  </div>`;

  if (!totalPending && !totalQueries && !totalChanges) {
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:20px;text-align:center;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;color:var(--green)">All clear — nothing pending</div>
    </div>`;
  }

  if (pending.length) {
    html += `<div class="sec-label">Drawings Pending Review</div>`;
    html += pending.map(p => `
    <button class="action-item c-amber" style="min-height:52px;width:100%;text-align:left" onclick="APP.switchTab('drawings')">
      <div class="ai-icon" style="font-size:16px;flex-shrink:0">📐</div>
      <div class="ai-body">
        <div class="ai-title">${UI.escapeText(p.drawing_number||p.title||'Drawing')} — ${UI.escapeText(p.drawing_name||p.request_type||'')}</div>
        <div class="ai-meta">${UI.escapeText(p.project_name||'—')}</div>
      </div>
      <span class="badge b-amber" style="flex-shrink:0">Review</span>
    </button>`).join('');
  }

  if (queries.length) {
    html += `<div class="sec-label">Drawing Queries</div>`;
    html += queries.map(q => {
      const isOverdue = (q.days_open || 0) >= 3;
      const pid = q.project_id || 0;
      return `<button class="action-item c-${isOverdue?'red':'amber'}" style="min-height:52px;width:100%;text-align:left" onclick="if(${pid})APP.state.selectedProject=${pid},APP._updateTopbar();APP.switchTab('issues')">
      <div class="ai-icon" style="font-size:16px;flex-shrink:0">${isOverdue?'🔴':'🟡'}</div>
      <div class="ai-body">
        <div class="ai-title">${UI.escapeText(q.drawing_number||'—')} — ${UI.escapeText((q.description||'').slice(0,60))}</div>
        <div class="ai-meta">${UI.escapeText(q.project_name||'—')} · ${q.days_open||0}d open</div>
      </div>
      <span class="badge b-${isOverdue?'red':'amber'}" style="flex-shrink:0">${isOverdue?'Overdue':'Open'}</span>
    </button>`;
    }).join('');
  }

  if (pendingChanges.length) {
    html += `<button class="action-item c-blue" style="min-height:52px;width:100%;text-align:left" onclick="APP.showActionTriage('pending_changes')">
      <div class="ai-icon" style="font-size:16px;flex-shrink:0">📝</div>
      <div class="ai-body"><div class="ai-title">Change notices — signatures pending</div><div class="ai-meta">${totalChanges} need sign-off</div></div>
      <span class="badge b-blue" style="flex-shrink:0">SIGN</span>
    </button>`;
  }

  // Active projects for this head
  const projects = (data.projects || []).filter(p => p.status === 'active');
  if (projects.length) {
    html += `<div class="sec-label" style="margin-top:16px">Active Projects (${projects.length})</div>`;
    html += `<div class="projects-grid">`;
    projects.forEach(p => { html += APP.projectCard(p, true); });
    html += `</div>`;
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// FINANCE DASHBOARD
APP.renderFinanceDashboard = async function() {
  const el = UI.contentEl();
  el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">Loading brief…</div>';

  const now  = new Date();
  const isSaturday = now.getDay() === 6;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  const brief = await API.get('/finance/morning-brief').catch(() => null);

  // ── Quick-action grid (always visible)
  const quickGrid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px">
    <button class="action-card" style="background:var(--navy) !important;border-color:var(--navy) !important;color:#fff !important" onclick="APP.switchTab('payments_fin')">
      <svg style="width:22px;height:22px;margin-bottom:5px;color:#fff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      <span style="font-size:12px;font-weight:600">Payments</span>
    </button>
    <button class="action-card" style="background:var(--navy) !important;border-color:var(--navy) !important;color:#fff !important" onclick="APP.switchTab('pi')">
      <svg style="width:22px;height:22px;margin-bottom:5px;color:#fff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      <span style="font-size:12px;font-weight:600">Invoices</span>
    </button>
    <button class="action-card" style="background:var(--navy) !important;border-color:var(--navy) !important;color:#fff !important" onclick="APP.switchTab('petty_cash')">
      <svg style="width:22px;height:22px;margin-bottom:5px;color:#fff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      <span style="font-size:12px;font-weight:600">Petty Cash</span>
    </button>
    <button class="action-card" style="background:var(--navy) !important;border-color:var(--navy) !important;color:#fff !important" onclick="APP.renderTallyExport?.();APP.currentTab='tally'">
      <svg style="width:22px;height:22px;margin-bottom:5px;color:#fff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2v20l8-4 8 4V2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="14" y2="12"/></svg>
      <span style="font-size:12px;font-weight:600">Tally Export</span>
    </button>
  </div>`;

  let html = `
  <div style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--muted);letter-spacing:0.4px;text-transform:uppercase;margin-bottom:2px">${dateStr}</div>
    <div style="font-size:18px;font-weight:700;color:var(--navy)">${greeting}, ${(APP.user?.full_name||'').split(' ')[0] || 'Finance'}</div>
  </div>`;

  if (!brief) {
    html += quickGrid;
    el.innerHTML = `<div class="fade-in">${html}</div>`;
    return;
  }

  // ── Saturday ICICI alert
  if (isSaturday && hour >= 17 && brief.pending_payments > 0) {
    html += `<div style="background:rgba(29,61,98,0.08);border:1px solid rgba(29,61,98,0.2);border-radius:10px;padding:14px 16px;margin-bottom:14px;cursor:pointer" onclick="APP.switchTab('payments_fin')">
      <div style="font-size:11px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Payment Batch Ready</div>
      <div style="font-size:13px;color:var(--text)">${brief.pending_payments} approved payment${brief.pending_payments>1?'s':''} pending ICICI upload</div>
    </div>`;
  }

  // ── Stat pills row
  const _statPill = (label, value, sub, color, tab) => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:${tab?'pointer':'default'}"
      ${tab ? `onclick="APP.switchTab('${tab}')"` : ''}>
      <div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">${label}</div>
      <div style="font-size:20px;font-weight:800;color:${color};font-family:var(--mono)">${value ?? '—'}</div>
      ${sub ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${sub.replace(/undefined/g,'0')}</div>` : ''}
    </div>`;

  const pendingColor = brief.pending_payments > 0 ? 'var(--amber)' : 'var(--green)';
  const overdueColor = brief.overdue_pi > 0 ? 'var(--red)' : 'var(--green)';

  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
    ${_statPill('Pending Batch', brief.pending_payments, 'approved, awaiting ICICI', pendingColor, 'payments_fin')}
    ${_statPill('Overdue PIs', brief.overdue_pi, 'past due date', overdueColor, 'pi')}
    ${_statPill("Today's Requests", brief.today_requests, `+ ${brief.today_urgent} urgent`, 'var(--navy)', 'payments_fin')}
    ${_statPill('Petty Cash Today', brief.today_petty_count > 0 ? Money.formatRupee(brief.today_petty_total) : '—', brief.today_petty_count > 0 ? `${brief.today_petty_count} transaction${brief.today_petty_count>1?'s':''}` : 'No spends', 'var(--text)', 'petty_cash')}
  </div>`;

  html += quickGrid;

  // ── Recent payment requests
  if (brief.recent_requests?.length) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Recent Payment Requests</div>`;
    brief.recent_requests.forEach(r => {
      const badge = r.status === 'approved' ? 'b-green' : r.status === 'pending' ? 'b-amber' : r.status === 'rejected' ? 'b-red' : 'b-silver';
      const typeLabel = (r.payment_type||'').replace(/_/g,' ');
      html += `<div class="card" style="padding:10px 14px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(r.vendor_name||'—')} <span style="color:var(--muted);font-weight:400">· ${UI.escapeText(r.project_name||'')}</span></div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">${typeLabel} · ${UI.fmtDate(r.created_at)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--navy)">${Money.formatRupee(r.amount_requested)}</span>
            <span class="badge ${badge}">${r.status}</span>
          </div>
        </div>
      </div>`;
    });
  }

  // ── Recent petty cash
  if (brief.recent_petty?.length) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 8px">Recent Petty Cash</div>`;
    brief.recent_petty.forEach(p => {
      html += `<div class="card" style="padding:10px 14px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.escapeText(p.description||'—')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">${UI.escapeText(p.project_name||'')} · ${p.category||'other'} · ${UI.fmtDate(p.txn_date)}</div>
          </div>
          <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--red);flex-shrink:0">-${Money.formatRupee(p.amount)}</span>
        </div>
      </div>`;
    });
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// TEAM LEAD / COORDINATOR / JR ARCHITECT / SERVICES ENGINEER / DETAILING HEAD DASHBOARD
// Project-scoped roles: shows their assigned active projects + relevant action items.
APP.renderTeamDashboard = async function() {
  const el = UI.contentEl();
  el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">Loading…</div>';

  const data = await API.get('/dashboard');
  if (!data) return;

  const role = APP.user?.role;
  const ac = data.action_centre || {};
  const projects = (data.projects || []).filter(p => p.status === 'active');
  const overdueQ = ac.overdue_queries || [];
  const freshQ   = ac.fresh_queries   || [];
  const allQ     = [...overdueQ, ...freshQ];

  let html = '';

  // Coordinator: their main job is meetings, tasks, GRN — show quick-action shortcuts
  if (role === 'coordinator') {
    html += `<div class="sec-label">Quick Actions</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <button class="action-card" onclick="APP.switchTab('meetings')">
        <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style="font-size:13px;font-weight:600">Meetings</span>
      </button>
      <button class="action-card" onclick="APP.switchTab('tasks')">
        <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span style="font-size:13px;font-weight:600">Tasks</span>
      </button>
      <button class="action-card" onclick="APP.state.issuesViewMode='all';APP.state.selectedProjectFilter=APP.state.selectedProject;APP.switchTab('issues')">
        <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style="font-size:13px;font-weight:600">Issues</span>
      </button>
      <button class="action-card" onclick="APP.switchTab('grn')">
        <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <span style="font-size:13px;font-weight:600">GRN</span>
      </button>
    </div>`;
  }

  // All team roles: show drawing queries if any
  if (allQ.length) {
    html += `<div class="sec-label">Drawing Queries</div>`;
    allQ.slice(0, 6).forEach(q => {
      const isOverdue = (q.days_open || 0) >= 3;
      const qPid = q.project_id || 0;
      html += `<button class="action-item c-${isOverdue?'red':'amber'}" style="min-height:52px;width:100%;text-align:left" onclick="if(${qPid})APP.state.selectedProject=${qPid},APP._updateTopbar();APP.switchTab('issues')">
        <div class="ai-icon" style="font-size:16px;flex-shrink:0">${isOverdue?'🔴':'🟡'}</div>
        <div class="ai-body">
          <div class="ai-title">${q.drawing_number||'—'} — ${(q.description||'').slice(0,60)}</div>
          <div class="ai-meta">${q.project_name||'—'} · ${q.days_open||0}d open</div>
        </div>
        <span class="badge b-${isOverdue?'red':'amber'}" style="flex-shrink:0">${isOverdue?'Overdue':'Open'}</span>
      </button>`;
    });
  } else if (role !== 'coordinator') {
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:16px;text-align:center;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;color:var(--green)">No open queries</div>
    </div>`;
  }

  // Active projects assigned
  if (projects.length) {
    html += `<div class="sec-label" style="margin-top:16px">Active Projects (${projects.length})</div>`;
    html += `<div class="projects-grid">`;
    projects.forEach(p => { html += APP.projectCard(p, true); });
    html += `</div>`;
  } else {
    html += `<div class="sec-label" style="margin-top:16px">Projects</div>`;
    html += UI.empty('','No active projects assigned');
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── MODAL OVERLAY CLICK — close on backdrop tap
APP.modalOverlayClick = function(e) {
  if (e.target === document.getElementById('modal-overlay')) {
    APP.closeModal();
  }
};

// ── WHO + WHERE in topbar (Fix 4, video review) ──
// Shows: "Principal · Principal" on line 1, project name on line 2.
// tb-ctx uses innerHTML so both lines render.
APP._updateTopbar = function() {
  const ctx = document.getElementById('tb-ctx');
  if (!ctx) return;
  const projects = APP.user?.projects || [];
  const pid = APP.state.selectedProject;
  const proj = projects.find(p => String(p.id) === String(pid));
  const projName = proj ? proj.name.split(' ').slice(0,3).join(' ') : (projects.length > 0 ? 'Select Project' : '—');

  const firstName = (APP.user?.full_name || '').split(' ')[0] || '';
  const roleLabel = APP._roleLabel(APP.user?.role || '');
  const who = firstName && roleLabel ? `${firstName} · ${roleLabel}` : (firstName || roleLabel || '');

  ctx.innerHTML = `
    <div class="tb-who">${who}</div>
    <div class="tb-proj">${projName}</div>`;

  APP._updateRoleSwitcher();
};

// Role switcher dropdown — visible only to Principal (real role).
// Selecting a role sudoes into it; selecting Principal again returns home.
APP.IMPERSONATABLE_ROLES = [
  'principal','design_principal','design_head','team_lead','services_head',
  'jr_architect','jr_engineer','services_engineer','coordinator',
  'pmc_head','site_manager','senior_site_manager','finance_admin','trainee',
  'audit','it_admin'
];

APP._roleLabel = function(role) {
  if (role === 'it_admin') return 'IT Admin';
  if (role === 'jr_engineer') return 'Jr Engineer';
  if (role === 'jr_architect') return 'Jr Architect';
  return (role || '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
};

APP._updateRoleSwitcher = function() {
  const sel = document.getElementById('tb-role');
  if (!sel) return;
  const realRole = APP.user?.real_role || APP.user?.role;
  if (realRole !== 'principal') { sel.style.display = 'none'; return; }

  const current = APP.user?.role || 'principal';
  if (sel.dataset.populated !== '1') {
    sel.innerHTML = APP.IMPERSONATABLE_ROLES.map(r =>
      `<option value="${r}">${APP._roleLabel(r)}</option>`
    ).join('');
    sel.dataset.populated = '1';
  }
  sel.value = current;
  sel.style.display = '';
  sel.classList.toggle('is-impersonating', !!APP.user?.real_role);
};

// Switch principal's effective role server-side, then reload UI to dashboard.
APP.switchActingRole = async function(role) {
  if (!role) return;
  const realRole = APP.user?.real_role || APP.user?.role;
  if (realRole !== 'principal') return;
  if (role === APP.user?.role) return;       // no-op

  try {
    const isReturn = role === 'principal' && !!APP.user?.real_role;
    const res = isReturn
      ? await API.post('/auth/end-impersonation')
      : await API.post('/auth/impersonate', { role });
    if (!res?.user) throw new Error('No user returned');
    APP.user = res.user;
  } catch (e) {
    UI.toast('Could not switch role: ' + (e?.message || 'unknown'));
    APP._updateRoleSwitcher();   // restore dropdown to current state
    return;
  }

  // Reset nav cache + active bucket so the new role's nav is fetched
  // and we land on its first tab (dashboard, for every non-strip role).
  APP._nav = null;
  APP._activeBucket = null;
  APP.currentTab = null;
  APP._needsYou = null;
  APP._needsYouAt = null;
  APP._todayReport = null;
  APP._todayReportAt = null;
  APP._updateTopbar();
  await APP.buildTabs();
};

// ── DEEP-LINK HANDLER — parse /#tab?project=PID&item=ITEMID
APP.handleHashRoute = function() {
  const hash = location.hash || '';
  if (!hash.length) return;
  // Format: #tab or #tab?project=X&item=Y
  const parts    = hash.substring(1).split('?');
  const tab      = parts[0];
  const params   = new URLSearchParams(parts[1] || '');
  const project  = params.get('project');
  const itemId   = params.get('item');

  if (!tab) return;

  // Set project if specified
  if (project && APP.state) {
    APP.state.selectedProject = parseInt(project);
    if (APP._updateTopbar) APP._updateTopbar();
  }

  // Set item to highlight
  if (itemId) APP.state.highlightItemId = parseInt(itemId);

  // Switch to tab
  if (APP.switchTab && tab) {
    setTimeout(() => APP.switchTab(tab), 100); // wait for app init
  }
};
window.addEventListener('hashchange', APP.handleHashRoute);
window.addEventListener('load', () => {
  if (location.hash && APP.user) APP.handleHashRoute();
});

// Update render map with newly added functions
{
  const el = document.getElementById; // just to scope
  const origRender = APP.render;
  APP.render = function(id) {
    try {
      return APP._renderInternal(id);
    } catch (err) {
      console.error('[Render error]', id, err);
      const el = UI.contentEl();
      if (el) el.innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠️</div>
          <div class="empty-text">
            Something went wrong loading this screen.<br>
            <button class="btn-primary" style="margin-top:12px" onclick="APP.render('${id}')">Retry</button>
          </div>
        </div>`;
    }
  };
  APP._renderInternal = function(id) {
    const extra = {
      notifications:        APP.renderNotifications,
      ncr:                  APP.renderNCR,
      submittals:           APP.renderSubmittals,
      weekly_health:        APP.renderWeeklyHealth,
      compliance:           APP.renderScheduleCompliance,
      project_detail:       APP.renderProjectDetail,
      client_receipts:      APP.renderClientReceipts,
      tally:                APP.renderTallyExport,
      gst_statement:        APP.renderGSTStatement,
      boq_mapping:          APP.renderBOQMapping,
      budget_tree:          APP.renderBudgetTree,
    };
    if (extra[id]) {
      const el2 = UI.contentEl();
      if (el2) UI.loading(el2);
      extra[id]();
    } else {
      origRender.call(APP, id);
    }
  };
}

// ═══════════════════════════════════════════════
// GST STATEMENT, BOQ MAPPING, BUDGET TREE SCREENS
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// GST STATEMENT, BOQ MAPPING, BUDGET TREE SCREENS
// ═══════════════════════════════════════════════

APP.renderGSTStatement = async function() {
  const el = UI.contentEl();
  const now = new Date();
  const defaultMonth = now.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}).substring(0,7);
  el.innerHTML = `<div class="fade-in">
    <div class="sec-label">Monthly GST Statement</div>
    <div class="card" style="margin-bottom:16px">
      <div class="field-row"><label class="field-label" for="gst-month">Month</label>
        <input type="month" id="gst-month" value="${defaultMonth}" max="${defaultMonth}"></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn-primary" onclick="APP.loadGSTStatement()">View</button>
        <button class="btn-secondary" onclick="APP.downloadGSTStatement()">Excel</button>
      </div>
    </div>
    <div id="gst-results"></div>
  </div>`;
};

APP.loadGSTStatement = async function() {
  const month = document.getElementById('gst-month')?.value;
  if (!month) { UI.toast('Select a month'); return; }
  const pid = APP.state.selectedProject;
  const params = new URLSearchParams({month});
  if (pid) params.set('project_id', pid);
  const el = document.getElementById('gst-results');
  UI.loading(el);
  const data = await API.get('/gst-statement?' + params.toString());
  if (!data || data.error) { el.innerHTML = UI.empty('', data?.error||'No data'); return; }
  const fmt = n => Money.formatRupee(n||0, 2);
  const t = data.totals;
  let html = `
  <div class="stat-row" style="grid-template-columns:1fr 1fr 1fr">
    <div class="stat-card"><span class="stat-val">${fmt(t.payments.total)}</span><span class="stat-lbl">Paid w/ GST</span></div>
    <div class="stat-card"><span class="stat-val">${fmt(t.advances.total)}</span><span class="stat-lbl">Advances</span></div>
    <div class="stat-card"><span class="stat-val">${fmt(t.receipts.total)}</span><span class="stat-lbl">Received</span></div>
  </div>
  <div class="sec-label">GST Summary</div>
  <div class="card">
    <div class="prog-row"><div class="prog-label">Taxable</div><div style="font-family:var(--mono);font-size:12px">${fmt(t.payments.taxable)}</div></div>
    <div class="prog-row"><div class="prog-label">CGST</div><div style="font-family:var(--mono);font-size:12px">${fmt(t.payments.cgst)}</div></div>
    <div class="prog-row"><div class="prog-label">SGST</div><div style="font-family:var(--mono);font-size:12px">${fmt(t.payments.sgst)}</div></div>
    <div class="prog-row"><div class="prog-label">IGST</div><div style="font-family:var(--mono);font-size:12px">${fmt(t.payments.igst)}</div></div>
  </div>`;
  if (data.hsn_summary?.length) {
    html += '<div class="sec-label">HSN-wise</div>';
    data.hsn_summary.forEach(h => {
      html += `<div class="card"><div style="display:flex;justify-content:space-between">
        <div><div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--navy)">${h.hsn}</div>
        <div style="font-size:11px;color:var(--muted)">GST ${h.rate}% · ${h.count} txn</div></div>
        <div style="text-align:right"><div style="font-family:var(--mono);font-size:12px">${fmt(h.taxable)}</div>
        <div style="font-size:10px;color:var(--muted)">taxable</div></div></div></div>`;
    });
  }
  if (data.payments?.length) {
    html += `<div class="sec-label">Payments (${data.payments.length})</div>`;
    data.payments.forEach(p => {
      html += `<div class="pay-item"><div style="display:flex;justify-content:space-between">
        <div><div class="pay-vendor">${p.vendor}</div>
        <div class="pay-meta">${UI.fmtDate(p.date)} · ${p.type} · HSN ${p.hsn}</div>
        <div class="pay-meta">CGST ${fmt(p.cgst)} · SGST ${fmt(p.sgst)}${p.igst?(' · IGST '+fmt(p.igst)):''}</div></div>
        <div class="pay-amount">${fmt(p.total)}</div></div></div>`;
    });
  }
  if (data.advances?.length) {
    html += `<div class="sec-label">Advances (no GST)</div>`;
    data.advances.forEach(a => {
      html += `<div class="pay-item" style="opacity:.75"><div style="display:flex;justify-content:space-between">
        <div><div class="pay-vendor">${a.vendor}</div><div class="pay-meta">${UI.fmtDate(a.date)} · ${a.type}</div></div>
        <div class="pay-amount">${fmt(a.amount)}</div></div></div>`;
    });
  }
  el.innerHTML = html;
};

APP.downloadGSTStatement = function() {
  const month = document.getElementById('gst-month')?.value;
  if (!month) { UI.toast('Select a month first'); return; }
  const pid = APP.state.selectedProject;
  let url = '/api/gst-statement?month=' + month + '&format=excel';
  if (pid) url += '&project_id=' + pid;
  window.open(url, '_blank');
};

// ── BOQ MAPPING
APP.renderBOQMapping = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('', 'Select a project first'); return; }
  const data = await API.get('/boq-mapping/' + pid);
  if (!data) return;
  const { engagements = [], unmapped_count = 0, mappings = [] } = data;
  const canInitiate = ['principal','design_principal','pmc_head','design_head','services_head'].includes(APP.user?.role);
  let html = APP._projectSelectHtml('APP.renderBOQMapping()') + `
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">BOQ to Vendor Mapping</div>
    <div class="card-meta">${unmapped_count} unmapped BOQ items · ${engagements.length} engagements</div>
    <button class="btn-primary" style="margin-top:10px" onclick="APP.runBOQSuggest('${pid}')">AI Suggest Mappings</button>
  </div>`;
  if (APP.state.boqSuggestions?.length) {
    html += '<div class="sec-label">AI Suggestions</div>';
    APP.state.boqSuggestions.forEach((s,i) => {
      const eng = engagements.find(e => e.id === s.engagement_id);
      if (!eng) return;
      html += `<div class="card" style="border-left:3px solid var(--navy)">
        <div class="card-title">${eng.vendor_name}</div>
        <div class="card-meta">${(eng.scope||'').substring(0,60)} · ${Math.round((s.confidence||0)*100)}%</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${s.reason||''}</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn-approve" onclick="APP.confirmBOQMapping(${JSON.stringify(s).replace(/"/g,'&quot;')},${i})">Confirm</button>
          <button class="btn-reject" onclick="APP.dismissBOQSuggestion(${i})">Dismiss</button>
        </div></div>`;
    });
  }
  html += `<div class="sec-hdr-row" style="margin-bottom:8px">
    <div class="sec-label" style="margin:0;flex:1">Engagements</div>
    ${canInitiate ? `<button class="btn-sm navy" onclick="APP._vendorRefresh=APP.renderBOQMapping;APP.showEngageVendor(${pid})">+ Engage Vendor</button>
      <button class="btn-sm navy" style="margin-left:6px" onclick="APP._vendorRefresh=APP.renderBOQMapping;APP.showEngagementBulkUpload(${pid})">Bulk Upload</button>` : ''}
  </div>`;
  engagements.forEach(e => {
    const em = mappings.filter(m => m.engagement_id === e.id);
    html += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="flex:1"><div class="card-title">${e.vendor_name}</div>
      <div class="card-meta">${(e.scope||'').substring(0,60)}</div>
      ${em.length ? '<div style="font-size:11px;color:var(--green);margin-top:4px">Mapped: '+em.map(m=>m.item_name).join(', ')+'</div>'
                  : '<div style="font-size:11px;color:var(--amber);margin-top:4px">Not mapped</div>'}
      </div>
      <button class="btn-sm navy" onclick="APP.showManualBOQMap(${e.id},'${pid}')">Map</button>
    </div></div>`;
  });
  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.runBOQSuggest = async function(pid) {
  UI.toast('Getting AI suggestions…');
  const res = await API.post('/boq-mapping/' + pid + '/suggest', {});
  APP.state.boqSuggestions = res?.suggestions || [];
  UI.toast(APP.state.boqSuggestions.length ? APP.state.boqSuggestions.length + ' suggestions ready' : 'No suggestions — map manually');
  APP.renderBOQMapping();
};

APP.confirmBOQMapping = async function(s, i) {
  const pid = APP.state.selectedProject;
  const res = await API.post('/boq-mapping/' + pid, {engagement_id:s.engagement_id, boq_item_ids:s.boq_item_ids, ai_suggested:true, ai_confidence:s.confidence});
  if (res?.success) { APP.state.boqSuggestions?.splice(i,1); UI.toast('Saved ✓'); APP.renderBOQMapping(); }
};

APP.dismissBOQSuggestion = function(i) {
  APP.state.boqSuggestions?.splice(i,1);
  APP.renderBOQMapping();
};

APP.showManualBOQMap = async function(engId, pid) {
  const data = await API.get('/boq-mapping/' + pid);
  if (!data) return;
  const items = (data.boq_items||[]).filter(b => !b.is_section || b.is_section === '0' || b.is_section === 0);
  const eng = (data.engagements||[]).find(e => e.id === engId);
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-title">Map BOQ Items <button class="btn-close" onclick="APP.closeModal()">x</button></button>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">${eng?.vendor_name} — ${(eng?.scope||'').substring(0,50)}</div>
    <div style="max-height:280px;overflow-y:auto">
      ${items.map(item => `<label style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer">
        <input type="checkbox" value="${item.id}" style="accent-color:var(--navy)">
        <div><div style="font-size:12px;font-weight:500">${item.item_name}</div>
        <div style="font-size:10px;color:var(--muted)">${item.trade}${item.parent_name?' · '+item.parent_name:''}</div></div>
      </label>`).join('')}
    </div>
    <button class="btn-primary" style="margin-top:12px" onclick="APP.saveManualBOQMap(${engId},'${pid}')">Save</button>`;
};

APP.saveManualBOQMap = async function(engId, pid) {
  const checked = [...document.querySelectorAll('#modal-body input[type=checkbox]:checked')].map(cb => parseInt(cb.value));
  if (!checked.length) { UI.toast('Select at least one item'); return; }
  const res = await API.post('/boq-mapping/' + pid, {engagement_id:engId, boq_item_ids:checked});
  if (res?.success) { APP.closeModal(); UI.toast(res.saved + ' items mapped'); APP.renderBOQMapping(); }
  else { UI.toast(res?.error || 'Failed to save mapping'); }
};

// ── BUDGET TREE — drill-down view. Accessed from:
//   - Budget tab with Drill-down toggle (most roles)
//   - budget_tree tab directly (Audit role only)
APP.renderBudgetTree = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('', 'Select a project first'); return; }
  const data = await API.get('/budget/' + pid + '/tree');
  if (!data) return;
  const tree = data.tree || [];
  const fmt = n => Money.formatRupee(n||0);
  let html = APP._projectSelectHtml('APP.renderBudgetTree()') + APP._budgetToggleHTML() + '<div class="sec-label">Budget — Committed vs Sanctioned</div>';
  if (!tree.length) { html += UI.empty('', 'No budget data yet'); }
  tree.forEach(trade => {
    const sc = trade.status === 'critical'||trade.status === 'over' ? 'red' : trade.status === 'watch' ? 'amber' : 'green';
    const pct = trade.sanctioned > 0 ? Math.min((trade.committed/trade.sanctioned*100),100).toFixed(0) : 0;
    html += `<div class="card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div><div style="font-weight:600;font-size:13px;color:var(--navy)">${trade.name||trade.trade}</div>
        <div style="font-size:10px;color:var(--muted)">${trade.stream||''}</div></div>
        <div style="text-align:right"><div style="font-family:var(--mono);font-size:12px;font-weight:600">${fmt(trade.committed)}</div>
        <div style="font-size:10px;color:var(--muted)">of ${fmt(trade.sanctioned)}</div></div>
      </div>
      <div style="background:var(--bg);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px">
        <div style="background:var(--${sc});height:100%;width:${pct}%;border-radius:4px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px">
        <span style="color:var(--muted)">${pct}% committed</span>
        <span class="badge b-${sc}">${trade.variance >= 0?'+':''}${fmt(trade.variance)}</span>
      </div>
      ${trade.sections?.length ? '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">' +
        trade.sections.map(sec =>
          '<div style="margin-bottom:4px"><div style="font-size:11px;font-weight:600;color:var(--text2)">'+sec.item_name+
          (parseFloat(sec.section_committed)>0?'<span style="font-family:var(--mono);font-size:10px;float:right;color:var(--navy)">'+fmt(sec.section_committed)+'</span>':'')+
          '</div>' +
          (sec.children||[]).map(ch =>
            '<div style="display:flex;justify-content:space-between;padding:2px 0 2px 12px;font-size:11px;border-bottom:1px solid var(--bg)">'+
            '<span style="color:var(--text2)">'+ch.item_name+'</span>'+
            '<span style="font-family:var(--mono);color:'+(parseFloat(ch.committed)>0?'var(--navy)':'var(--muted)')+'">'+
            (parseFloat(ch.committed)>0?fmt(ch.committed):'—')+'</span></div>'
          ).join('')+'</div>'
        ).join('')+'</div>' : ''}
    </div>`;
  });
  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ═══════════════════════════════════════════════════════════════════════════
// M01 AUDIT (v3.1) — VENDOR MASTER & FINANCE CLEARANCE SCREENS
// ═══════════════════════════════════════════════════════════════════════════

// ── Vendor Master tab — upload Excel, review AI flags, submit to finance
APP.renderVendorsMaster = async function() {
  const el = UI.contentEl();
  UI.loading(el);

  const res = await API.call('GET', '/vendors/master');
  const vendors = (res?.vendors || []);
  const pending   = vendors.filter(v => v.clearance_status === 'pending');
  const cleared   = vendors.filter(v => v.clearance_status === 'cleared');
  const rejected  = vendors.filter(v => v.clearance_status === 'rejected');

  let html = `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">Add / Upload Vendors</div>
      <div class="card-meta">Vendor fills the Excel template → you upload → AI validates → finance clears.</div>
      <div class="vendor-actions">
        <a href="/templates/nu_PMC_BulkUpload_Templates_v1.xlsx" download>
          <button class="btn-secondary">Download Template</button>
        </a>
        <label>
          <input type="file" accept=".xlsx,.xls" style="display:none" onchange="APP.uploadVendorExcel(this)">
          <button class="btn-primary" onclick="this.previousElementSibling.click()">Upload Filled Excel</button>
        </label>
        <button class="btn-secondary" onclick="APP.showAddVendorMasterModal()">+ Add Single Vendor</button>
      </div>
    </div>`;

  if (pending.length) {
    html += `<div class="sec-label" style="color:#C8A040">⏳ Pending finance clearance (${pending.length})</div>`;
    pending.forEach(v => { html += APP._vendorMasterCard(v, 'pending'); });
  }
  if (cleared.length) {
    html += `<div class="sec-label" style="margin-top:14px">✓ Cleared (${cleared.length})</div>`;
    cleared.forEach(v => { html += APP._vendorMasterCard(v, 'cleared'); });
  }
  if (rejected.length) {
    html += `<div class="sec-label" style="margin-top:14px;color:#C87060">✗ Rejected (${rejected.length})</div>`;
    rejected.forEach(v => { html += APP._vendorMasterCard(v, 'rejected'); });
  }
  if (!vendors.length) html += UI.empty('','No vendors in master yet');

  el.innerHTML = html;
};

APP._vendorMasterCard = function(v, status) {
  const badgeColor = { pending:'b-amber', cleared:'b-green', rejected:'b-red' }[status];
  const badgeText  = status.toUpperCase();
  let flagsSummary = '';
  if (v.ai_flags) {
    try {
      const f = typeof v.ai_flags === 'string' ? JSON.parse(v.ai_flags) : v.ai_flags;
      if (f.overall && f.overall !== 'green') {
        const colour = f.overall === 'red' ? '#C87060' : '#C8A040';
        const notes = (f.notes || []).slice(0, 3).map(n => UI.escapeText(n)).join(' · ');
        flagsSummary = `<div style="font-size:11px;color:${colour};margin-top:4px">⚠ ${notes || f.overall}</div>`;
      }
    } catch (_) { /* malformed flags — skip */ }
  }
  // v5.24: vendor-side bank validation status — derived from
  // bank_validated_by_vendor + bank_validation_method. Three states:
  //   ✓ green  — vendor confirmed via Matrix or wa.me web form
  //   ⚠ amber  — not yet confirmed; payments will be blocked at ICICI step
  //   —        — no bank fields recorded yet (don't show chip)
  let validationChip = '';
  let canSendOnboard = false;
  if (v.bank_account || v.bank_ifsc) {
    if (v.bank_validated_by_vendor) {
      const method = v.bank_validation_method || '';
      const label = method === 'matrix' ? 'Matrix' : (method === 'wa_form' ? 'WhatsApp' : 'confirmed');
      validationChip = `<span class="badge b-green" style="margin-left:6px;font-size:10px">✓ Vendor confirmed (${label})</span>`;
    } else {
      validationChip = `<span class="badge b-amber" style="margin-left:6px;font-size:10px">⚠ Vendor not confirmed</span>`;
      canSendOnboard = !!v.phone;
    }
  }
  // The "Send onboarding via WhatsApp" button — only when phone present and
  // vendor not yet validated. Clicking it asks the backend to issue a token,
  // returns a wa.me URL, and we open it in a new tab/window so the internal
  // user can tap "Send" in their own WhatsApp app.
  const sendOnboardBtn = canSendOnboard
    ? `<button class="btn-secondary" style="font-size:11px;padding:4px 8px;margin-top:6px"
              onclick="APP.sendVendorOnboardLink(${v.id},'${UI.escapeAttr(v.vendor_name)}')">📱 Send onboarding via WhatsApp</button>`
    : '';
  return `
    <div class="card" style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-title">${UI.escapeText(v.vendor_name)}${validationChip}</div>
          <div class="card-meta">${UI.escapeText(v.trade||'')} · ${UI.escapeText(v.gst_number||'no GSTIN')}${v.phone?' · '+UI.escapeText(v.phone):''}</div>
          ${flagsSummary}
          ${status === 'rejected' && v.rejection_reason ? `<div style="font-size:11px;color:#C87060;margin-top:3px">Reason: ${UI.escapeText(v.rejection_reason)}</div>` : ''}
          ${sendOnboardBtn}
        </div>
        <span class="badge ${badgeColor}">${badgeText}</span>
      </div>
    </div>`;
};

// v5.24: issue a wa.me onboarding link and open it in a new tab.
//
// Backend issues the token + builds the wa.me URL. We open the wa.me URL in
// a new tab so the internal user's WhatsApp client takes over from there.
// They review the message, tap Send. The vendor receives the message with
// a link to /vendor-onboard/:token. They tap that, see the form, confirm.
APP.sendVendorOnboardLink = async function(vendorId, vendorName, purpose) {
  // `purpose` selects the message preamble built server-side via wa-link.buildOnboardLink.
  // Defaults to 'onboard' (initial onboarding) but callers can pass 'bank_confirm'
  // for vendor-side bank verification, or 're_validation' for periodic re-validation.
  // Same wa.me link mechanism in all cases — only the message text differs.
  purpose = purpose || 'onboard';
  const labelMap = {
    onboard:       'onboarding',
    bank_confirm:  'bank confirmation',
    re_validation: 're-validation',
  };
  const flow = labelMap[purpose] || purpose;
  // The confirm dialog appears BEFORE the API call so we don't yet have the
  // env-driven validity string. Default to '48h' (the build-commit lock) but
  // mark in comments that the actual validity comes back in the API response
  // and is shown in the post-send toast below.
  const ok = await UI.confirm(
    `Send ${flow} link to ${vendorName}?\n\nThis opens WhatsApp on your phone with a pre-written message. Review then tap Send. The vendor will receive a confirmation link with the validity shown after sending (default 48 hours).`
  );
  if (!ok) return;
  const res = await API.call('POST', `/vendors/master/${vendorId}/onboard-link`, { purpose });
  if (!res?.success) {
    UI.toast(res?.error || 'Could not generate link');
    return;
  }
  // Open wa.me URL — on mobile this hands off to WhatsApp; on desktop it
  // opens WhatsApp Web. Either way the user reviews + sends manually.
  if (res.wa_url) {
    window.open(res.wa_url, '_blank', 'noopener');
    const validity = res.validity || '48h';
    UI.toast(`WhatsApp opened — review the message and tap Send. Link valid ${validity}.`);
  } else {
    UI.toast('Token issued but WhatsApp URL could not be built.');
  }
};

APP.uploadVendorExcel = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('vendors', file);
  UI.toast('Uploading and validating — this may take a moment…');
  const res = await API.call('POST', '/vendors/master/upload', fd, true);
  if (!res?.success) { UI.toast(res?.error || 'Upload failed'); return; }

  const report = res.report || [];
  const green  = report.filter(r => r.status === 'green').length;
  const amber  = report.filter(r => r.status === 'amber').length;
  const red    = report.filter(r => r.status === 'red').length;

  let summary = `
    <p style="font-size:13px;margin-bottom:10px">
      ${res.added} added, ${res.skipped} skipped.<br>
      <span style="color:#4A8A5A">✓ ${green} clean</span> ·
      <span style="color:#C8A040">⚠ ${amber} review</span> ·
      <span style="color:#C87060">✗ ${red} red</span>
    </p>`;

  if (amber + red > 0) {
    summary += `<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Flagged rows for review:</div>`;
    report.filter(r => r.status !== 'green').forEach(r => {
      const col = r.status === 'red' ? '#C87060' : '#C8A040';
      const notes = (r.notes || []).map(n => UI.escapeText(n)).join(' · ');
      summary += `<div style="padding:8px;border-left:3px solid ${col};background:var(--bg);margin-bottom:4px;font-size:12px">
        <div style="font-weight:600">${UI.escapeText(r.name)}</div>
        ${notes ? `<div style="color:${col};margin-top:2px">${notes}</div>` : ''}
      </div>`;
    });
  }

  summary += `<p style="font-size:11px;color:var(--muted);margin-top:10px">All rows submitted to finance for clearance. You may edit flagged rows individually; finance will review each entry.</p>`;

  UI.openModal('Upload Report', summary);
  APP.renderVendorsMaster();
};

// ── Finance Clearance tab — Finance Admin reviews and clears pending vendors
APP.renderFinanceClearance = async function() {
  const el = UI.contentEl();
  UI.loading(el);

  const res = await API.call('GET', '/vendors/master/pending-clearance');
  const pending = res?.vendors || [];

  let html = `<div class="sec-label">Vendors pending clearance (${pending.length})</div>`;
  if (!pending.length) {
    html += UI.empty('','Nothing pending — all vendors cleared');
    el.innerHTML = html;
    return;
  }

  html += `<div style="font-size:11px;color:var(--muted);margin-bottom:10px">
    Review each entry. Clear green rows directly; edit and clear amber/red rows after verification.
  </div>`;

  pending.forEach(v => {
    let flagsHtml = '';
    let overall = 'green';
    if (v.ai_flags) {
      try {
        const f = typeof v.ai_flags === 'string' ? JSON.parse(v.ai_flags) : v.ai_flags;
        overall = f.overall || 'green';
        if (f.notes?.length) {
          flagsHtml = `<div style="margin-top:6px;padding:8px;background:var(--bg);border-radius:6px;font-size:11px">
            <div style="font-weight:600;margin-bottom:4px">AI notes:</div>
            ${f.notes.map(n => `<div>• ${UI.escapeText(n)}</div>`).join('')}
          </div>`;
        }
      } catch (_) { /* skip */ }
    }
    const borderCol = overall === 'red' ? '#C87060' : (overall === 'amber' ? '#C8A040' : '#4A8A5A');

    // v5.24: vendor-side bank validation indicator. The finance reviewer
    // sees at a glance whether the vendor has confirmed the bank details.
    // Without confirmation, the ICICI batch will refuse to include them.
    let validationLine = '';
    let sendOnboardBtn = '';
    if (v.bank_account || v.bank_ifsc) {
      if (v.bank_validated_by_vendor) {
        const method = v.bank_validation_method === 'matrix' ? 'Matrix'
                     : v.bank_validation_method === 'wa_form' ? 'WhatsApp'
                     : 'confirmed';
        validationLine = `<div style="font-size:11px;color:#4A8A5A;margin-top:4px">✓ Vendor confirmed bank details (${method})</div>`;
      } else {
        validationLine = `<div style="font-size:11px;color:#C8A040;margin-top:4px">⚠ Vendor has NOT yet confirmed bank details — payments will be blocked at ICICI step</div>`;
        if (v.phone) {
          sendOnboardBtn = `<button class="btn-secondary" style="font-size:11px;padding:4px 8px;margin-right:6px"
                                    onclick="APP.sendVendorOnboardLink(${v.id},'${UI.escapeAttr(v.vendor_name)}')">📱 Send onboarding via WhatsApp</button>`;
        }
      }
    }

    html += `<div class="card" style="margin-bottom:8px;border-left:3px solid ${borderCol}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div class="card-title">${UI.escapeText(v.vendor_name)}</div>
          <div class="card-meta">${UI.escapeText(v.trade||'')} · Uploaded by ${UI.escapeText(v.uploaded_by_name||'—')}</div>
          <div class="card-meta" style="font-family:var(--mono);font-size:10px;margin-top:3px">
            GSTIN: ${UI.escapeText(v.gst_number||'—')} · PAN: ${UI.escapeText(v.pan_number||'—')}<br>
            Bank: ${UI.escapeText(v.bank_name||'—')} · ${UI.escapeText(v.bank_account||'—')} · ${UI.escapeText(v.bank_ifsc||'—')}<br>
            Phone: ${UI.escapeText(v.phone||'—')}
          </div>
          ${validationLine}
          ${flagsHtml}
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        ${sendOnboardBtn}
        <button class="btn-approve" style="flex:1" onclick="APP.clearVendor(${v.id},'${UI.escapeAttr(v.vendor_name)}')">✓ Clear</button>
        <button class="btn-reject"  style="flex:1" onclick="APP.rejectVendor(${v.id},'${UI.escapeAttr(v.vendor_name)}')">✗ Reject</button>
      </div>
    </div>`;
  });

  el.innerHTML = html;
};

APP.clearVendor = async function(id, name) {
  const ok = await UI.confirm(`Clear ${name} for payments?`);
  if (!ok) return;
  const res = await API.call('PATCH', `/vendors/master/${id}/clear`, {});
  if (res?.success) { UI.toast('Vendor cleared ✓'); APP.renderFinanceClearance(); }
  else UI.toast(res?.error || 'Failed');
};

APP.rejectVendor = async function(id, name) {
  const reason = await UI.prompt(`Reject ${name} — reason:`, 'e.g. GSTIN invalid, name does not match');
  if (!reason || reason.trim().length < 5) { UI.toast('Reason required (min 5 chars)'); return; }
  const res = await API.call('PATCH', `/vendors/master/${id}/reject`, { reason });
  if (res?.success) { UI.toast('Vendor rejected'); APP.renderFinanceClearance(); }
  else UI.toast(res?.error || 'Failed');
};

// ═══════════════════════════════════════════════════════════════════════════
// M02 STAGE 2+3 — BOQ VERSION UX + PER-ITEM CRUD
// ═══════════════════════════════════════════════════════════════════════════

// ── VERSION LIST & ROLLBACK
APP.showBOQVersions = async function(pid) {
  const res = await API.call('GET', `/materials/${pid}/boq/versions`);
  const versions = res?.versions || [];
  const canRollback = ['design_head','services_head','principal','design_principal'].includes(APP.user.role);

  if (!versions.length) {
    UI.openModal('BOQ Versions', `<p style="font-size:13px;color:var(--muted)">No BOQ uploaded yet.</p>`);
    return;
  }

  // Group by stream for clarity
  const byStream = { design: [], services: [] };
  versions.forEach(v => { if (byStream[v.stream]) byStream[v.stream].push(v); });

  const renderStreamSection = (streamKey, streamLabel) => {
    const list = byStream[streamKey];
    if (!list.length) return '';
    let h = `<div class="sec-label" style="margin-top:12px">${streamLabel}</div>`;
    list.forEach(v => {
      const when = new Date(v.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const isCurrent = v.is_current === 1 || v.is_current === true;
      h += `<div class="card" style="margin-bottom:6px;padding:10px;${isCurrent?'border-left:3px solid #4A8A5A':''}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-size:13px">${UI.escapeText(v.label)} ${isCurrent ? '<span class="badge b-green" style="margin-left:6px">CURRENT</span>' : ''}</div>
            <div style="font-size:10px;color:var(--muted);font-family:var(--mono)">${v.item_count} items · ${UI.escapeText(v.uploaded_by_name || '—')} · ${when}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-sm" onclick="APP.previewBOQVersion(${pid},${v.id},'${UI.escapeAttr(v.label)}')">View</button>
            ${!isCurrent && canRollback ? `<button class="btn-sm navy" onclick="APP.rollbackBOQVersion(${pid},${v.id},'${UI.escapeAttr(v.label)}','${v.stream}')">Rollback</button>` : ''}
          </div>
        </div>
      </div>`;
    });
    return h;
  };

  const body = renderStreamSection('design', 'Design stream') + renderStreamSection('services', 'Services stream');
  UI.openModal('BOQ Versions', body);
};

// Tab render for the boq_versions nav tab (same data as modal, but full-page)
APP.renderBOQVersions = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid(); if (!pid) return;
  el.innerHTML = UI.loading();
  const res = await API.call('GET', `/materials/${pid}/boq/versions`);
  const versions = res?.versions || [];
  const canRollback = ['design_head','services_head','principal','design_principal'].includes(APP.user.role);

  if (!versions.length) {
    el.innerHTML = APP._projectSelectHtml('APP.renderBOQVersions()') + UI.empty('📋', 'No BOQ versions uploaded yet.');
    return;
  }

  const byStream = { design: [], services: [] };
  versions.forEach(v => { if (byStream[v.stream]) byStream[v.stream].push(v); });

  const renderSection = (streamKey, label) => {
    const list = byStream[streamKey];
    if (!list.length) return '';
    let h = `<div class="sec-label" style="margin:16px 0 8px">${label}</div>`;
    list.forEach(v => {
      const when = new Date(v.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const isCurrent = v.is_current === 1 || v.is_current === true;
      h += `<div class="card" style="margin-bottom:8px;${isCurrent?'border-left:3px solid var(--green)':''}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-size:13px">${UI.escapeText(v.label)} ${isCurrent ? '<span class="badge b-green" style="margin-left:6px">CURRENT</span>' : ''}</div>
            <div style="font-size:11px;color:var(--muted)">${v.item_count} items · ${UI.escapeText(v.uploaded_by_name || '—')} · ${when}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-sm" onclick="APP.previewBOQVersion(${pid},${v.id},'${UI.escapeAttr(v.label)}')">View</button>
            ${!isCurrent && canRollback ? `<button class="btn-sm navy" onclick="APP.rollbackBOQVersion(${pid},${v.id},'${UI.escapeAttr(v.label)}','${v.stream}')">Rollback</button>` : ''}
          </div>
        </div>
      </div>`;
    });
    return h;
  };

  el.innerHTML = APP._projectSelectHtml('APP.renderBOQVersions()') +
    `<div class="card-title" style="margin-bottom:4px">BOQ Version History</div>` +
    renderSection('design', 'Design stream') + renderSection('services', 'Services stream');
};

APP.previewBOQVersion = async function(pid, versionId, label) {
  const res = await API.call('GET', `/materials/${pid}/boq/versions/${versionId}/items`);
  if (!res?.items) { UI.toast('Failed to load version'); return; }
  const items = res.items.filter(i => !i.is_section);
  const byTrade = {};
  items.forEach(i => { (byTrade[i.trade] = byTrade[i.trade] || []).push(i); });

  let body = `<div style="font-size:12px;color:var(--muted);margin-bottom:8px">${items.length} items across ${Object.keys(byTrade).length} trades</div>`;
  Object.keys(byTrade).sort().forEach(trade => {
    body += `<div style="font-size:11px;font-weight:600;color:var(--navy);background:#f4f4f4;padding:4px 10px;margin-top:6px">${UI.escapeText(trade)} (${byTrade[trade].length})</div>`;
    byTrade[trade].slice(0, 30).forEach(item => {
      body += `<div style="padding:4px 10px;font-size:11px;border-bottom:1px solid #eee">
        <div>${UI.escapeText(item.item_name)}</div>
        <div style="font-family:var(--mono);color:var(--muted);font-size:10px">${item.quantity || 0} ${UI.escapeText(item.unit || '')}</div>
      </div>`;
    });
    if (byTrade[trade].length > 30) body += `<div style="padding:4px 10px;font-size:10px;color:var(--muted)">+${byTrade[trade].length - 30} more</div>`;
  });
  UI.openModal(`BOQ ${label}`, body);
};

APP.rollbackBOQVersion = async function(pid, versionId, label, stream) {
  const ok = await UI.confirm(`Roll back ${stream} BOQ to ${label}? New material requests after this will use ${label}'s items. Past requests stay intact.`);
  if (!ok) return;
  const res = await API.call('PATCH', `/materials/${pid}/boq/versions/${versionId}/activate`, {});
  if (res?.success) { UI.toast(res.message || 'Rolled back ✓'); UI.closeModal(); APP.renderMaterials(); }
  else UI.toast(res?.error || 'Rollback failed');
};

// ── PER-ITEM CRUD
APP.showAddBOQItem = async function(pid) {
  // Need current BOQ to know what trades exist + which stream(s) the user can add to
  const boq = await API.getBOQ(pid);
  const trades = Object.keys(boq?.byTrade || {}).sort();
  const me = APP.user;
  const isPrincipal = ['principal','design_principal'].includes(me.role);

  UI.openModal('Add BOQ Item', `
    ${isPrincipal ? `
    <div class="field-row"><label class="field-label" for="bi-stream">Stream *</label>
      <select id="bi-stream">
        <option value="design">Design</option>
        <option value="services">Services</option>
      </select>
    </div>` : ''}
    <div class="field-row"><label class="field-label" for="bi-trade">Trade *</label>
      <input list="bi-trade-list" id="bi-trade" placeholder="existing or new">
      <datalist id="bi-trade-list">${trades.map(t => `<option value="${UI.escapeAttr(t)}">`).join('')}</datalist>
    </div>
    <div class="field-row"><label class="field-label" for="bi-code">Item Code</label>
      <input type="text" id="bi-code" placeholder="optional">
    </div>
    <div class="field-row"><label class="field-label" for="bi-name">Item Name *</label>
      <input type="text" id="bi-name">
    </div>
    <div style="display:flex;gap:8px">
      <div class="field-row" style="flex:1"><label class="field-label" for="bi-qty">Quantity *</label>
        <input type="number" step="0.001" id="bi-qty" value="0">
      </div>
      <div class="field-row" style="flex:1"><label class="field-label" for="bi-unit">Unit *</label>
        <input type="text" id="bi-unit" placeholder="Nos / Sq.m / Kg">
      </div>
    </div>
    <button class="btn-primary" onclick="APP.submitAddBOQItem(${pid})">Add Item</button>
  `);
};

APP.submitAddBOQItem = async function(pid) {
  const body = {
    trade:     document.getElementById('bi-trade')?.value.trim(),
    item_code: document.getElementById('bi-code')?.value.trim() || null,
    item_name: document.getElementById('bi-name')?.value.trim(),
    quantity:  parseFloat(document.getElementById('bi-qty')?.value) || 0,
    unit:      document.getElementById('bi-unit')?.value.trim(),
  };
  const streamSel = document.getElementById('bi-stream');
  if (streamSel) body.stream = streamSel.value;

  if (!body.trade || !body.item_name || !body.unit) { UI.toast('Trade, name, and unit required'); return; }
  const res = await API.call('POST', `/materials/${pid}/boq/items`, body);
  if (res?.success) { UI.closeModal(); UI.toast('Item added ✓'); APP.renderMaterials(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showEditBOQItem = async function(pid, itemId) {
  const boq = await API.getBOQ(pid);
  const item = (boq?.items || []).find(i => i.id === itemId);
  if (!item) { UI.toast('Item not found'); return; }

  UI.openModal(`Edit: ${item.item_name}`, `
    <div class="field-row"><label class="field-label" for="bie-trade">Trade *</label>
      <input type="text" id="bie-trade" value="${UI.escapeAttr(item.trade || '')}">
    </div>
    <div class="field-row"><label class="field-label" for="bie-code">Item Code</label>
      <input type="text" id="bie-code" value="${UI.escapeAttr(item.item_code || '')}">
    </div>
    <div class="field-row"><label class="field-label" for="bie-name">Item Name *</label>
      <input type="text" id="bie-name" value="${UI.escapeAttr(item.item_name || '')}">
    </div>
    <div style="display:flex;gap:8px">
      <div class="field-row" style="flex:1"><label class="field-label" for="bie-qty">Quantity *</label>
        <input type="number" step="0.001" id="bie-qty" value="${item.quantity || 0}">
      </div>
      <div class="field-row" style="flex:1"><label class="field-label" for="bie-unit">Unit *</label>
        <input type="text" id="bie-unit" value="${UI.escapeAttr(item.unit || '')}">
      </div>
    </div>
    <button class="btn-primary" onclick="APP.submitEditBOQItem(${pid},${itemId})">Save</button>
  `);
};

APP.submitEditBOQItem = async function(pid, itemId) {
  const body = {
    trade:     document.getElementById('bie-trade')?.value.trim(),
    item_code: document.getElementById('bie-code')?.value.trim() || null,
    item_name: document.getElementById('bie-name')?.value.trim(),
    quantity:  parseFloat(document.getElementById('bie-qty')?.value) || 0,
    unit:      document.getElementById('bie-unit')?.value.trim(),
  };
  if (!body.trade || !body.item_name || !body.unit) { UI.toast('Trade, name, and unit required'); return; }
  const res = await API.call('PATCH', `/materials/${pid}/boq/items/${itemId}`, body);
  if (res?.success) { UI.closeModal(); UI.toast('Updated ✓'); APP.renderMaterials(); }
  else UI.toast(res?.error || 'Failed');
};

APP.deleteBOQItem = async function(pid, itemId, itemName) {
  const ok = await UI.confirm(`Delete ${itemName}? It will be hidden from the BOQ but past material requests will still display it.`);
  if (!ok) return;
  const res = await API.call('DELETE', `/materials/${pid}/boq/items/${itemId}`);
  if (res?.success) { UI.toast(res.message || 'Deleted ✓'); APP.renderMaterials(); }
  else UI.toast(res?.error || 'Delete failed');
};

// ═══════════════════════════════════════════════════════════════════════════
// M02 STAGE 4 — CLIENT BOQ VIEWER
// ═══════════════════════════════════════════════════════════════════════════

APP.renderClientBOQ = async function() {
  const el  = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.call('GET', `/client-boq/${pid}`);
  if (!data) { el.innerHTML = UI.empty('','Failed to load'); return; }
  const items = data.items || [];
  // GET returns 'versions' array (one per stream); pick first current one for the header
  const version = (data.versions && data.versions.length) ? data.versions[0] : null;

  const me = APP.user;
  const canEditRate = ['principal','design_principal','pmc_head','design_head','services_head'].includes(me.role);

  let html = APP._projectSelectHtml('APP.renderClientBOQ()') + `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="card-title">Client Contract BOQ</div>
        <div class="card-meta">${(() => {
          const vs = data.versions || [];
          if (!vs.length) return 'No BOQ uploaded yet — upload the client contract schedule';
          return vs.map(v => `${v.stream === 'civil' ? 'Civil' : 'Services'}: ${v.label} · ${v.item_count||0} items`).join(' &nbsp;|&nbsp; ');
        })()}</div>
      </div>
      ${['principal','design_principal','design_head','services_head'].includes(APP.user.role) ? `<div style="display:flex;gap:8px;align-items:center">
        <select id="client-boq-stream" style="font-size:13px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);color:var(--text)">
          <option value="civil">Civil / Design</option>
          <option value="services">Services / MEP</option>
        </select>
        <a href="/templates/client_boq_template.xlsx" download="client_boq_template.xlsx"
           style="font-size:12px;color:var(--navy);text-decoration:underline;display:flex;align-items:center;gap:4px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Template
        </a>
        <input type="file" id="client-boq-file" accept=".xlsx,.xls" style="display:none" onchange="APP.uploadClientBOQ(${pid},this)">
        <button class="btn-sm gold" onclick="document.getElementById('client-boq-file').click()">Upload</button>
      </div>` : ''}
    </div>
  </div>`;

  if (!items.length) {
    el.innerHTML = html + UI.empty('','Upload the client contract BOQ to track billing milestones and rates');
    return;
  }

  // Group by section (use parent_id tree — show top-level then children)
  const topLevel  = items.filter(i => !i.parent_id);
  const childOf   = {};
  items.filter(i => i.parent_id).forEach(i => { (childOf[i.parent_id] = childOf[i.parent_id] || []).push(i); });

  const fmt = n => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const renderItem = (item, indent) => {
    const hasRate = item.client_rate != null && item.client_rate !== '';
    const rate    = hasRate ? fmt(item.client_rate) : '—';
    const amount  = hasRate ? fmt((item.quantity || 0) * item.client_rate) : '—';
    const bgStyle = item.is_section ? 'background: #f8fafc; border-left: 3px solid var(--navy);' : '';
    const leftBorder = indent && !item.is_section ? `border-left: 2px solid var(--border); margin-left: ${indent * 12}px;` : '';

    return `<div class="card" style="margin: 6px 0; padding: 12px 16px; ${bgStyle} ${leftBorder}">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:${item.is_section ? '700' : '600'};color:${item.is_section ? 'var(--navy)' : 'var(--text)'}">${UI.escapeText(item.item_name)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">
            ${item.sor_ref ? `<span style="font-family:var(--mono);background:var(--bg2);padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px">${UI.escapeText(item.sor_ref)}</span>` : ''}
            <span style="font-weight:500">${item.quantity || 0} ${UI.escapeText(item.unit || '')}</span>
            ${item.hsn_code ? ` · <span style="color:var(--text);font-size:11px">HSN: <strong>${UI.escapeText(item.hsn_code)}</strong></span>` : ''}
          </div>
        </div>
        ${!item.is_section ? `<div style="text-align:right;font-family:var(--mono);font-size:13px;min-width:110px;margin-right:8px">
          <div style="font-weight:600;color:var(--text)">₹${rate}</div>
          <div style="color:var(--muted);font-size:11px;margin-top:2px">${amount !== '—' ? '₹' + amount : ''}</div>
        </div>` : ''}
        ${canEditRate && !item.is_section ? `<button class="btn-sm" style="padding:6px 12px;font-size:13px" onclick="APP.showEditClientBOQItem(${pid},${item.id})">✎ Edit</button>` : ''}
      </div>
    </div>`;
  };

  const renderTree = (parentId, depth) => {
    const children = childOf[parentId] || [];
    return children.map(c => renderItem(c, depth) + renderTree(c.id, depth + 1)).join('');
  };

  topLevel.forEach(item => {
    html += renderItem(item, 0);
    html += renderTree(item.id, 1);
  });

  el.innerHTML = html;
};

APP.uploadClientBOQ = async function(pid, input) {
  const file = input.files[0];
  if (!file) return;
  const stream = document.getElementById('client-boq-stream')?.value || 'civil';
  const fd = new FormData();
  fd.append('client_boq', file);
  fd.append('stream', stream);
  UI.toast('Uploading…');
  const res = await API.call('POST', `/client-boq/${pid}/upload`, fd, true);
  if (res?.success) { UI.toast(res.message || 'Uploaded ✓'); APP.renderClientBOQ(); }
  else UI.toast(res?.error || 'Upload failed');
};

APP.showEditClientBOQItem = async function(pid, itemId) {
  const data = await API.call('GET', `/client-boq/${pid}`);
  const item = (data?.items || []).find(i => i.id === itemId);
  if (!item) { UI.toast('Item not found'); return; }
  const hsnBtn = APP.state.aiToggles?.boq_hsn_autofill
    ? `<button class="btn-sm" type="button" onclick="APP.suggestHSN('${UI.escapeAttr(item.item_name||item.description||'')}','${UI.escapeAttr(item.trade||'')}','cb-hsn')" style="margin-top:4px;font-size:11px">Suggest HSN</button>`
    : '';
  UI.openModal(`Edit: ${item.item_name}`, `
    <div class="field-row"><label class="field-label" for="cb-rate">Rate (₹ per ${UI.escapeText(item.unit||'unit')})</label>
      <input type="number" step="0.01" id="cb-rate" value="${item.client_rate || ''}">
    </div>
    <div class="field-row"><label class="field-label" for="cb-hsn">HSN Code</label>
      <input type="text" id="cb-hsn" value="${UI.escapeAttr(item.hsn_code || '')}" maxlength="8">
      ${hsnBtn}
    </div>
    <button class="btn-primary" onclick="APP.submitEditClientBOQItem(${pid},${itemId})">Save</button>
  `);
};

APP.submitEditClientBOQItem = async function(pid, itemId) {
  const rate = document.getElementById('cb-rate')?.value;
  const hsn  = document.getElementById('cb-hsn')?.value.trim();
  // Two calls — rate + hsn endpoints are separate on backend (client-boq.js)
  let anyChanged = false, failed = null;
  if (rate !== '' && rate !== null) {
    const r = await API.call('PATCH', `/client-boq/${pid}/items/${itemId}/rate`, { rate: parseFloat(rate) });
    if (r?.success) anyChanged = true;
    else failed = r?.error || 'rate update failed';
  }
  if (!failed && hsn) {
    const r = await API.call('PATCH', `/client-boq/${pid}/items/${itemId}/hsn`, { hsn_code: hsn });
    if (r?.success) anyChanged = true;
    else failed = r?.error || 'HSN update failed';
  }
  if (failed) UI.toast(failed);
  else if (anyChanged) { UI.closeModal(); UI.toast('Updated ✓'); APP.renderClientBOQ(); }
  else UI.toast('Nothing to save');
};

APP.toggleHeaderMenu = function(e) {
  if (e) e.stopPropagation();
  const actions = document.getElementById('tb-actions');
  if (actions) {
    actions.classList.toggle('show');
  }
};

// Close header menu when tapping outside
document.addEventListener('click', function(e) {
  const actions = document.getElementById('tb-actions');
  const toggle = document.getElementById('tb-menu-toggle');
  if (!actions || !actions.classList.contains('show')) return;
  if (actions.contains(e.target) || toggle?.contains(e.target)) return;
  actions.classList.remove('show');
});

// ── DARK MODE TOGGLE
APP.toggleDarkMode = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nu_theme', next);
  UI.toast(next === 'dark' ? 'Dark mode' : 'Light mode');
};

// ─PULL TO REFRESH
(function() {
  let startY = 0, pulling = false;
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.textContent = 'Pull to refresh';
  document.body.appendChild(indicator);

  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) startY = e.touches[0].clientY;
    else startY = 0;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!startY) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 60 && window.scrollY === 0) {
      pulling = true;
      indicator.classList.add('pulling');
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (pulling) {
      indicator.textContent = 'Refreshing...';
      indicator.classList.remove('pulling');
      indicator.classList.add('refreshing');
      setTimeout(() => {
        APP._nav = null;
        APP.state.aiToggles = null;
        APP.buildTabs();
        indicator.classList.remove('refreshing');
        indicator.textContent = 'Pull to refresh';
      }, 400);
    }
    pulling = false;
    startY = 0;
  });
})();

// ── SSE REAL-TIME UPDATES
APP._initSSE = function() {
  if (APP._sse) return; // already connected
  if (typeof EventSource === 'undefined') return;
  try {
    APP._sse = new EventSource('/api/sse/stream');
    APP._sse.addEventListener('task_update', () => {
      // Refresh dashboard if currently viewing it
      if (APP.currentTab === 'dashboard') APP.render('dashboard');
    });
    APP._sse.addEventListener('payment_update', () => {
      if (APP.currentTab === 'payments' || APP.currentTab === 'payments_fin') APP.render(APP.currentTab);
    });
    APP._sse.addEventListener('drawing_issued', () => {
      if (APP.currentTab === 'drawings') APP.render('drawings');
    });
    APP._sse.addEventListener('report_submitted', () => {
      if (APP.currentTab === 'reports' || APP.currentTab === 'reports_weekly') APP.render(APP.currentTab);
    });
    APP._sse.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.message) UI.toast(data.message);
      } catch(_e) {}
      APP._checkNotifBadge();
    });
    APP._sse.onerror = () => {
      // Reconnect after 5s on error
      APP._sse.close();
      APP._sse = null;
      setTimeout(() => APP._initSSE(), 5000);
    };
  } catch (_e) {}
};

// ═══════════════════════════════════════════════════════════════════════════════
// NEW MODULE RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── MEASUREMENTS
APP.renderMeasurements = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/measurements/${pid}`);
  if (!data) return;
  const items = data.measurements || [];

  const role = APP.user.role;
  const canCreate = ['pmc_head','site_manager','senior_site_manager','quantity_surveyor'].includes(role);
  const isStreamHead = ['structural_head','mep_head','services_head','design_head'].includes(role);
  const isPMC = ['pmc_head','principal','design_principal'].includes(role);

  const STATUS_BADGE = { draft:'b-amber', rs_signed:'b-blue', client_accepted:'b-green' };

  let html = APP._projectSelectHtml('APP.renderMeasurements()');
  if (canCreate) {
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showNewMeasurement(${pid})">+ New Measurement Sheet</button>`;
  }

  if (!items.length) { html += UI.empty('','No measurement sheets yet'); }
  else items.forEach(m => {
    const badge = STATUS_BADGE[m.status] || 'b-silver';
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-title">RA Bill #${m.ra_bill_number||'—'} · ${m.discipline||'General'}</div>
          <div class="card-meta">${UI.fmtDate(m.measurement_date)} · ${m.recorded_by_name||'—'}</div>
          ${m.checked_by_name ? `<div class="card-meta">Checked by: ${m.checked_by_name}</div>` : ''}
        </div>
        <span class="badge ${badge}">${(m.status||'draft').replace('_',' ')}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn-sm" onclick="APP.showMeasurementItems(${pid},${m.id})">View Items</button>
        ${isStreamHead && m.status === 'draft' ? `<button class="btn-sm approve" onclick="APP.measurementRsSignoff(${pid},${m.id})">RS Signoff</button>` : ''}
        ${isPMC && m.status === 'rs_signed' ? `<button class="btn-sm gold" onclick="APP.showMeasurementClientAccept(${pid},${m.id})">Client Accept</button>` : ''}
        ${m.status === 'client_accepted' ? `<button class="btn-sm" onclick="APP.downloadMeasurementCert(${pid},${m.id})">Certificate</button>` : ''}
        ${isPMC && m.status === 'client_accepted' ? `<button class="btn-sm" onclick="APP.showUploadSignedCert(${pid},${m.id})">Upload Signed Cert</button>` : ''}
        ${m.signed_certificate_url ? `<a class="btn-sm" href="${m.signed_certificate_url}" target="_blank" rel="noopener">Signed Cert ↓</a>` : ''}
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showNewMeasurement = function(pid) {
  UI.showModal('New Measurement Sheet', `
    <div class="field"><label>RA Bill Number</label><input id="ms-ra" placeholder="e.g. RA-7"></div>
    <div class="field"><label>Discipline</label>
      <select id="ms-disc">
        <option value="Civil">Civil</option>
        <option value="Structural">Structural</option>
        <option value="MEP">MEP</option>
        <option value="Finishing">Finishing</option>
        <option value="External">External Works</option>
        <option value="General">General</option>
      </select>
    </div>
    <div class="field"><label>Measurement Date</label><input type="date" id="ms-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Notes</label><textarea id="ms-notes" rows="2" placeholder="Optional notes…"></textarea></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitNewMeasurement(${pid})">Create</button>
  `);
};

APP._submitNewMeasurement = async function(pid) {
  const ra_bill_number   = document.getElementById('ms-ra')?.value?.trim();
  const discipline       = document.getElementById('ms-disc')?.value;
  const measurement_date = document.getElementById('ms-date')?.value;
  const notes            = document.getElementById('ms-notes')?.value?.trim();
  if (!ra_bill_number || !measurement_date) { UI.toast('RA Bill # and date required'); return; }
  const res = await API.post(`/measurements/${pid}`, { ra_bill_number, discipline, measurement_date, notes });
  if (res?.success) { UI.closeModal(); UI.toast('Measurement created ✓'); APP.renderMeasurements(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showMeasurementItems = async function(pid, mid) {
  const data = await API.get(`/measurements/${pid}/${mid}/items`);
  if (!data) return;
  const items = data.items || [];
  let content = items.length ? items.map(i =>
    `<div class="card" style="margin-bottom:6px">
      <div style="font-weight:600">${i.item_name||'—'}</div>
      <div class="card-meta">${i.trade||''} · ${i.measured_qty||0} ${i.unit||''} (BOQ: ${i.boq_qty||'—'})</div>
      ${i.quality_note ? `<div class="card-meta" style="color:var(--amber)">Note: ${i.quality_note}</div>` : ''}
    </div>`
  ).join('') : '<div class="card-meta">No line items yet</div>';
  UI.showModal('Measurement Items', content);
};

APP.measurementRsSignoff = async function(pid, mid) {
  const notes = prompt('RS Signoff notes (optional):') || '';
  const res = await API.post(`/measurements/${pid}/${mid}/rs-signoff`, { notes });
  if (res?.success) { UI.toast('RS Signoff recorded ✓'); APP.renderMeasurements(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showMeasurementClientAccept = function(pid, mid) {
  UI.showModal('Client Acceptance', `
    <div class="field"><label>Client Rep Name</label><input id="mca-name" placeholder="Client representative"></div>
    <div class="field"><label>Designation</label><input id="mca-desig" placeholder="e.g. Project Manager"></div>
    <div class="field"><label>Acceptance Date</label><input type="date" id="mca-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Deduction Notes</label><textarea id="mca-ded" rows="2" placeholder="Any deductions/remarks…"></textarea></div>
    <div class="field"><label>Signed Certificate (PDF/Image)</label><input type="file" id="mca-cert" accept="image/*,.pdf" style="font-size:13px"></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitMeasurementClientAccept(${pid},${mid})">Record Acceptance</button>
  `);
};

APP._submitMeasurementClientAccept = async function(pid, mid) {
  const client_rep_name        = document.getElementById('mca-name')?.value?.trim();
  const client_rep_designation = document.getElementById('mca-desig')?.value?.trim();
  const acceptance_date        = document.getElementById('mca-date')?.value;
  const deductions_notes       = document.getElementById('mca-ded')?.value?.trim();
  const certFile               = document.getElementById('mca-cert')?.files?.[0];
  if (!client_rep_name || !acceptance_date) { UI.toast('Rep name and date required'); return; }
  const fd = new FormData();
  fd.append('client_rep_name', client_rep_name);
  fd.append('client_rep_designation', client_rep_designation || '');
  fd.append('acceptance_date', acceptance_date);
  fd.append('deductions_notes', deductions_notes || '');
  if (certFile) fd.append('signed_certificate', certFile);
  const res = await API.call('POST', `/measurements/${pid}/${mid}/client-acceptance`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Client acceptance recorded ✓'); APP.renderMeasurements(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showUploadSignedCert = function(pid, mid) {
  UI.openModal('Upload Signed Certificate', `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
      Upload the client-signed measurement certificate for RA Bill #${mid}.
    </div>
    <div class="field-row">
      <label class="field-label">Signed Certificate *</label>
      <input type="file" id="usc-cert" accept=".pdf,image/*">
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn-primary" onclick="APP._submitSignedCert(${pid},${mid})">Upload</button>
      <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
    </div>
  `);
};

APP._submitSignedCert = async function(pid, mid) {
  const file = document.getElementById('usc-cert')?.files?.[0];
  if (!file) { UI.toast('Select a file first'); return; }
  const fd = new FormData();
  fd.append('signed_certificate', file);
  const res = await API.call('POST', `/measurements/${pid}/${mid}/signed-cert`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Signed certificate uploaded ✓'); APP.renderMeasurements(); }
  else UI.toast(res?.error || 'Upload failed');
};

APP.downloadMeasurementCert = async function(pid, mid) {
  UI.toast('Generating certificate…');
  const data = await API.get(`/measurements/${pid}/${mid}/certificate`);
  if (data?.file_url) { window.open(data.file_url, '_blank'); }
  else UI.toast(data?.error || 'Certificate not available');
};

// ── CLAIMS
APP.renderClaims = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/claims/${pid}`);
  if (!data) return;
  const claims = data.claims || [];

  const role = APP.user.role;
  const canCreate = ['pmc_head','principal','design_principal','finance_admin'].includes(role);
  const isRS = ['structural_head','mep_head','services_head','design_head','senior_site_manager'].includes(role);
  const isPMC = ['pmc_head','principal','design_principal'].includes(role);
  const isFinance = ['finance_admin'].includes(role);

  const STATUS_BADGE = { draft:'b-amber', rs_signed:'b-blue', pmc_approved:'b-green', invoiced:'b-navy' };

  let html = APP._projectSelectHtml('APP.renderClaims()');
  if (canCreate) {
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showNewClaim(${pid})">+ New Claim</button>`;
  }

  if (!claims.length) { html += UI.empty('','No claims raised yet'); }
  else claims.forEach(c => {
    const badge = STATUS_BADGE[c.status] || 'b-silver';
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-title">Claim #${c.claim_number||c.id} · RA ${c.ra_bill_number||'—'}</div>
          <div class="card-meta">${UI.fmtDate(c.created_at)} · ${Money.formatRupee(c.total_claimed||0)}</div>
          ${c.invoice_number ? `<div class="card-meta">Invoice: ${c.invoice_number}</div>` : ''}
        </div>
        <span class="badge ${badge}">${(c.status||'draft').replace('_',' ')}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn-sm" onclick="APP.showClaimItems(${pid},${c.id})">View Items</button>
        ${isRS && c.status === 'draft' ? `<button class="btn-sm approve" onclick="APP.claimRsSign(${pid},${c.id})">RS Signoff</button>` : ''}
        ${isPMC && c.status === 'rs_signed' ? `<button class="btn-sm approve" onclick="APP.claimPmcSign(${pid},${c.id})">PMC Approve</button>` : ''}
        ${isFinance && c.status === 'pmc_approved' ? `<button class="btn-sm gold" onclick="APP.showSetInvoice(${pid},${c.id})">Set Invoice #</button>` : ''}
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showNewClaim = function(pid) {
  UI.showModal('New Claim', `
    <div class="field"><label>RA Bill Number</label><input id="cl-ra" placeholder="e.g. RA-7"></div>
    <div class="field"><label>Period From</label><input type="date" id="cl-from" value="${UI.todayIST()}"></div>
    <div class="field"><label>Period To</label><input type="date" id="cl-to" value="${UI.todayIST()}"></div>
    <div class="field"><label>Notes</label><textarea id="cl-notes" rows="2"></textarea></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitNewClaim(${pid})">Create Claim</button>
  `);
};

APP._submitNewClaim = async function(pid) {
  const ra_bill_number = document.getElementById('cl-ra')?.value?.trim();
  const period_from    = document.getElementById('cl-from')?.value;
  const period_to      = document.getElementById('cl-to')?.value;
  const notes          = document.getElementById('cl-notes')?.value?.trim();
  if (!ra_bill_number) { UI.toast('RA Bill # required'); return; }
  const res = await API.post(`/claims/${pid}`, { ra_bill_number, period_from, period_to, notes });
  if (res?.success) { UI.closeModal(); UI.toast('Claim created ✓'); APP.renderClaims(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showClaimItems = async function(pid, claimId) {
  const data = await API.get(`/claims/${pid}/${claimId}/items`);
  const items = data?.items || [];
  let content = items.length ? items.map(i =>
    `<div class="card" style="margin-bottom:6px">
      <div style="font-weight:600">${i.item_name||'—'}</div>
      <div class="card-meta">${i.trade||''} · Measured: ${i.measured_qty||0} ${i.unit||''}</div>
      <div class="card-meta">Rate: ${Money.formatRupee(i.rate||0)} · Amount: ${Money.formatRupee(i.amount||0)}</div>
    </div>`
  ).join('') : '<div class="card-meta">No items — add from measurement sheets</div>';
  UI.showModal('Claim Items', content);
};

APP.claimRsSign = async function(pid, claimId) {
  const res = await API.post(`/claims/${pid}/${claimId}/rs-signoff`, {});
  if (res?.success) { UI.toast('RS Signoff recorded ✓'); APP.renderClaims(); }
  else UI.toast(res?.error || 'Failed');
};

APP.claimPmcSign = async function(pid, claimId) {
  const res = await API.post(`/claims/${pid}/${claimId}/pmc-signoff`, {});
  if (res?.success) { UI.toast('PMC Signoff recorded ✓'); APP.renderClaims(); }
  else UI.toast(res?.error || 'Failed');
};

APP.claimApprove = async function(pid, claimId) {
  const res = await API.post(`/claims/${pid}/${claimId}/approve`, {});
  if (res?.success) { UI.toast('Claim approved ✓'); APP.renderClaims(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showSetInvoice = function(pid, claimId) {
  UI.showModal('Set Invoice Number', `
    <div class="field"><label>Invoice Number</label><input id="cl-inv" placeholder="e.g. INV-2024-007"></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitInvoiceNumber(${pid},${claimId})">Save</button>
  `);
};

APP._submitInvoiceNumber = async function(pid, claimId) {
  const invoice_number = document.getElementById('cl-inv')?.value?.trim();
  if (!invoice_number) { UI.toast('Invoice number required'); return; }
  const res = await API.patch(`/claims/${pid}/${claimId}/invoice-number`, { invoice_number });
  if (res?.success) { UI.closeModal(); UI.toast('Invoice set ✓'); APP.renderClaims(); }
  else UI.toast(res?.error || 'Failed');
};

// ── FORMS / INSPECTIONS
APP.renderForms = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const [tplData, subData] = await Promise.all([
    API.get('/forms/templates'),
    API.get(`/forms/${pid}/submissions`),
  ]);
  if (!tplData && !subData) return;
  const templates   = tplData?.templates || [];
  const submissions = subData?.submissions || [];

  const role = APP.user.role;
  const canManageTemplates = ['pmc_head','principal','design_principal'].includes(role);
  const canSubmit = ['site_manager','senior_site_manager','pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderForms()');

  if (templates.length) {
    html += `<div class="sec-label">Inspection Templates</div>`;
    templates.forEach(t => {
      html += `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="card-title">${UI.escapeText(t.name||'—')}</div>
            <div class="card-meta">${t.category||'General'} · ${t.field_count||0} fields</div>
          </div>
          <div style="display:flex;gap:6px">
            ${t.status === 'draft' && canManageTemplates ? `<button class="btn-sm approve" onclick="APP.approveFormTemplate(${pid},${t.id})">Approve</button>` : ''}
            ${t.status === 'approved' && canSubmit ? `<button class="btn-sm gold" onclick="APP.showSubmitForm(${pid},${t.id},'${UI.escapeAttr(t.name||'')}')">Fill Form</button>` : ''}
          </div>
        </div>
      </div>`;
    });
  }

  html += `<div class="sec-hdr-row" style="margin-top:16px">
    <div class="sec-label" style="margin:0;flex:1">Recent Submissions (${submissions.length})</div>
    ${canManageTemplates ? `<button class="btn-sm" onclick="APP.showNewFormTemplate(${pid})">+ Template</button>` : ''}
  </div>`;

  if (!submissions.length) { html += UI.empty('','No forms submitted yet'); }
  else submissions.slice(0,10).forEach(s => {
    const badge = s.status === 'approved' ? 'b-green' : s.status === 'pending_review' ? 'b-amber' : 'b-silver';
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div class="card-title">${UI.escapeText(s.template_name||'—')}</div>
          <div class="card-meta">${UI.fmtDate(s.submitted_at)} · ${s.submitted_by_name||'—'}</div>
          ${s.notes ? `<div class="card-meta" style="margin-top:2px;font-style:italic">${UI.escapeText(s.notes)}</div>` : ''}
          ${s.file_url ? `<a href="${s.file_url}" target="_blank" class="btn-sm" style="margin-top:6px;display:inline-block">📎 Attachment</a>` : ''}
        </div>
        <span class="badge ${badge}" style="flex-shrink:0;margin-left:8px">${s.status||'submitted'}</span>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showNewFormTemplate = function(pid) {
  UI.showModal('New Form Template', `
    <div class="field-row"><label class="field-label">Title *</label>
      <input id="ft-title" placeholder="e.g. Concrete Pour Checklist"></div>
    <div class="field-row"><label class="field-label">Category</label>
      <select id="ft-cat">
        <option value="Quality">Quality</option>
        <option value="Safety">Safety</option>
        <option value="Progress">Progress</option>
        <option value="Handover">Handover</option>
        <option value="General">General</option>
      </select>
    </div>
    <div class="field-row"><label class="field-label">Upload Excel Template <span style="color:var(--muted);font-weight:400">(optional — or type fields below)</span></label>
      <input type="file" id="ft-excel" accept=".xlsx,.xls,.csv"></div>
    <div class="field-row"><label class="field-label">Fields <span style="color:var(--muted);font-weight:400">(one per line — skip if uploading Excel)</span></label>
      <textarea id="ft-fields" rows="4" placeholder="Pour location&#10;Slump value&#10;Temperature&#10;Supervisor sign-off"></textarea></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitFormTemplate(${pid})">Create Template</button>
  `);
};

APP._submitFormTemplate = async function(pid) {
  const name      = document.getElementById('ft-title')?.value?.trim();
  const category  = document.getElementById('ft-cat')?.value;
  const fieldText = document.getElementById('ft-fields')?.value || '';
  const excelFile = document.getElementById('ft-excel')?.files?.[0];
  if (!name) { UI.toast('Title required'); return; }
  const fields = fieldText.split('\n').map(f => f.trim()).filter(Boolean).map(label => ({ label, type: 'text' }));
  const fd = new FormData();
  fd.append('name', name);
  fd.append('category', category || 'General');
  fd.append('fields_json', JSON.stringify(fields));
  if (pid) fd.append('project_id', pid);
  if (excelFile) fd.append('excel', excelFile);
  const res = await API.call('POST', '/forms/templates', fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Template created ✓'); APP.renderForms(); }
  else UI.toast(res?.error || 'Failed');
};

APP.approveFormTemplate = async function(pid, templateId) {
  const res = await API.patch(`/forms/templates/${templateId}/approve`, {});
  if (res?.success) { UI.toast('Template approved ✓'); APP.renderForms(); }
  else UI.toast(res?.error || 'Failed');
};

APP.showSubmitForm = async function(pid, templateId, templateTitle) {
  // Fetch template to get fields
  const tplData = await API.get('/forms/templates').catch(() => null);
  const tpl = (tplData?.templates || []).find(t => t.id == templateId);
  let fields = [];
  try { fields = JSON.parse(tpl?.fields_json || '[]'); } catch(e) {}

  let fieldsHtml = '';
  if (fields.length) {
    fieldsHtml = fields.map((f,i) => `
      <div class="field-row">
        <label class="field-label">${UI.escapeText(f.label||`Field ${i+1}`)}${f.required?' *':''}</label>
        <input id="sf-field-${i}" data-label="${UI.escapeAttr(f.label||`Field ${i+1}`)}"
          placeholder="${UI.escapeAttr(f.label||'')}">
      </div>`).join('');
  } else {
    fieldsHtml = `<div class="field-row"><label class="field-label">Response *</label>
      <textarea id="sf-field-0" data-label="Response" rows="4" placeholder="Describe the inspection findings..."></textarea></div>`;
    fields = [{ label: 'Response' }];
  }

  UI.openModal(`Submit: ${templateTitle}`, `
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${tpl?.category||'General'} inspection — PMC will review your submission</div>
    ${fieldsHtml}
    <div class="field-row"><label class="field-label">Photo / Attachment <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <input type="file" id="sf-file" accept="image/*,.pdf"></div>
    <div class="field-row"><label class="field-label">Notes</label>
      <input id="sf-notes" placeholder="Any additional notes..."></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitFilledForm(${pid},${templateId},${fields.length})">Submit Form</button>
  `);
};

APP._submitFilledForm = async function(pid, templateId, fieldCount) {
  const count = fieldCount || 1;
  const responses = {};
  for (let i = 0; i < count; i++) {
    const el = document.getElementById(`sf-field-${i}`);
    if (el) responses[el.dataset.label || `Field ${i+1}`] = el.value?.trim() || '';
  }
  const notes   = document.getElementById('sf-notes')?.value?.trim();
  const file    = document.getElementById('sf-file')?.files?.[0];
  const fd = new FormData();
  fd.append('template_id', templateId);
  fd.append('responses_json', JSON.stringify(responses));
  if (notes) fd.append('notes', notes);
  if (file)  fd.append('form', file);
  const res = await API.call('POST', `/forms/${pid}/submit`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Form submitted ✓'); APP.renderForms(); }
  else UI.toast(res?.error || 'Failed');
};

// ── LABOUR QUICK
APP.renderLabourQuick = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/labour-quick/${pid}`);
  if (!data) return;
  const entries = data.entries || [];

  const role = APP.user.role;
  const canAdd = ['site_manager','senior_site_manager','pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderLabourQuick()');
  if (canAdd) {
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showAddLabourQuick(${pid})">+ Record Labour Count</button>`;
  }

  if (!entries.length) { html += UI.empty('','No labour records yet'); }
  else entries.slice(0,15).forEach(e => {
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="card-title">${e.trade||'Labour'} · ${e.worker_count||0} workers</div>
          <div class="card-meta">${UI.fmtDate(e.work_date)} · ${e.contractor_name||'—'}</div>
          ${e.notes ? `<div class="card-meta">${e.notes}</div>` : ''}
        </div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:600;color:var(--navy)">${e.worker_count||0}</div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showAddLabourQuick = function(pid) {
  UI.showModal('Record Labour Count', `
    <div class="field"><label>Date</label><input type="date" id="lq-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Trade / Category</label>
      <select id="lq-trade">
        <option value="Mason">Mason</option>
        <option value="Carpenter">Carpenter</option>
        <option value="Steel Fixer">Steel Fixer</option>
        <option value="Electrician">Electrician</option>
        <option value="Plumber">Plumber</option>
        <option value="Painter">Painter</option>
        <option value="Helper">Helper</option>
        <option value="Supervisor">Supervisor</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="field"><label>Number of Workers</label><input type="number" id="lq-count" min="1" placeholder="0"></div>
    <div class="field"><label>Contractor Name</label><input id="lq-contractor" placeholder="Subcontractor or agency"></div>
    <div class="field"><label>Notes</label><input id="lq-notes" placeholder="Optional"></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitLabourQuick(${pid})">Save</button>
  `);
};

APP._submitLabourQuick = async function(pid) {
  const work_date      = document.getElementById('lq-date')?.value;
  const trade          = document.getElementById('lq-trade')?.value;
  const worker_count   = document.getElementById('lq-count')?.value;
  const contractor_name= document.getElementById('lq-contractor')?.value?.trim();
  const notes          = document.getElementById('lq-notes')?.value?.trim();
  if (!work_date || !worker_count) { UI.toast('Date and count required'); return; }
  const res = await API.post(`/labour-quick/${pid}`, { work_date, trade, worker_count: parseInt(worker_count), contractor_name, notes });
  if (res?.success) { UI.closeModal(); UI.toast('Labour recorded ✓'); APP.renderLabourQuick(); }
  else UI.toast(res?.error || 'Failed');
};

// ── SCHEDULE QUICK
APP.renderScheduleQuick = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/schedule-quick/${pid}`);
  if (!data) return;
  const tasks = data.tasks || [];

  const role = APP.user.role;
  const canAdd = ['site_manager','senior_site_manager','pmc_head'].includes(role);

  let html = APP._projectSelectHtml('APP.renderScheduleQuick()');
  if (canAdd) {
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showAddScheduleQuick(${pid})">+ Quick Activity Update</button>`;
  }

  if (!tasks.length) { html += UI.empty('','No quick updates yet'); }
  else tasks.slice(0,20).forEach(t => {
    const pct = t.progress_pct || 0;
    const color = pct >= 100 ? 'var(--green)' : pct > 0 ? 'var(--navy)' : 'var(--muted)';
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1">
          <div class="card-title">${t.activity||'—'}</div>
          <div class="card-meta">${UI.fmtDate(t.update_date)} · ${t.recorded_by_name||'—'}</div>
        </div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:600;color:${color}">${pct}%</div>
      </div>
      <div style="height:4px;background:var(--border);border-radius:2px;margin-top:8px">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:2px;transition:width .3s"></div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showAddScheduleQuick = function(pid) {
  UI.showModal('Quick Activity Update', `
    <div class="field"><label>Activity Description</label><input id="sq-activity" placeholder="e.g. Column casting Block B floor 3"></div>
    <div class="field"><label>Progress %</label><input type="number" id="sq-pct" min="0" max="100" placeholder="0-100"></div>
    <div class="field"><label>Date</label><input type="date" id="sq-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Notes</label><input id="sq-notes" placeholder="Optional remarks"></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitScheduleQuick(${pid})">Save</button>
  `);
};

APP._submitScheduleQuick = async function(pid) {
  const activity     = document.getElementById('sq-activity')?.value?.trim();
  const progress_pct = document.getElementById('sq-pct')?.value;
  const update_date  = document.getElementById('sq-date')?.value;
  const notes        = document.getElementById('sq-notes')?.value?.trim();
  if (!activity || !update_date) { UI.toast('Activity and date required'); return; }
  const res = await API.post(`/schedule-quick/${pid}`, { activity, progress_pct: parseInt(progress_pct||0), update_date, notes });
  if (res?.success) { UI.closeModal(); UI.toast('Update saved ✓'); APP.renderScheduleQuick(); }
  else UI.toast(res?.error || 'Failed');
};

// ── COMMS
APP.renderComms = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/comms/${pid}`);
  if (!data) return;
  const msgs = data.messages || [];

  const role = APP.user.role;
  const canPost = ['pmc_head','principal','design_principal','site_manager','senior_site_manager','finance_admin'].includes(role);
  const canAck  = ['pmc_head','principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderComms()');
  if (canPost) {
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showPostComm(${pid})">+ Post Communication</button>`;
  }

  if (!msgs.length) { html += UI.empty('','No communications posted yet'); }
  else msgs.slice(0,20).forEach(m => {
    const needsAck = m.requires_ack && !m.acked_at;
    html += `<div class="card" style="${needsAck ? 'border-left:3px solid var(--amber)' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div class="card-title">${m.subject||'—'}</div>
          <div class="card-meta">${UI.fmtDate(m.created_at)} · ${m.from_name||'—'} → ${m.to_party||'All'}</div>
          ${m.body ? `<div class="card-meta" style="margin-top:4px">${m.body.substring(0,120)}</div>` : ''}
        </div>
        ${needsAck ? '<span class="badge b-amber">Needs Ack</span>' : '<span class="badge b-green">✓</span>'}
      </div>
      ${canAck && needsAck ? `<button class="btn-sm approve" style="width:100%;margin-top:8px" onclick="APP.ackComm(${pid},${m.id})">Acknowledge</button>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showPostComm = function(pid) {
  UI.showModal('Post Communication', `
    <div class="field"><label>Subject</label><input id="cm-subj" placeholder="e.g. Delay notice re: steel delivery"></div>
    <div class="field"><label>To (Party)</label>
      <select id="cm-to">
        <option value="Client">Client</option>
        <option value="Contractor">Contractor</option>
        <option value="Vendor">Vendor</option>
        <option value="Internal">Internal PMC</option>
        <option value="All">All Stakeholders</option>
      </select>
    </div>
    <div class="field"><label>Message</label><textarea id="cm-body" rows="4" placeholder="Communication body…"></textarea></div>
    <div class="field" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="cm-ack" style="width:auto">
      <label for="cm-ack" style="margin:0">Requires acknowledgement</label>
    </div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitComm(${pid})">Post</button>
  `);
};

APP._submitComm = async function(pid) {
  const subject      = document.getElementById('cm-subj')?.value?.trim();
  const to_party     = document.getElementById('cm-to')?.value;
  const body         = document.getElementById('cm-body')?.value?.trim();
  const requires_ack = document.getElementById('cm-ack')?.checked || false;
  if (!subject) { UI.toast('Subject required'); return; }
  const res = await API.post(`/comms/${pid}`, { subject, to_party, body, requires_ack });
  if (res?.success) { UI.closeModal(); UI.toast('Communication posted ✓'); APP.renderComms(); }
  else UI.toast(res?.error || 'Failed');
};

APP.ackComm = async function(pid, commId) {
  const res = await API.patch(`/comms/${pid}/${commId}/ack`, {});
  if (res?.success) { UI.toast('Acknowledged ✓'); APP.renderComms(); }
  else UI.toast(res?.error || 'Failed');
};

// ── DIRECT PAYMENTS
APP.renderDirectPayments = async function() {
  const el = UI.contentEl();
  const pid = APP._ensurePid();
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/finance/${pid}/direct-payments`);
  if (!data) return;
  const payments = data.payments || [];

  const role = APP.user.role;
  const canAdd = ['principal','design_principal'].includes(role);

  let html = APP._projectSelectHtml('APP.renderDirectPayments()');
  if (canAdd) {
    html += `<button class="btn-primary" style="width:100%;margin-bottom:16px" onclick="APP.showAddDirectPayment(${pid})">+ Record Direct Payment</button>`;
  }

  if (!payments.length) { html += UI.empty('','No direct payments recorded'); }
  else payments.slice(0,20).forEach(p => {
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="card-title">${p.paid_to||'—'}</div>
          <div class="card-meta">${UI.fmtDate(p.payment_date)} · ${(p.payment_type||'').replace(/_/g,' ')} · ${p.description||'—'}</div>
          ${p.upi_ref ? `<div class="card-meta" style="font-family:var(--mono)">Ref: ${p.upi_ref}</div>` : ''}
          ${p.receipt_url ? `<a href="${p.receipt_url}" target="_blank" class="btn-sm" style="font-size:11px;margin-top:6px;display:inline-block">🧾 Receipt</a>` : ''}
        </div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:600;color:var(--red)">-${Money.formatRupee(p.amount||0)}</div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.showAddDirectPayment = function(pid) {
  UI.showModal('Record Direct Payment', `
    <div class="field"><label>Paid To *</label><input id="dp-paid-to" placeholder="Name of person/entity paid"></div>
    <div class="field"><label>Amount (₹) *</label><input type="number" id="dp-amount" min="0"></div>
    <div class="field"><label>Payment Date *</label><input type="date" id="dp-date" value="${UI.todayIST()}"></div>
    <div class="field"><label>Payment Type *</label>
      <select id="dp-type">
        <option value="upi">UPI</option>
        <option value="cash">Cash</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="cheque">Cheque</option>
        <option value="card">Card</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="field"><label>Description *</label><input id="dp-description" placeholder="e.g. Site visit expenses"></div>
    <div class="field"><label>UPI / UTR Reference</label><input id="dp-upi-ref" placeholder="Optional"></div>
    <div class="field"><label>Receipt <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <input type="file" id="dp-receipt" accept="image/*,.pdf" style="font-size:13px"></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitDirectPayment(${pid})">Save</button>
  `);
};

APP._submitDirectPayment = async function(pid) {
  const paid_to      = document.getElementById('dp-paid-to')?.value?.trim();
  const amount       = document.getElementById('dp-amount')?.value;
  const payment_date = document.getElementById('dp-date')?.value;
  const payment_type = document.getElementById('dp-type')?.value;
  const description  = document.getElementById('dp-description')?.value?.trim();
  const upi_ref      = document.getElementById('dp-upi-ref')?.value?.trim();
  const receiptFile  = document.getElementById('dp-receipt')?.files?.[0];
  if (!paid_to || !amount || !payment_date || !description) { UI.toast('Fill all required fields'); return; }
  const fd = new FormData();
  fd.append('paid_to',      paid_to);
  fd.append('amount',       amount);
  fd.append('payment_date', payment_date);
  fd.append('payment_type', payment_type);
  fd.append('description',  description);
  if (upi_ref) fd.append('upi_ref', upi_ref);
  if (receiptFile) fd.append('receipt', receiptFile);
  const res = await API.call('POST', `/finance/${pid}/direct-payments`, fd, true);
  if (res?.success) { UI.closeModal(); UI.toast('Payment recorded ✓'); APP.renderPayments(); }
  else UI.toast(res?.error || 'Failed');
};

// ── VENDOR BANK CHANGE (surfaced from vendor management)
APP.showProposeBankChange = function(vendorId, vendorName) {
  UI.showModal(`Bank Change — ${vendorName||'Vendor'}`, `
    <div class="card-meta" style="margin-bottom:10px;color:var(--amber)">⚠ Bank change requires PMC Head + Principal approval</div>
    <div class="field"><label>Bank Name</label><input id="bc-bank" placeholder="e.g. HDFC Bank"></div>
    <div class="field"><label>Account Number</label><input id="bc-acc" placeholder="Account number"></div>
    <div class="field"><label>IFSC Code</label><input id="bc-ifsc" placeholder="e.g. HDFC0001234" maxlength="11"></div>
    <div class="field"><label>Account Holder Name</label><input id="bc-holder" placeholder="As per bank records"></div>
    <div class="field"><label>Reason for Change</label><textarea id="bc-reason" rows="2" placeholder="Why is the bank account changing?"></textarea></div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitBankChange(${vendorId})">Submit for Approval</button>
  `);
};

APP._submitBankChange = async function(vendorId) {
  const bank_name    = document.getElementById('bc-bank')?.value?.trim();
  const account_no   = document.getElementById('bc-acc')?.value?.trim();
  const ifsc_code    = document.getElementById('bc-ifsc')?.value?.trim().toUpperCase();
  const account_holder = document.getElementById('bc-holder')?.value?.trim();
  const reason       = document.getElementById('bc-reason')?.value?.trim();
  if (!bank_name || !account_no || !ifsc_code || !account_holder) { UI.toast('All bank fields required'); return; }
  const res = await API.post(`/vendors/master/${vendorId}/bank-change/propose`, { bank_name, account_no, ifsc_code, account_holder, reason });
  if (res?.success) { UI.closeModal(); UI.toast('Bank change submitted for approval ✓'); }
  else UI.toast(res?.error || 'Failed');
};

APP.renderPendingBankChanges = async function() {
  const data = await API.get('/vendors/master/bank-changes/pending');
  if (!data?.changes?.length) return;
  const el = document.getElementById('bank-change-section');
  if (!el) return;
  let html = '<div class="sec-label">Pending Bank Changes</div>';
  data.changes.forEach(c => {
    html += `<div class="card" style="border-left:3px solid var(--amber)">
      <div class="card-title">${c.vendor_name||'—'}</div>
      <div class="card-meta">New: ${c.bank_name} · ${c.account_no} · ${c.ifsc_code}</div>
      <div class="card-meta">${c.reason||'No reason given'}</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm approve" onclick="APP._approveBankChange(${c.id})">Approve</button>
        <button class="btn-sm reject" onclick="APP._rejectBankChange(${c.id})">Reject</button>
      </div>
    </div>`;
  });
  el.innerHTML = html;
};

APP._approveBankChange = async function(changeId) {
  const res = await API.post(`/vendors/master/bank-change/${changeId}/approve`, {});
  if (res?.success) { UI.toast('Bank change approved ✓'); APP.renderPendingBankChanges(); }
  else UI.toast(res?.error || 'Failed');
};

APP._rejectBankChange = async function(changeId) {
  const reason = prompt('Rejection reason:');
  if (!reason) return;
  const res = await API.post(`/vendors/master/bank-change/${changeId}/reject`, { reason });
  if (res?.success) { UI.toast('Bank change rejected'); APP.renderPendingBankChanges(); }
  else UI.toast(res?.error || 'Failed');
};

// ── VENDOR PO / SETTLEMENT BUTTONS (called from vendor engagement cards)
APP.showApprovePO = async function(engagementId, vendorName) {
  const res = await API.post(`/vendor-documents/po/${engagementId}/approve`, {});
  if (res?.success) UI.toast(`PO approved for ${vendorName||'vendor'} ✓`);
  else UI.toast(res?.error || 'Failed');
};

APP.showFlagPO = function(engagementId) {
  if (!confirm('Mark this engagement as requiring a Purchase Order?')) return;
  API.call('PATCH', `/vendor-documents/engagements/${engagementId}/po-flag`, { po_required: true }).then(res => {
    if (res?.success) { UI.toast('PO requirement flagged ✓'); APP.renderVendors(); }
    else UI.toast(res?.error || 'Failed');
  });
};

APP.showRecordSettlement = function(engagementId, vendorName) {
  UI.showModal(`Final Settlement — ${vendorName||'Vendor'}`, `
    <div class="field"><label>DLP / Retention Deduction (₹)</label><input type="number" id="set-dlp" min="0" value="0"></div>
    <div class="field"><label>Notes</label><textarea id="set-notes" rows="2"></textarea></div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Final payable = Contract Value − DLP Deduction. PDF generated and sent to vendor.</div>
    <button class="btn-primary" style="width:100%;margin-top:8px" onclick="APP._submitSettlement(${engagementId})">Generate Settlement</button>
  `);
};

APP._submitSettlement = async function(engagementId) {
  const dlp_deduction = parseFloat(document.getElementById('set-dlp')?.value || 0);
  const notes         = document.getElementById('set-notes')?.value?.trim();
  if (isNaN(dlp_deduction)) { UI.toast('Enter a valid DLP deduction amount'); return; }
  const res = await API.post(`/vendor-documents/settlement/${engagementId}`,
    { dlp_deduction, notes });
  if (res?.success) { UI.closeModal(); UI.toast('Settlement generated & sent to vendor ✓'); }
  else UI.toast(res?.error || 'Failed');
};
