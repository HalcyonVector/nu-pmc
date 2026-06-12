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

const TRADE_COLORS = {
  'Civil':'#c8a55a','Electrical':'#4a8fa8','IT / Networking':'#4a8a5a',
  'HVAC':'#9a6ab8','Fire / Suppression':'#a84a3a','PA & Fire Alarm':'#a88a2a',
  'Interior':'#7a5a9a','Plumbing':'#3a8a7a','Handover':'#5a5a5a',
  'Architectural':'#c8a55a','Structural':'#4a8fa8',
};
const MAT_STATUSES = ['Requested','Ordered','Dispatched','Received','Checked & Validated'];

// ROLE_TABS removed — nav is DB-driven via /api/nav/me. Login enforces that
// the role has at least one row in role_nav before issuing a session, so the
// "no nav configured" case is caught at auth time, not here.

const TAB_LABELS = {
  dashboard:'Dashboard',    projects:'Projects',      changes:'CNs',
  monthly:'Monthly Overview',  project_detail:'Project Summary',
  budget:'Budget',          payments:'Payments',      payments_fin:'Payments',
  schedule_view:'Schedule', weekly_health:'Health',   users:'Users',
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
  ai_settings:'AI Settings',
  errors_log:'Error Log',
  library:'Knowledge Library',
  ai_settings:'AI Features',
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
      APP.showApp();
    } else {
      APP.showLogin();
    }
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

    // Site manager with multiple projects — show picker first
    if (['site_manager','senior_site_manager'].includes(APP.user.role)) {
      const projects = APP.user.projects || [];
      if (projects.length === 0) {
        UI.contentEl().innerHTML = '<div class="empty"><div class="empty-icon"></div><div class="empty-text">No projects assigned yet.<br>Contact your PMC team lead.</div></div>';
        document.getElementById('tabs-bar').innerHTML = '';
        return;
      }
      if (projects.length === 1) {
        // Only one project — go straight in
        APP.state.selectedProject = projects[0].id;
        APP.buildTabs();
        return;
      }
      // Multiple projects — restore last selection if valid, else show picker
      try {
        const saved = sessionStorage.getItem('nu_selected_project');
        if (saved) {
          const savedId = parseInt(saved, 10);
          if (projects.some(p => p.id === savedId)) {
            APP.state.selectedProject = savedId;
            APP._updateTopbar();
            APP.buildTabs();
            return;
          }
        }
      } catch (_e) {}
      APP.showProjectPicker();
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
      const aiRes = await API.get('/ai/settings/active');
      APP.state.aiToggles = {};
      (aiRes?.active || []).forEach(k => { APP.state.aiToggles[k] = true; });
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

    // Load AI feature toggles (Phase 2) — controls which AI buttons appear
    if (!APP.state.aiToggles) {
      try {
        const toggleRes = await API.get('/ai-settings/enabled');
        const enabled = toggleRes?.enabled || [];
        APP.state.aiToggles = {};
        enabled.forEach(k => { APP.state.aiToggles[k] = true; });
      } catch (_e) { APP.state.aiToggles = {}; }
    }

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
          statusBadge = '<span style="background:#f5ecdb;color:#8a6320;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">Not submitted</span>';
          buttonLabel = 'Submit today\'s report';
          buttonAction = 'APP.showTodayReportForm()';
        } else if (t.state === 'pending_review') {
          statusBadge = '<span style="background:#edeae2;color:#666;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">Awaiting PMC review</span>';
          buttonLabel = 'Edit / resubmit';
          buttonAction = 'APP.showTodayReportForm()';
        } else if (t.state === 'approved') {
          statusBadge = '<span style="background:#dbebe0;color:#2a7d4f;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">Approved ✓</span>';
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
        todayCard = `<div class="wp-card" style="border-left-color:var(--amber)">
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
          : `APP.switchTab('${it.tab}')`;
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

    // Dev role switcher: support the special dev credentials that return
    // a user list for picking an acting user. Server-side route exists
    // only when NODE_ENV=development. Using client-side detection of the
    // literal dev credentials avoids changing normal login behaviour.
    try {
      if (u.toLowerCase() === 'user1' && p === 'Start@123') {
        const devRes = await API.post('/auth/dev-login', { username: u, password: p });
        if (devRes?.dev && Array.isArray(devRes.users)) {
          // Open a modal to pick the user to act as
          APP._openDevPicker(devRes.users);
          return;
        }
        // Fall through to normal error handling if dev-login failed
        errEl.textContent = devRes?.error || 'Dev login failed';
        return;
      }
    } catch (e) {
      // If dev-login route isn't present or errors, continue with normal login
      console.warn('Dev-login attempt failed:', e?.message || e);
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
      ? `<div style="background:#f5d5cf;border:1px solid #d98377;color:#a84a3a;padding:10px;border-radius:6px;margin-bottom:12px;font-size:13px">
           <b>Flagged by PMC:</b> ${UI.escapeText(t.flag_reason)}
         </div>` : '';
    UI.openModal('Today\'s Report', `
      ${flagBanner}
      <div style="font-size:13px;color:#666;margin-bottom:10px;line-height:1.5">
        Notes about today — what was achieved, blockers, upcoming. Tasks, photos,
        labour, and issues you've already logged today are included automatically.
      </div>
      <textarea id="today-report-notes" rows="7" style="width:100%;padding:10px;border:1.5px solid #d8d2c5;border-radius:8px;font-size:14px;font-family:inherit;resize:vertical"
        placeholder="Example: Completed slab casting at grid A-C. 12 labour on site.
Delay: cement delivery slipped by 2 hrs.
Tomorrow: start formwork on next bay."
      >${t.notes ? UI.escapeText(t.notes) : ''}</textarea>
      <button class="btn-primary" style="width:100%;margin-top:14px" onclick="APP.submitTodayReport()">Submit Today's Report</button>
    `);
  },

  async submitTodayReport() {
    const pid = APP.state.selectedProject;
    if (!pid) { UI.toast('No project selected'); return; }
    const notes = (document.getElementById('today-report-notes')?.value || '').trim();
    const res = await API.post(`/daily-reports/${pid}/submit`, { notes });
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

  switchTab(id) {
    APP.currentTab = id;
    const ca = document.getElementById('content-area'); if (ca) ca.scrollTop = 0;

    // If DB-driven nav is active, ensure the bucket containing this tab is
    // set as the active bucket. Handles deep-links and any switchTab call
    // that jumps across buckets (e.g. dashboard Action Centre → Issues).
    if (APP._nav && APP._nav.buckets) {
      let targetBucket = null;
      for (const [bucket, tabs] of Object.entries(APP._nav.buckets)) {
        if (tabs.some(t => t.key === id)) { targetBucket = bucket; break; }
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
      documents:     APP.renderDocuments,
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
      nav_editor:        () => APP.renderNavEditor(),
      governance:        () => APP.renderGovernance(),
      account_setup:     () => APP.renderAccountSetup(),
      ai_settings:       () => APP.renderAISettings(),
      errors_log:        () => APP.renderErrorsLog(),
      library:           () => APP.renderKnowledgeLibrary(),
      ai_settings:       () => APP.renderAISettings(),
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

    // Fix 5: each action item now opens triage list first (not tab direct)
    if (ac.overdue_queries.length)
      html += addItem('','Drawing queries — overdue',`${ac.overdue_queries.length} unanswered 3+ days`,'red','red','OVERDUE',"APP.showActionTriage('overdue_queries')");
    if (ac.open_flags.length)
      html += addItem('','Site flags open',`${ac.open_flags.length} unresolved flags`,'red','red','OPEN',"APP.showActionTriage('open_flags')");
    if (ac.overdue_materials.length)
      html += addItem('','Materials overdue',`${ac.overdue_materials.length} past needed-by date`,'red','red','OVERDUE',"APP.showActionTriage('overdue_materials')");
    if (ac.pending_approvals.length)
      html += addItem('','Approvals pending',`${ac.pending_approvals.length} awaiting Naveen / Ajay`,'amber','amber','PENDING',"APP.showActionTriage('pending_approvals')");
    if (ac.fresh_queries.length)
      html += addItem('','Drawing queries — open',`${ac.fresh_queries.length} within 3 days`,'amber','amber','OPEN',"APP.showActionTriage('fresh_queries')");
    if (ac.pending_changes.length)
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
        const isChecklistComplete = !!(p.checklist_project_created && p.checklist_design_boq &&
                                       p.checklist_services_boq && p.checklist_schedule && p.checklist_site_manager);
        if (['completed', 'on_hold'].includes(p.status)) {
          completed.push(p);
        } else if (p.status === 'initialising' || !isChecklistComplete) {
          // Skip initialising projects on the dashboard as requested
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
        const isChecklistComplete = !!(p.checklist_project_created && p.checklist_design_boq &&
                                       p.checklist_services_boq && p.checklist_schedule && p.checklist_site_manager);
        if (['completed', 'on_hold'].includes(p.status)) {
          completed.push(p);
        } else if (p.status === 'initialising' || !isChecklistComplete) {
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
    const checklist  = p.checklist_project_created && p.checklist_design_boq &&
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

    if (!checklist) {
      const steps = [
        ['Project created',          p.checklist_project_created],
        ['Design BOQ uploaded',      p.checklist_design_boq],
        ['Services BOQ uploaded',    p.checklist_services_boq],
        ['Schedule uploaded',        p.checklist_schedule],
        ['Site manager assigned',    p.checklist_site_manager],
      ];
      const done = steps.filter(s => s[1]).length;
      html += `<div style="padding:0 16px 16px; width:100%; text-align:center">
        <div style="font-size:10px;color:#60a8c8;font-family:var(--mono);margin-bottom:8px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">INITIALISING — ${done}/5 complete</div>
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
      html += `<div class="pc-stats">
        <div class="pc-stat"><span class="pc-stat-val">${p.avg_pct||0}%</span><span class="pc-stat-lbl">Progress</span></div>
        <div class="pc-stat"><span class="pc-stat-val${stats.open_queries>0?' amber':''}">${stats.open_queries||0}</span><span class="pc-stat-lbl">Queries</span></div>
        <div class="pc-stat"><span class="pc-stat-val${stats.flagged_tasks>0?' red':''}">${stats.flagged_tasks||0}</span><span class="pc-stat-lbl">Flags</span></div>
        <div class="pc-stat"><span class="pc-stat-val${stats.overdue_materials>0?' red':''}">${stats.overdue_materials||0}</span><span class="pc-stat-lbl">Overdue</span></div>
      </div>`;

      if (!compact && trades.length) {
        html += `<div class="pc-progress" style="padding:12px 16px; border-top:1px solid var(--border)">`;
        trades.forEach(([trade, pct]) => {
          const col = TRADE_COLORS[trade] || '#5a5a5a';
          html += `<div class="prog-row">
            <div class="prog-label">${trade.split(' ')[0]}</div>
            <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${col}"></div></div>
            <div class="prog-pct">${pct}%</div>
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
    const pid   = APP.state.selectedProject || APP.user.projects?.[0]?.id;

    if (!pid) { el.innerHTML = UI.empty('','No project assigned yet'); return; }

    const subTabs = `<div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;">
      <button style="min-height:44px;flex:1;text-align:center;padding:10px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--mono);background:${sub==='today'?'var(--navy)':'var(--white)'};color:${sub==='today'?'var(--white)':'var(--muted)'}" onclick="APP.state.scheduleView='today';APP.renderSchedule()">TODAY</button>
      <button style="min-height:44px;flex:1;text-align:center;padding:10px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--mono);background:${sub==='ahead'?'var(--navy)':'var(--white)'};color:${sub==='ahead'?'var(--white)':'var(--muted)'}" onclick="APP.state.scheduleView='ahead';APP.renderSchedule()">LOOK AHEAD</button>
    </div>`;

    if (sub === 'ahead') {
      await APP.renderLookaheadWorkspace(pid, subTabs, el);
      return;
    }

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

    // Pre-fetch the selected date's daily-report so the Site Notes textarea pre-fills
    try {
      const dr = await API.call('GET', `/daily-reports/${pid}/today?date=${date}`);
      APP.state._scheduleNotesPrefill = dr?.notes || '';
    } catch (e) {
      APP.state._scheduleNotesPrefill = '';
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

    const data = await API.getSchedule(pid, date);
    const tasks = data?.tasks || [];
    const byTrade = APP.groupByTrade(tasks);

    // Build final HTML
    let finalHtml = subTabs + strip;

    if (!tasks.length) {
      finalHtml += UI.empty('','No tasks scheduled today');
    } else {
      const done2 = tasks.filter(t=>(APP.state.taskPct[t.id]??t.pct_complete??0)===100).length;
      finalHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Tasks — ${date===today?'Today':UI.fmtDate(date)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${done2}/${tasks.length} done</span>
      </div>`;
      Object.entries(byTrade).forEach(([trade,tlist])=>{
        const col=TRADE_COLORS[trade]||'#5a5a5a';
        const tdone=tlist.filter(t=>(APP.state.taskPct[t.id]??t.pct_complete??0)===100).length;
        finalHtml+=`<div class="trade-group"><div class="trade-hdr">
          <div class="trade-dot" style="background:${col}"></div>
          <div class="trade-name">${trade}</div>
          <div class="trade-prog">${tdone}/${tlist.length}</div>
        </div>`;
        tlist.forEach(t=>{
          const pct2=APP.state.taskPct[t.id]??t.pct_complete??0;
          const isDone2=pct2===100;
          finalHtml+=`<div class="task-item${isDone2?' task-done':pct2>0?' task-progress':''}">
            <div class="task-dot"></div>
            <div style="flex:1">
              <div class="task-name">${t.task_name}</div>
              <div class="pct-wrap">
                <input type="range" class="pct-slider" min="0" max="100" step="5" value="${pct2}"
                  oninput="APP.liveUpdatePct(${t.id},${pid},'${date}',this)">
                <div class="pct-val" id="pv-${t.id}">${pct2}%</div>
              </div>
              <div class="task-actions">
                <button class="btn-sm${t.is_flagged?' flagged':''}" onclick="APP.toggleFlag(${t.id},${pid},'${date}',${t.update_id||'null'})">${t.is_flagged?'Flagged':'Flag'}</button>
              </div>
            </div>
          </div>`;
        });
        finalHtml+=`</div>`;
      });
    }

    const isPast = date < today;
    finalHtml+=`<div style="margin-top:16px">
      <div class="field-row"><label class="field-label" for="schedule-site-notes">Site Notes</label>
        <textarea id="schedule-site-notes" rows="3" placeholder="Work done, observations, blockers…"${isPast ? ' disabled' : ''}>${UI.escapeText(APP.state._scheduleNotesPrefill || '')}</textarea>
      </div>
      ${!isPast
        ? `<button class="btn-primary" onclick="APP.saveScheduleNotes(${pid})">Save Notes</button>`
        : `<div class="field-help" style="color:var(--muted);font-size:12px">Notes cannot be edited for past dates.</div>`}
    </div>`;
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
          <textarea style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--sans);font-size:11px;padding:6px 10px;margin-top:7px;outline:none;resize:none" rows="2" placeholder="Planning note — material, vendor, access…"></textarea>
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
      const { tasks, assignees, metrics } = data;
      
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
      
      const dynMetrics = {
        upcoming: tasks.filter(t => t.start_date >= todayStr).length,
        dueThisWeek: tasks.filter(t => t.end_date >= startOfWeekStr && t.end_date <= endOfWeekStr && t.pct_complete < 100).length,
        overdue: tasks.filter(t => t.end_date < todayStr && t.pct_complete < 100).length,
        completedThisWeek: metrics?.completedThisWeek || 0
      };
      
      // Filter tasks by selected month if not 'all'
      let filteredTasks = tasks;
      if (APP.state.lookaheadMonthFilter !== 'all') {
        filteredTasks = tasks.filter(t => t.start_date && t.start_date.startsWith(APP.state.lookaheadMonthFilter));
      } else {
        // Only show future tasks and overdue tasks by default in Look Ahead
        filteredTasks = tasks.filter(t => (t.start_date >= todayStr) || (t.end_date < todayStr && t.pct_complete < 100));
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
      let html = `
        <!-- Metrics Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:20px;">
          <div style="background:#f4f7fa;border:1px solid #d4dce5;border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--navy);margin-bottom:4px;">${dynMetrics.upcoming}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Upcoming Tasks</div>
          </div>
          <div style="background:#fcf8e3;border:1px solid #faebcc;border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#8a6d3b;margin-bottom:4px;">${dynMetrics.dueThisWeek}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Due This Week</div>
          </div>
          <div style="background:#f2dede;border:1px solid #ebccd1;border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#a94442;margin-bottom:4px;">${dynMetrics.overdue}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Overdue Tasks</div>
          </div>
          <div style="background:#dff0d8;border:1px solid #d6e9c6;border-radius:var(--r);padding:14px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#3c763d;margin-bottom:4px;">${dynMetrics.completedThisWeek}</div>
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
            <form id="task-create-form" style="padding:16px;display:flex;flex-direction:column;gap:12px;" onsubmit="APP.submitLookaheadTask(event, ${pid})">
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
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;">Planned Date *</label>
                  <input type="date" name="planned_date" required min="${todayStr}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:12px;outline:none;">
                </div>
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
            const pColors = { low: 'var(--muted)', medium: 'var(--navy)', high: '#d9534f', urgent: '#d9534f' };
            const pBg = { low: '#f0f0f0', medium: '#eef2f7', high: '#fdf2f2', urgent: '#fdf2f2' };
            const priorityLabel = t.priority.toUpperCase();
            
            html += `
              <div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:12px;display:flex;flex-direction:column;gap:6px;box-shadow:var(--shadow-sm);">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
                  <div style="font-weight:600;font-size:13px;color:var(--text);">${t.task_name}</div>
                  <span class="badge" style="background:${pBg[t.priority]};color:${pColors[t.priority]};font-size:9px;font-weight:700;text-transform:uppercase;">${priorityLabel}</span>
                </div>
                ${t.description ? `<div style="font-size:11px;color:var(--text2);line-height:1.4;">${t.description}</div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;flex-wrap:wrap;gap:8px;">
                  <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;background:#f5f5f5;padding:2px 6px;border-radius:4px;">${t.trade}</span>
                    <span style="font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;background:#e8f4fd;color:#0275d8;padding:2px 6px;border-radius:4px;">${t.pct_complete}% Done</span>
                  </div>
                  <div style="font-size:11px;color:var(--muted);">
                    ${t.assignee_name || 'Unassigned'}
                  </div>
                </div>
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
    const data = {
      task_name: formData.get('task_name'),
      description: formData.get('description'),
      assignee_id: formData.get('assignee_id') || null,
      priority: formData.get('priority') || 'medium',
      planned_date: formData.get('planned_date'),
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

  // ── SCHEDULE VIEW (PMC / Admin)
  async renderScheduleView() {
    const el  = UI.contentEl();
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getSchedule(pid);
    const ver  = data?.version;
    const tasks = data?.tasks || [];
    const byTrade = APP.groupByTrade(tasks);

    let html = '';
    if (ver) {
      html += `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <span class="badge b-blue">Schedule ${ver.label}</span>
        ${ver.drift_days > 0 ? `<span class="badge b-${ver.drift_days>3?'red':'amber'}">+${ver.drift_days} days drift</span>` : '<span class="badge b-green">On R0 track</span>'}
        ${ver.status==='pending_approval'?'<span class="badge b-red">Pending approval</span>':''}
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
      <button class="btn-sm gold" onclick="document.getElementById('sched-file').click()">Upload New Schedule Version</button>
    </div>`;

    el.innerHTML = html;
  },

  async validateTask(updateId, status, pid) {
    const note = status === 'rejected' ? await UI.prompt('Reason for rejection') : null;
    await API.validateTask(pid, { task_update_id: updateId, status, rejection_note: note });
    UI.toast(status === 'validated' ? 'Validated ✓' : 'Rejected — sent back to site manager');
    APP.renderScheduleView();
  },

  async uploadSchedule(pid, input) {
    const file = input.files[0];
    if (!file) return;
    const reason = await UI.prompt('Reason for schedule revision');
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
    const pid = APP.state.selectedProject || APP.user.projects?.[0]?.id;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getDrawings(pid);
    const drawings = data?.drawings || [];
    const role = APP.user.role;

    const canUpload = ['detailing_head','team_lead','jr_architect','detailing','services_engineer',
                       'design_head','services_head','principal','design_principal'].includes(role);

    let html = '<div class="drawings-page">';

    if (canUpload) {
      html += `<div style="margin-bottom:16px;background:#fff;border:1px solid #e8e4dc;border-radius:14px;padding:16px">

        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Drawing Type</div>
        <div style="display:flex;gap:6px;margin-bottom:16px" id="dwg-type-chips">
          <button onclick="APP.setDwgType('main')" id="dwg-type-main" style="min-height:44px;flex:1;padding:10px 8px;text-align:center;font-size:13px;font-weight:600;
                      background:#1a2e44;color:#faf8f3;border:1.5px solid #1a2e44;border-radius:8px;cursor:pointer">
            Main
            <div style="font-size:10px;font-weight:400;opacity:0.8;margin-top:2px">on register</div>
          </button>
          <button onclick="APP.setDwgType('detail')" id="dwg-type-detail" style="min-height:44px;flex:1;padding:10px 8px;text-align:center;font-size:13px;font-weight:600;
                      background:#fff;color:#666;border:1.5px solid #e8e4dc;border-radius:8px;cursor:pointer">
            Detail
            <div style="font-size:10px;font-weight:400;opacity:0.7;margin-top:2px">any number</div>
          </button>
          <button onclick="APP.setDwgType('rfi_response')" id="dwg-type-rfi" style="min-height:44px;flex:1;padding:10px 8px;text-align:center;font-size:13px;font-weight:600;
                      background:#fff;color:#666;border:1.5px solid #e8e4dc;border-radius:8px;cursor:pointer">
            RFI Reply
            <div style="font-size:10px;font-weight:400;opacity:0.7;margin-top:2px">links to RFI</div>
          </button>
        </div>
        <input type="hidden" id="dwg-type" value="main">

        <div id="dwg-type-info" style="font-size:12px;color:#666;background:#faf8f3;padding:10px 12px;border-radius:8px;margin-bottom:14px;line-height:1.5">
          <strong style="color:#1a2e44">Main drawing</strong> — must match a drawing number on the approved register. Rajani or Srinath pre-registers every main drawing at project start.
        </div>

        <div class="field-row"><label class="field-label" for="dwg-proj">Project</label>
          <input type="text" id="dwg-proj" value="${pid}" placeholder="Project ID">
        </div>
        <div class="field-row"><label class="field-label" for="dwg-cat">Category</label>
          <select id="dwg-cat">
            <option value="">— Select —</option>
            ${['Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT'].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field-row"><label class="field-label" for="dwg-num">Drawing Number</label><input type="text" id="dwg-num" placeholder="e.g. A-101"></div>
        <div class="field-row"><label class="field-label" for="dwg-name">Drawing Name</label><input type="text" id="dwg-name" placeholder="Ground Floor Plan"></div>

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
  },

  drawingCard(d, role, pid) {
    const isPending = d.version_status?.startsWith('pending');
    const isIssued  = d.version_status === 'issued';
    const isSite    = role === 'site_manager';

    const myTurn = isPending && (
      (['detailing_head','team_lead'].includes(role) && d.stream === 'design' && d.version_status === 'pending_l1') ||
      (role === 'design_head'    && d.stream === 'design'    && d.version_status === 'pending_l2') ||
      (role === 'services_head'  && d.stream === 'services'  && d.version_status === 'pending_l1') ||
      ['principal','design_principal'].includes(role)
    );

    const awaiting = d.version_status === 'pending_l1'
      ? (d.stream === 'design' ? 'Sahana / Sushmitha' : 'Srinath')
      : d.version_status === 'pending_l2' ? 'Rajani' : '';

    return `<div class="drawing-item${myTurn?' '+''  :''}" style="${myTurn?'border-color:var(--steel)':''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
        <div>
          <div class="di-num">${d.drawing_number}</div>
          <div class="di-name">${d.drawing_name}</div>
          <div class="di-meta">${d.category} · ${d.project_id} · ${d.uploaded_at?.split('T')[0]||''} · ${d.uploaded_by_name||''}</div>
        </div>
        <div class="di-rev ${isIssued?'rev-issued':isPending?'rev-pending':'rev-superseded'}">${d.revision}${isPending?' · pending':''}</div>
      </div>
      ${d.notes?`<div style="font-size:11px;color:var(--muted);margin-bottom:6px">${d.notes}</div>`:''}
      ${awaiting&&!myTurn?`<div style="font-size:10px;color:var(--muted);margin-bottom:6px">Awaiting: ${awaiting}</div>`:''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${isIssued?'<span class="badge b-green">Issued ✓</span>':''}
        ${myTurn?`<button class="btn-sm approve" onclick="APP.approveDrawing(${d.version_id})">${['detailing_head','team_lead'].includes(role)?'Mark Reviewed':'Approve & Issue'}</button>
          <button class="btn-sm reject" onclick="APP.rejectDrawing(${d.version_id})">Reject</button>`:''}
        ${isSite && isIssued?`<button class="btn-sm query" onclick="APP.raiseQueryForDrawing(${d.version_id},'${d.drawing_number} ${d.revision}',${pid})">Raise Query</button>`:''}
        <!-- History/New Rev stub buttons removed (lines 1610-1611). Both were
             onclick="UI.toast(...)" with no real action — History had no endpoint,
             New Rev told the user "use upload form above" which is misleading
             when the form is on a different page. Re-add when there's a real
             history endpoint and a clear UX for revisioning. -->
      </div>
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
    Object.entries(ids).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const active = key === t;
      el.style.background = active ? '#1a2e44' : '#fff';
      el.style.color      = active ? '#faf8f3' : '#666';
      el.style.borderColor= active ? '#1a2e44' : '#e8e4dc';
    });

    const parentRow = document.getElementById('dwg-parent-row');
    const rfiRow    = document.getElementById('dwg-rfi-row');
    const info      = document.getElementById('dwg-type-info');
    const numEl     = document.getElementById('dwg-num');
    const nameEl    = document.getElementById('dwg-name');
    const numRow    = numEl?.parentElement;
    const nameRow   = nameEl?.parentElement;

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
        info.innerHTML = '<strong style="color:#1a2e44">Main drawing</strong> — must match a drawing number on the approved register. Rajani or Srinath pre-registers every main drawing at project start.';
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
         <div style="max-height:180px;overflow-y:auto;background:#faf8f3;border-radius:8px;padding:12px;
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
    const pid = APP.state.selectedProject;
    const role = APP.user?.role;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getRegister(pid);
    if (!data) return;

    // Per Sprint 2 Item 9: Principal + Design Principal see Register in the
    // More bucket as a READ-ONLY summary — counts + list + sign-off only.
    // They no longer upload or amend the register (that's design_head /
    // services_head territory — Rajani and Srinath). Removing them from
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
      <div style="background:#fff;border:1px solid #e8e4dc;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Drawing Register</div>
        <div style="font-size:13px;color:#666;line-height:1.5">Master list of every main drawing expected on this project. Uploaded at project initiation by Rajani (design) and Srinath (services). Only drawings on the register can be uploaded as <strong>main</strong>.</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">
          <div style="text-align:center;padding:10px;background:#faf8f3;border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#1a2e44;line-height:1">${sum.total||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Total</div>
          </div>
          <div style="text-align:center;padding:10px;background:#faf8f3;border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#666;line-height:1">${sum.pending||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Pending</div>
          </div>
          <div style="text-align:center;padding:10px;background:#faf8f3;border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#d4761f;line-height:1">${sum.in_progress||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">In Prog</div>
          </div>
          <div style="text-align:center;padding:10px;background:#faf8f3;border-radius:8px">
            <div style="font-size:22px;font-weight:700;color:#2a7d4f;line-height:1">${sum.issued||0}</div>
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Issued</div>
          </div>
        </div>
      </div>`;

    if (canUpload) {
      html += `
      <div style="background:#fff;border:1px solid #e8e4dc;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Upload / Amend Register</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="/api/register/${pid}/template" style="flex:1;padding:10px;text-align:center;background:#faf8f3;color:#1a2e44;border:1.5px solid #e8e4dc;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;min-width:140px">
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
        <div style="background:#fff;border:1px solid #e8e4dc;border-radius:14px;padding:24px;margin-bottom:16px;text-align:center">
          <div style="font-size:14px;color:#999">No ${title.toLowerCase()} drawings registered yet</div>
        </div>`;

      const unsigned = list.some(r => !r.signed_off_by);
      return `
        <div style="background:#fff;border:1px solid #e8e4dc;border-radius:14px;padding:0;margin-bottom:16px;overflow:hidden">
          <div style="padding:14px 16px;background:#faf8f3;border-bottom:1px solid #e8e4dc;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:14px;font-weight:700;color:#1a2e44">${title} — ${list.length} drawings</div>
              ${unsigned && canSignOff ? `<div style="font-size:11px;color:#8a6320;margin-top:2px">${list.filter(r=>!r.signed_off_by).length} awaiting your sign-off</div>` : ''}
              ${unsigned && !canSignOff ? `<div style="font-size:11px;color:#888;margin-top:2px">Awaiting Naveen/Ajay sign-off</div>` : ''}
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
                  <button onclick="APP.deleteRegisterEntry(${pid},${r.id})" style="background:#fff;border:1.5px solid #d8d2c5;border-radius:8px;padding:6px 10px;font-size:12px;color:#a84a3a;cursor:pointer">Remove</button>
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
      <input type="file" id="reg-file" accept=".xlsx,.xls" style="width:100%;padding:10px;border:1.5px solid #d8d2c5;border-radius:8px;background:#fff">
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
      <div style="background:#fff;border:1px solid #E2E6EC;border-radius:10px;padding:16px;margin-bottom:16px">
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
            style="background:#fff;border:1px solid #CDD3DC;border-radius:6px;padding:6px 12px;font-size:12px;color:#C0392B;cursor:pointer">Revoke</button>
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
      'team_lead','jr_architect','detailing','services_engineer','coordinator',
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
      html += `<div class="sec-label" style="color:var(--red)">WhatsApp delivery failures</div>`;
      waFails.slice(0,5).forEach(f => {
        html += `<div class="wa-fail-card">
          <div class="wa-fail-title">${f.count} messages failed to send${f.oldest ? ` — oldest ${f.oldest}` : ''}</div>
          <div class="wa-fail-meta">Type: ${f.message_type || 'various'} · Check Twilio dashboard</div>
        </div>`;
      });
      html += `<div class="action-item c-red" style="margin-bottom:16px">
        <div class="ai-icon">📵</div>
        <div class="ai-body">
          <div class="ai-title">WhatsApp not delivering</div>
          <div class="ai-meta">Users will not receive notifications until resolved. Team can still use the app normally.</div>
        </div>
      </div>`;
    }

    // Summary stat row
    const pendingTotal = blocked.length + needsYou.length + navDrafts.length;
    html += `<div class="stat-row" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
      <div class="stat-card">
        <span class="stat-val ${blocked.length?'red':''}">${blocked.length}</span>
        <span class="stat-lbl">Blocked</span>
      </div>
      <div class="stat-card">
        <span class="stat-val ${(needsYou.length+navDrafts.length)?'navy':''}">${needsYou.length + navDrafts.length}</span>
        <span class="stat-lbl">Needs You</span>
      </div>
    </div>`;

    // ── Nav change drafts (Principal only) — shown first since they're rare + urgent
    if (navDrafts.length) {
      html += `<div class="sec-label">🧭 Nav change proposals</div>`;
      navDrafts.forEach(d => {
        // Build a plain-English diff: current vs proposed
        const cur  = (d.current || []).map(r => `${r.bucket}.${r.tab_key}`);
        const next = (d.items  || []).map(r => `${r.bucket}.${r.tab_key}`);
        const added   = next.filter(k => !cur.includes(k));
        const removed = cur.filter(k => !next.includes(k));
        const summary = (added.length || removed.length)
          ? `+${added.length} / −${removed.length} tabs`
          : 'Reorder only';

        html += `<div class="card" style="margin-bottom:10px;border-left:3px solid var(--navy)">
          <div class="card-title" style="font-size:13px">Nav for <b>${d.role.replace(/_/g,' ')}</b></div>
          <div class="card-meta">Proposed by ${UI.escapeText(d.proposed_by)} · ${UI.fmtDate(d.proposed_at)} · ${summary}</div>
          ${d.note ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;padding:6px 8px;background:var(--bg);border-radius:3px">${UI.escapeText(d.note)}</div>`:''}
          ${added.length   ? `<div style="font-size:11px;color:var(--green);margin-top:4px">Added: ${added.join(', ')}</div>`:''}
          ${removed.length ? `<div style="font-size:11px;color:var(--red);margin-top:4px">Removed: ${removed.join(', ')}</div>`:''}
          <div class="btn-row" style="margin-top:10px">
            <button class="btn-approve" onclick="APP.approveNavDraft(${d.draft_group_id})">Approve</button>
            <button class="btn-reject" onclick="APP.rejectNavDraft(${d.draft_group_id})">Reject</button>
          </div>
        </div>`;
      });
    }

    // ── Blocked section — items overdue in others' queues
    if (blocked.length) {
      html += `<div class="sec-label">Blocked — waiting on others</div>`;
      blocked.forEach(b => {
        const ageStyle = b.age_days >= 7 ? 'color:var(--red)' : b.age_days >= 3 ? 'color:var(--amber)' : 'color:var(--muted)';
        html += `<button class="card" style="min-height:44px;margin-bottom:8px;cursor:pointer"
                     "APP.switchTab('${b.tab}')">
          <div class="card-title" style="font-size:13px">${UI.escapeText(b.label)}</div>
          <div class="card-meta" style="${ageStyle}">${UI.escapeText(b.sub)}</div>
        </div>`;
      });
    }

    // ── Needs You section — items routed to you
    if (needsYou.length) {
      html += `<div class="sec-label" style="margin-top:14px">Needs your action</div>`;
      needsYou.forEach(n => {
        html += `<button class="card" style="min-height:44px;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--navy)"
                     "APP.switchTab('${n.tab}')">
          <div class="card-title" style="font-size:13px">${UI.escapeText(n.label)}</div>
          <div class="card-meta">${UI.escapeText(n.sub)}</div>
        </div>`;
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

  // ── WEEKLY SIGN-OFF (3-way)
  async renderWeeklySignoff() {
    const el = UI.contentEl();
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.get(`/reports/${pid}`).catch(() => null);
    const reports = data?.reports || [];
    const drafts = reports.filter(r => r.status === 'draft' || r.status === 'pending_approval');

    let html = `<div class="sec-label">Weekly Client Report — Sign-off</div>`;

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
              <div style="font-size:12px;color:#657B90;margin-top:2px">Ending ${rep.week_ending} · Status: ${rep.status}</div>
            </div>
            ${rep.pdf_url || rep.pdf_path ? `<a class="btn-secondary" href="${API.fileUrl(rep.pdf_url || rep.pdf_path, 'documents')}" target="_blank">Download PDF</a>` : ''}
          </div>

          <div class="signoff-chain">
            ${slot('PMC Section',      rep.sig_pmc_name,      rep.sig_pmc_at,      rep.sig_pmc_by,      'PMC')}
            ${slot('Design Section',   rep.sig_design_name,   rep.sig_design_at,   rep.sig_design_by,   'Design')}
            ${slot('Services Section', rep.sig_services_name, rep.sig_services_at, rep.sig_services_by, 'Services')}
          </div>

          ${['pmc','design','services'].map(sec => `
            <details style="margin-top:12px;background:#F8FAFC;border:1px solid #E2E6EC;border-radius:8px;padding:12px">
              <summary style="cursor:pointer;font-weight:600;color:#1A2332;font-size:13px">
                ${sec.toUpperCase()} Section ${rep[`sig_${sec}_by`] ? '· Signed' : ''}
              </summary>
              <div style="margin-top:10px">
                ${canEdit(sec) && canSign[sec] ? `
                  <textarea id="ws-${rep.id}-${sec}" rows="6" style="width:100%;padding:10px;border:1px solid #CDD3DC;border-radius:6px;font-family:inherit;font-size:13px">${rep[`${sec}_section`] || ''}</textarea>
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
            <div style="margin-top:16px;padding:12px;background:#F5ECDB;border-radius:8px">
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
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.get(`/photo-tags/disputes/${pid}`).catch(() => null);
    const disputes = data?.disputes || [];

    let html = `<div class="sec-label">Photo Tag Review — AI Disputes</div>
      <div style="font-size:13px;color:#3D5068;margin-bottom:16px;max-width:640px">
        Photos where AI disagrees with the human tag. Correct the tag, or accept AI's suggestion.
        Stream team members (Design/Services) can correct tags until the photo is used in a sent weekly report.
      </div>`;

    if (!disputes.length) {
      html += `<div style="color:#93A3B4;font-size:13px;padding:20px;text-align:center;border:1px dashed #CDD3DC;border-radius:10px">
        No tag disputes to review. All photos look consistently tagged.</div>`;
      el.innerHTML = html;
      return;
    }

    for (const d of disputes) {
      html += `
        <div class="card" style="display:flex;gap:16px;align-items:flex-start">
          <img src="${API.fileUrl(d.file_url || d.file_path, 'photos')}"
               alt="Drawing ${UI.escapeAttr(d.drawing_number)}: ${UI.escapeAttr(d.name)}"
               style="width:160px;height:120px;object-fit:cover;border-radius:8px;flex-shrink:0"
               onerror="this.style.display='none'">
          <div style="flex:1">
            <div style="font-size:11px;letter-spacing:1.2px;color:#93A3B4;text-transform:uppercase;margin-bottom:4px">${new Date(d.uploaded_at).toLocaleString('en-IN')}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
              <div style="background:#EBF0F7;padding:10px;border-radius:6px">
                <div style="font-size:10px;color:#1D3D62;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Human (${d.human_tagger || '—'})</div>
                <div style="font-size:13px;color:#1A2332">${d.human_task_name || '—'}</div>
                ${d.human_caption ? `<div style="font-size:12px;color:#657B90;margin-top:4px">${d.human_caption}</div>` : ''}
              </div>
              <div style="background:#F5ECDB;padding:10px;border-radius:6px">
                <div style="font-size:10px;color:#8a6415;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">AI suggests (${d.ai_confidence || 'low'})</div>
                <div style="font-size:13px;color:#1A2332">${d.ai_task_name || '—'}</div>
                ${d.ai_caption ? `<div style="font-size:12px;color:#657B90;margin-top:4px">${d.ai_caption}</div>` : ''}
                ${d.ai_note ? `<div style="font-size:11px;color:#8a6415;margin-top:6px;font-style:italic">${d.ai_note}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn-secondary" onclick="APP.acceptAITag(${d.photo_id}, ${d.ai_task_id}, '${(d.ai_caption||'').replace(/'/g,"\\'")}')">Accept AI</button>
              <button class="btn-ghost" onclick="APP.keepHumanTag(${d.photo_id})">Keep Human Tag</button>
              <button class="btn-ghost" onclick="APP.editPhotoTag(${d.photo_id})">Edit…</button>
            </div>
          </div>
        </div>`;
    }
    el.innerHTML = html;
  },

  async acceptAITag(photoId, taskId, caption) {
    const res = await API.post(`/photo-tags/${photoId}`, { task_id: taskId, caption });
    if (res?.success) { UI.toast('AI tag accepted ✓'); APP.renderPhotoTagReview(); }
    else UI.toast(res?.error || 'Failed');
  },

  async keepHumanTag(photoId) {
    // Re-saving the current human tag as current clears the AI dispute
    const hist = await API.get(`/photo-tags/${photoId}/history`).catch(() => null);
    const human = (hist?.history || []).find(t => t.tag_source !== 'ai');
    if (!human) { UI.toast('No human tag to keep'); return; }
    const res = await API.post(`/photo-tags/${photoId}`, {
      task_id: human.task_id, caption: human.caption, trade: human.trade
    });
    if (res?.success) { UI.toast('Human tag retained'); APP.renderPhotoTagReview(); }
  },

  async editPhotoTag(photoId) {
    UI.openModal('Edit Photo Tag', `
      <div class="field-row"><label class="field-label" for="pt-caption">Caption</label>
        <textarea id="pt-caption" rows="3"></textarea>
      </div>
      <div class="field-row"><label class="field-label" for="pt-trade">Trade</label>
        <select id="pt-trade">
          <option value="">—</option>
          ${['Civil','Architectural','Structural','Interior','Electrical','HVAC','Plumbing','Fire','IT'].map(t => `<option>${t}</option>`).join('')}
        </select>
      </div>
      <button class="btn-primary" onclick="APP.doEditPhotoTag(${photoId})">Save Tag</button>
    `);
  },

  async doEditPhotoTag(photoId) {
    const body = {
      caption: document.getElementById('pt-caption').value.trim(),
      trade:   document.getElementById('pt-trade').value,
    };
    const res = await API.post(`/photo-tags/${photoId}`, body);
    if (res?.success) { UI.closeModal(); UI.toast('Tag updated ✓'); APP.renderPhotoTagReview(); }
    else UI.toast(res?.error || 'Failed');
  },

  // ── QUERIES (PMC)
  async renderQueries() {
    const el  = UI.contentEl();
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getQueries(pid);
    const queries = data?.queries || [];
    const overdue = queries.filter(q => q.status !== 'closed' && q.days_open >= 3);
    const fresh   = queries.filter(q => q.status !== 'closed' && q.days_open < 3);
    const resolved= queries.filter(q => q.status === 'closed');

    let html = '';
    if (overdue.length) { html += `<div class="sec-label">Overdue — 3+ Days</div>`; overdue.forEach(q => { html += APP.queryCard(q, true); }); }
    if (fresh.length)   { html += `<div class="sec-label">Open — Within 3 Days</div>`; fresh.forEach(q => { html += APP.queryCard(q, true); }); }
    if (resolved.length){ html += `<div class="sec-label" style="margin-top:20px">Resolved</div>`; resolved.forEach(q => { html += APP.queryCard(q, false); }); }
    if (!queries.length) html = UI.empty('','No queries');

    el.innerHTML = html;
  },

  async renderQueriesSite() {
    const el  = UI.contentEl();
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getQueries(pid);
    const queries = data?.queries || [];
    let html = '';
    queries.forEach(q => { html += APP.queryCard(q, false); });
    if (!queries.length) html = UI.empty('','No queries raised yet');
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
      <p style="color:#666;font-size:13px;margin-bottom:12px">
        Upload Excel with columns: <strong>Stage</strong>, <strong>Percentage</strong>, <strong>Contract Value</strong>.
        System computes amounts and creates milestones.
      </p>
      <div class="field-row">
        <label class="field-label" for="fs-file">Excel file</label>
        <input type="file" id="fs-file" accept=".xlsx,.xls">
      </div>
      <button class="btn-primary" onclick="APP.uploadFeeSchedule(${projectId})">Upload</button>
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
      UI.toast(`Fee schedule uploaded — ${res.rows_inserted||0} milestones created`);
      if (APP.renderBudget) APP.renderBudget();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
  },


  // ── MATERIALS
  async renderMaterials() {
    const el  = UI.contentEl();
    const pid = APP.state.selectedProject;
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

    let html = `<button class="btn-primary" style="margin-bottom:16px" onclick="APP.showRaiseRequest(${pid})">+ New Material Request</button>`;

    // BOQ header — shows current version + item count per stream + action buttons
    html += `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div class="card-title">BOQ</div>
          <div class="card-meta" style="font-family:var(--mono);font-size:11px">
            ${currentDesign   ? `Design: ${currentDesign.label} · ${currentDesign.item_count} items`       : 'Design: —'}<br>
            ${currentServices ? `Services: ${currentServices.label} · ${currentServices.item_count} items` : 'Services: —'}
          </div>
        </div>
        ${canEditBOQ ? `<button class="btn-sm navy" onclick="APP.showBOQVersions(${pid})">Versions</button>` : ''}
      </div>
      ${canEditBOQ ? `
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <input type="file" id="boq-file" accept=".xlsx,.xls" style="display:none" onchange="APP.uploadBOQ(${pid},this)">
          <button class="btn-sm gold" onclick="document.getElementById('boq-file').click()">Upload New BOQ</button>
          <button class="btn-sm" onclick="APP.showAddBOQItem(${pid})">+ Add Item</button>
        </div>` : ''}
    </div>`;

    // BOQ item list (current version only) — show inline so heads can edit/delete directly
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
          html += `<div style="font-size:11px;font-weight:600;color:var(--navy);background:#f4f4f4;padding:4px 10px;margin-top:6px">${UI.escapeText(trade)} (${byTradeList[trade].length})</div>`;
          byTradeList[trade].forEach(item => {
            html += `<div class="card" style="margin:4px 0;padding:8px 10px">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:500">${UI.escapeText(item.item_name)}</div>
                  <div style="font-size:10px;color:var(--muted);font-family:var(--mono)">
                    ${item.item_code ? UI.escapeText(item.item_code)+' · ' : ''}${item.quantity||0} ${UI.escapeText(item.unit||'')}
                  </div>
                </div>
                <div style="display:flex;gap:4px">
                  <button class="btn-sm" onclick="APP.showEditBOQItem(${pid},${item.id})">✎</button>
                  <button class="btn-sm" onclick="APP.deleteBOQItem(${pid},${item.id},'${UI.escapeAttr(item.item_name)}')">🗑</button>
                </div>
              </div>
            </div>`;
          });
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
    const pid = APP.user.projects?.[0]?.id;
    if (!pid) { el.innerHTML = UI.empty('','No project assigned'); return; }

    const [reqData] = await Promise.all([API.getRequests(pid)]);
    const requests = reqData?.requests || [];
    let html = `<button class="btn-primary" style="margin-bottom:16px" onclick="APP.showRaiseRequest(${pid})">+ New Request</button>`;
    requests.forEach(r => { html += APP.matCard(r, r.is_overdue); });
    if (!requests.length) html += UI.empty('','No material requests yet');
    el.innerHTML = html;
  },

  matCard(r, isOverdue) {
    const step = (r.status || 1) - 1;
    return `<div class="card" style="${isOverdue?'border-color:rgba(168,74,58,.5)':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="card-title">${r.item_name}</div>
          <div class="card-meta">${r.trade} · ${r.unit}</div>
        </div>
        ${isOverdue?'<span class="badge b-red">OVERDUE</span>':`<span class="badge b-navy">${r.quantity_needed} ${r.unit}</span>`}
      </div>
      <div class="card-meta" style="margin-top:4px">Needed by: ${UI.fmtDate(r.needed_by_date)}</div>
      <div class="status-track">
        ${MAT_STATUSES.map((s,i)=>`<div class="st-step${i<step+1?' done':''}${i===step?' current':''}">
          <div class="st-dot">${i<step+1?'✓':''}</div>
          <div class="st-label">${s.split(' ')[0]}</div>
        </div>`).join('')}
      </div>
      ${['pmc_head','principal','design_principal'].includes(APP.user.role) && r.status < 5 ?
        `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          ${MAT_STATUSES.slice(r.status).map((s,i)=>`<button class="btn-sm" onclick="APP.updateMatStatus(${r.id},${r.status+i+1})">${s}</button>`).join('')}
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
    // Build-commit lock #8: rows arrive merged from BOTH wa_pending_actions
    // (source='legacy') and approvals (source='unified'). Frontend dispatches
    // approve/reject/vote/cancel calls based on this tag.
    const isUnified = a.source === 'unified';
    const typeKey = a.action_type || a.request_type;  // unified uses action_type, legacy uses request_type
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

    // Dispatch buttons differ by source.
    let actionsHtml = '';
    if (canAct && a.status === 'pending') {
      if (isUnified) {
        actionsHtml = `<div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-approve" onclick="APP.voteApprovalV2(${a.id},'approve')">Approve</button>
          <button class="btn-reject"  onclick="APP.voteApprovalV2(${a.id},'reject')">Reject</button>
        </div>`;
      } else {
        actionsHtml = `<div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-approve" onclick="APP.approveRequest(${a.id})">Approve</button>
          <button class="btn-reject"  onclick="APP.rejectRequest(${a.id})">Reject</button>
        </div>`;
      }
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
    const res = await API.raiseApproval({ project_id: pid, request_type: type, title, details, drift_days: drift||null });
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
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const data = await API.getChanges(pid);
    const changes = data?.changes || [];
    const role = APP.user.role;

    let html = `<button class="btn-primary" style="margin-bottom:16px" onclick="APP.showRaiseChange(${pid})">+ New Change Notice</button>`;

    if (!changes.length) {
      html += UI.empty('','No change notices');
    } else {
      changes.forEach(c => {
        const allSigned = c.sig_design_head && c.sig_services_head && c.sig_pmc;
        const canSign   = ['design_head','services_head','pmc_head'].includes(role);
        const canApprove= ['principal','design_principal'].includes(role) && allSigned;

        html += `<div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <div style="font-family:var(--mono);font-size:10px;font-weight:600;color:var(--navy)">${c.cn_number}</div>
            <span class="badge ${allSigned?'b-amber':'b-blue'}">${allSigned?'PENDING APPROVAL':'COLLECTING SIGS'}</span>
          </div>
          <div class="card-title">${c.title}</div>
          <div class="card-meta">${c.project_id} · ${c.raised_by_name} · ${c.raised_at?.split('T')[0]||''} · Source: ${c.source}</div>
          <div class="card-meta" style="margin-top:3px">Drawings: ${c.affected_drawings||'—'} · BOQ: ${c.boq_impact?'Yes':'No'} · Schedule: +${c.schedule_impact_days}d</div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5">${c.description}</div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <span class="sig-chip ${c.sig_design_head?'sig-signed':'sig-pending'}">Design Head ${c.sig_design_head?'✓':'○'}</span>
            <span class="sig-chip ${c.sig_services_head?'sig-signed':'sig-pending'}">Services Head ${c.sig_services_head?'✓':'○'}</span>
            <span class="sig-chip ${c.sig_pmc?'sig-signed':'sig-pending'}">PMC ${c.sig_pmc?'✓':'○'}</span>
          </div>
          ${canSign && !allSigned?`<button class="btn-sm gold" style="margin-top:10px" onclick="APP.signChange(${c.id})">Sign Off</button>`:''}
          ${canApprove?`<div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn-approve" onclick="APP.approveChange(${c.id})">Approve</button>
            <button class="btn-reject" onclick="APP.rejectChange(${c.id})">Reject</button>
          </div>`:''}
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
    const pid = APP.user.projects?.[0]?.id;
    const date= APP.state.selectedDate;
    const today = APP.state.serverToday || UI.todayIST();
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
      `<button style="min-height:44px;min-width:80px;text-align:center;display:inline-block;padding:4px 10px;margin-right:6px;border-radius:14px;font-size:11px;cursor:pointer;
        ${filter===key?'background:#1D3D62;color:#fff':'background:#f0f0f0;color:#666'}" onclick="APP.state.photoFilter='${key}';APP.renderPhotos()">${label}</button>`;
    const filterRow = `<div style="padding:6px 4px 10px">${chip('all','All')}${chip('progress','Progress')}${chip('defects','Defects')}</div>`;

    const count = photos.length;
    let html = strip + filterRow + `
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
        html += `<button style="min-height:44px;position:relative;width:60px;height:60px;cursor:pointer" onclick="APP.openPhotoViewer(${pid}, ${p.id}, ${i})">
          <img src="${API.fileUrl(p.file_url || p.file_path, 'photos')}" alt="Site photo ${i+1}" style="width:60px;height:60px;border-radius:var(--r);object-fit:cover;border:1px solid var(--border)" onerror="this.style.background='var(--bg)'">
          ${defectPip}
          <div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,.7);font-size:8px;color:#fff;padding:1px 3px;border-radius:2px;font-family:var(--mono)">${i+1}</div>
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
  openPhotoViewer(projectId, photoId, idx) {
    const photo = (APP._photosCache || [])[idx];
    if (!photo) { UI.toast('Photo not found'); return; }
    const uploadedBy = photo.uploaded_by_name || 'Unknown';
    const dateStr = photo.photo_date || '';
    const isDefect = photo.entity_type === 'issue' && photo.linked_issue?.issue_type === 'snag';
    const sevColor = { critical:'#C84040', major:'#C87060', minor:'#C8A040' };

    let footerHtml;
    if (isDefect) {
      const li = photo.linked_issue;
      const col = sevColor[li.severity] || '#C87060';
      footerHtml = `
        <div style="background:#fef5f0;border:1px solid ${col};border-left:4px solid ${col};padding:10px;border-radius:var(--r);margin-bottom:10px">
          <div style="font-size:11px;font-weight:bold;color:${col}">⚠ ${li.severity?li.severity.toUpperCase():'DEFECT'} · ${li.issue_number||''}</div>
          <div style="font-size:12px;color:#444;margin-top:3px">${li.trade||''} · ${li.status||''}</div>
        </div>
      `;
    } else {
      footerHtml = `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-sm" onclick="APP.flagPhotoAsDefect(${projectId}, ${photoId})" style="background:#C87060;color:#fff">⚠ Flag as Defect</button>
        </div>
      `;
    }

    UI.showModal('Photo', `
      <div style="text-align:center;margin-bottom:12px">
        <img src="${API.fileUrl(photo.file_url || photo.file_path, 'photos')}" alt="Site photo" style="max-width:100%;max-height:60vh;border-radius:var(--r2);border:1px solid var(--border)">
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">
        Uploaded by ${uploadedBy} · ${dateStr}
      </div>
      ${photo.caption ? `<div style="font-size:13px;margin-bottom:12px">${photo.caption}</div>` : ''}
      ${footerHtml}
    `);
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

  async uploadPhotos(pid, input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append('photo', f));
    fd.append('source', 'app');
    const res = await API.uploadPhoto(pid, fd);
    if (res?.success) {
      UI.toast(`${res.count} photo${res.count>1?'s':''} uploaded ✓`);
      APP.renderPhotos();
    } else {
      UI.toast(res?.error || 'Upload failed');
    }
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
    const pid = APP.state.selectedProject || APP.user.projects?.[0]?.id;
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

    let html = `
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
      <div class="btn-row">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="document.getElementById('doc-input').click()">Choose File</button>
      </div>`;
    UI.openModal('Upload New Document', body);
  },

  async uploadNewDocument(pid, input) {
    const file = input.files?.[0];
    if (!file) return;
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
    APP.renderDocuments();
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
            return `<div class="prog-row">
              <div class="prog-label" style="font-size:12px">${trade.split(' ')[0]}</div>
              <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${col}"></div></div>
              <div class="prog-pct" style="font-size:12px">${pct}%</div>
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
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

    const role = APP.user?.role;
    const canDraft   = ['pmc_head','principal','design_principal'].includes(role);
    const canApprove = ['pmc_head'].includes(role);
    const canSend    = ['principal','design_principal'].includes(role);

    const data = await API.getReports(pid).catch(() => null);
    if (!data) { el.innerHTML = UI.empty('️','Could not load reports'); return; }
    const reports = data.reports || [];

    let html = '';

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
      <div class="field-row"><label class="field-label">Summary</label>
        <textarea id="rpt-summary" rows="4" placeholder="Work completed this week, progress highlights…">${UI.escapeText(lastSummary)}</textarea></div>
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
    const pid = APP.state.selectedProject;
    if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
    el.innerHTML = [
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
    const pid = APP.state.selectedProject;
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

    let html = '';

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
                           color:${MOB_COLOUR[e.mobilisation_status]||'#888'};font-weight:600;border-radius:4px;background:#fff">
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
    if (res?.success) { UI.closeModal(); UI.toast(res.message || 'Engaged ✓'); APP.renderVendors(); }
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
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Upload an Excel with columns: Vendor Name, Trade, Scope, Contract Value, Contact, Phone, Account Number, IFSC.
        Vendors not in master will be created. Engagements will land as <b>pending approval</b>.
      </p>
      <input type="file" id="eng-bulk-file" accept=".xlsx,.xls">
      <button class="btn-primary" style="margin-top:10px" onclick="APP.submitEngagementBulkUpload(${pid})">Upload</button>
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
      APP.renderVendors();
    } else UI.toast(res?.error || 'Upload failed');
  },

  showRaisePayment(pid, vendorId, vendorName, engagementId) {
    const today = APP.state.serverToday || UI.todayIST();
    const weekEnd = UI.addDays(today, 6 - new Date(today+'T00:00:00').getDay());
    const TYPES = ['running_account_bill','advance','mobilisation_advance','material_advance',
                   'final_bill','retention_release','extra_item','deduction'];
    UI.openModal(`Payment — ${vendorName}`, `
      <div style="margin-bottom:14px">
        <label class="field-label">Scan invoice to auto-fill</label>
        <input type="file" accept="image/*,.pdf" id="pay-invoice-scan" onchange="APP.readInvoice(this)" style="margin-top:4px">
      </div>
      <div class="field-row"><label class="field-label" for="pay-type">Payment Type</label>
        <select id="pay-type">
          ${TYPES.map(t=>`<option value="${t}">${t.replace(/_/g,' ').toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="field-row"><label class="field-label" for="pay-amt">Amount (₹)</label><input type="text" id="pay-amt" placeholder="0"></div>
      <div class="field-row"><label class="field-label" for="pay-pct">Work Done % (for RA bills)</label><input type="text" id="pay-pct" placeholder="Optional"></div>
      <div class="field-row"><label class="field-label" for="pay-week">Week Ending</label><input type="date" id="pay-week" value="${weekEnd}"></div>
      <div class="field-row"><label class="field-label" for="pay-notes">Notes</label><textarea id="pay-notes" rows="2"></textarea></div>
      <button class="btn-primary" onclick="APP.submitPayment(${pid},${vendorId},${engagementId||'null'})">Raise Payment Request</button>
    `);
  },

  async submitPayment(pid, vendorId, engagementId) {
    const data = {
      vendor_id:       vendorId,
      engagement_id:   engagementId || null,
      payment_type:    document.getElementById('pay-type')?.value,
      amount_requested:document.getElementById('pay-amt')?.value,
      work_done_pct:   document.getElementById('pay-pct')?.value || null,
      week_ending:     document.getElementById('pay-week')?.value,
      notes:           document.getElementById('pay-notes')?.value.trim(),
    };
    if (!data.amount_requested || !data.week_ending) { UI.toast('Amount and week ending required'); return; }
    const res = await API.raisePayment(pid, data);
    if (res?.success) { UI.closeModal(); UI.toast('Payment request raised ✓'); APP.renderVendors(); }
    else UI.toast(res?.error || 'Failed');
  },

  async approvePayment(id) {
    const pid = APP.state.selectedProject;
    if (!pid) { UI.toast('Select a project first'); return; }
    const ok = await UI.confirm('Approve this payment?');
    if (!ok) return;
    const res = await API.approvePayment(pid, id);
    if (res?.success) { UI.toast('Payment approved ✓'); APP.renderVendors(); }
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
// Self-service password reset removed. Users ask manager or Naveen/Ajay to reset
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
          ${q.ai_suggestion ? `<div style="font-size:12px;color:#657B90;background:#F0F3F7;padding:6px;border-radius:4px;margin-top:4px">AI: ${q.ai_suggestion} ${!q.validated_by?'<span style="color:#C87060">(pending validation)</span>':''}</div>` : ''}
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
    design_head:    ['detailing_head','team_lead','jr_architect'],
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
      ? `<div style="padding:8px 10px;font-size:11px;color:#A06030;background:#FFF6E8;border-radius:4px;margin-bottom:8px">
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
    design_head:   [['team_lead','Team Lead'],['jr_architect','Jr Architect'],['detailing','Detailing Staff']],
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
  if (res?.success) { UI.closeModal(); UI.toast('Request submitted — pending Naveen/Ajay approval ✓'); }
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
          ? `<span style="background:#E8F5E8;color:#4A8A5A;padding:2px 6px;border-radius:3px">✓ ${SIGNOFF_LABEL[r]||r}</span>`
          : `<span style="background:#F5F5F5;color:#888;padding:2px 6px;border-radius:3px">○ ${SIGNOFF_LABEL[r]||r}</span>`;
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

APP.renderAISettings = async function() {
  const el = UI.contentEl();
  const data = await API.get('/ai/settings');
  if (!data) return;
  const toggles = data.toggles || {};

  let html = '<div class="sec-label">AI Features</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Toggle AI-powered features on or off. Changes take effect immediately.</div>';

  AI_FEATURES.forEach(f => {
    const checked = toggles[f.key] ? 'checked' : '';
    html += `<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${f.label}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${f.desc}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" ${checked} onchange="APP.toggleAIFeature('${f.key}',this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  });

  el.innerHTML = '<div class="fade-in">' + html + '</div>';
};

APP.toggleAIFeature = async function(key, enabled) {
  const res = await API.post('/ai/settings', { feature_key: key, enabled });
  if (res?.success) {
    UI.toast(enabled ? 'Feature enabled' : 'Feature disabled');
    // Update local toggle cache
    if (!APP.state.aiToggles) APP.state.aiToggles = {};
    if (enabled) APP.state.aiToggles[key] = true;
    else delete APP.state.aiToggles[key];
  }
  else UI.toast(res?.error || 'Failed to update');
};

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
    html += `<div style="background:#E8F5E8;border:1px solid #4A8A5A;border-radius:8px;padding:16px;text-align:center;margin-top:8px">
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
      <div style="background:#eee;height:8px;border-radius:4px;margin-top:8px;overflow:hidden">
        <div style="background:#4A8A5A;height:100%;width:${res.completion_pct}%;border-radius:4px"></div>
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
        res.similar.map(s => `<div style="background:#F0F3F7;padding:8px;border-radius:4px;margin-bottom:4px;font-size:12px">
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  // Daily reports endpoint (Sprint 3 Item 10). The earlier /reports/:pid endpoint
  // returned weekly_reports and is reserved for the weekly health/report view.
  const data = await API.get(`/daily-reports/${pid}`);
  if (!data) return;
  const reports = data.reports || [];

  const pending  = reports.filter(r => r.status === 'pending_review');
  const flagged  = reports.filter(r => r.status === 'flagged');

  let html = '';

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
        ${r.flag_reason ? `<div class="rc-note" style="color:var(--red)">⚠ ${r.flag_reason.substring(0,120)}</div>` : ''}
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/grn/${pid}`);
  if (!data) return;
  const grns = data.grns || [];

  const pending = grns.filter(g => g.status === 'pending');
  const role = APP.user.role;
  const canRaise = ['site_manager','senior_site_manager','pmc_head'].includes(role);
  const canApprove = ['senior_site_manager','pmc_head','principal','design_principal'].includes(role);

  let html = '';

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
    </div>`;
  });

  if (!grns.length) html = UI.empty('','No GRNs yet');
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
APP.showGRNForm = function() {
  UI.openModal('Raise GRN', `
    <div class="field-row"><label class="field-label" for="grn-vendor">Vendor</label>
      <div style="display:flex;gap:8px">
        <input type="text" id="grn-vendor" placeholder="Vendor name" style="flex:1" readonly>
        <button class="btn-secondary" onclick="APP.showVendorPicker(v=>{document.getElementById('grn-vendor').value=v.vendor_name;APP.state.selectedGRNVendor=v;})" style="white-space:nowrap;width:auto;min-width:0">Pick</button>
      </div></div>
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
    <button class="btn-primary" onclick="APP.submitGRN()">Submit GRN</button>
  `);
};
APP.submitGRN = async function() {
  const pid = APP.state.selectedProject;
  const qty = parseFloat(document.getElementById('grn-qty').value||0);
  const rate= parseFloat(document.getElementById('grn-rate').value||0);
  const body = {
    vendor_name:       document.getElementById('grn-vendor').value,
    material_name:     document.getElementById('grn-material').value,
    quantity_received: qty,
    unit:              document.getElementById('grn-unit').value,
    unit_rate:         rate,
    total_value:       qty * rate,
    delivery_date:     document.getElementById('grn-date').value,
  };
  if (!body.vendor_name || !body.material_name || !body.quantity_received) {
    UI.toast('Fill in vendor, material and quantity'); return;
  }
  const res = await API.post(`/grn/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('GRN raised ✓'); APP.renderGRN(); }
};

// ── ISSUES — register
APP.renderIssues = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('️','Select a project first'); return; }

  const data = await API.get(`/issues/${pid}`);
  if (!data) return;
  const issues = data.issues || [];

  const role = APP.user.role;
  const canRaise   = ['site_manager','senior_site_manager','pmc_head','design_head','services_head'].includes(role);
  const canConfirm = ['pmc_head','design_head','services_head','principal','design_principal'].includes(role);

  let html = '';

  const needsConfirm = issues.filter(i => i.status === 'draft' && canConfirm);
  if (needsConfirm.length) {
    html += `<div class="sec-label">Needs Confirmation (${needsConfirm.length})</div>`;
    needsConfirm.forEach(i => {
      html += `<div class="issue-item ${i.issue_type}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;width:100%">
          <div style="flex:1;min-width:0">
            <div class="iss-num">${i.issue_number||'ISS-'+i.id} · <span style="text-transform:uppercase;font-size:10px">${i.issue_type}</span></div>
            <div class="iss-title">${i.title}</div>
            <div class="iss-meta">Raised: ${i.raised_by_name||'—'} · ${UI.fmtDate(i.created_at)}</div>
          </div>
          <span class="badge b-amber">Draft</span>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn-approve" onclick="APP.confirmIssue(${i.id})">Confirm</button>
          <button class="btn-reject" onclick="APP.dismissIssue(${i.id})">Dismiss</button>
        </div>
      </div>`;
    });
  }

  const typeFilters = ['all','quality','design','rfi','safety','compliance'];
  const cur = APP.state.issueFilter || 'all';
  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Issues Register</div>
    ${canRaise ? `<button class="btn-primary sec-hdr-btn" onclick="APP.showIssueForm()">+ Raise Issue</button>` : ''}
  </div>
  ${canRaise ? `<button class="btn-primary sec-action-mobile" onclick="APP.showIssueForm()">+ Raise Issue</button>` : ''}
  ${APP._sortToggleHTML('issues', ['default','urgency','age'])}
  <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:12px">
    ${typeFilters.map(f => `<button style="min-height:44px;flex-shrink:0;padding:5px 12px;border-radius:4px;font-size:11px;cursor:pointer;font-family:var(--mono);text-transform:uppercase;border:1px solid ${f===cur?'var(--navy)':'var(--border)'};background:${f===cur?'var(--navy)':'var(--white)'};color:${f===cur?'var(--white)':'var(--muted)'}" onclick="APP.state.issueFilter='${f}';APP.renderIssues()">${f}</button>`).join('')}
  </div>`;

  let filtered = cur === 'all' ? issues.filter(i => i.status !== 'draft') : issues.filter(i => i.issue_type === cur && i.status !== 'draft');
  filtered = APP._applySort(filtered, APP._getSortMode('issues'), { urgencyField:'issue_type', ageField:'raised_at' });
  if (!filtered.length) { html += UI.empty('','No issues in this category'); }
  else filtered.slice(0,20).forEach(i => {
    const badge = i.status === 'open' ? 'b-red' : i.status === 'in_progress' ? 'b-amber' : 'b-green';
    html += `<button class="issue-item ${i.issue_type}" style="min-height:44px;cursor:pointer" onclick="APP.openIssueDetail(${i.id})">
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
  const pid = APP.state.selectedProject;
  const data = await API.get(`/issues/${pid}`);
  if (!data) return;
  const issue = (data.issues || []).find(x => x.id === issueId);
  if (!issue) { UI.toast('Issue not found'); return; }

  const me = APP.user || {};
  const role = me.role;
  const isAssignee = issue.assigned_to === me.id;
  const isStreamHead  = ['design_head','services_head'].includes(role);
  const isPMCorUp     = ['principal','design_principal','pmc_head'].includes(role);
  const isSiteOrUp    = ['site_manager','senior_site_manager'].includes(role);

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
  UI.openModal('Raise Issue', `
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
    <div class="field-row"><label class="field-label" for="iss-due">Due Date</label>
      <input type="date" id="iss-due"></div>
    <button class="btn-primary" onclick="APP.submitIssue()">Raise Issue</button>
  `);
};
APP.submitIssue = async function() {
  const pid = APP.state.selectedProject;
  const body = {
    issue_type: document.getElementById('iss-type').value,
    title:      document.getElementById('iss-title').value,
    description:document.getElementById('iss-desc').value,
    due_date:   document.getElementById('iss-due').value || null,
  };
  if (!body.title) { UI.toast('Add a title'); return; }
  const res = await API.post(`/issues/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('Issue raised ✓'); APP.renderIssues(); }
};

// ── MOMs — list + create + action items
// renderMeetings is the unified entry point (Fold B).
// Delegates to renderMOMs for now — full meeting-type filtering can come later.
APP.renderMeetings = function() { return APP.renderMOMs(); };

APP.renderMOMs = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/meetings/${pid}`);
  if (!data) return;
  const moms = data.moms || [];

  const role = APP.user.role;
  const canCreate = ['pmc_head','principal','design_principal'].includes(role);

  let html = '';

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
  else moms.slice(0,15).forEach(m => {
    const statusBadge = m.status === 'approved' ? 'b-green' : m.status === 'issued' ? 'b-navy' : 'b-amber';
    const pending = (m.action_items||[]).filter(a => !a.completed).length;
    html += `<button class="mom-item" style="min-height:44px" onclick="APP.viewMOM(${m.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div class="mom-num">${m.mom_number||'MOM-'+m.id}</div>
          <div class="mom-title">${m.title||m.project_name}</div>
          <div class="mom-meta">${UI.fmtDate(m.meeting_date)} · ${m.created_by_name||'—'}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="badge ${statusBadge}">${m.status||'draft'}</span>
          ${pending ? `<span class="badge b-amber">${pending} open</span>` : ''}
        </div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.viewMOM = async function(id) {
  const data = await API.get(`/meetings/${id}/action-items`);
  if (!data) return;
  const actions = data.action_items || [];
  const modal = document.getElementById('modal-body');
  modal.innerHTML = `
    <div class="modal-title">Action Items <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:.08em">${actions.length} items</div>
    ${actions.map(a => `
    <div class="action-row">
      <div class="ar-who">${(a.assigned_to_name||'—').split(' ')[0]}</div>
      <div class="ar-text">${a.action}</div>
      <div class="ar-due ${new Date(a.due_date)<new Date()&&!a.completed?'overdue':''}">${UI.fmtDate(a.due_date)}</div>
      ${!a.completed ? `<button class="btn-sm approve" onclick="APP.doneAction(${a.id})">Done</button>` : `<span style="font-size:18px"></button>`}
    </div>`).join('')}
    ${!actions.length ? UI.empty('','No action items') : ''}`;
  document.getElementById('modal-overlay').classList.add('open');
};

APP.doneAction = async function(id) {
  const res = await API.patch(`/meetings/action-items/${id}/complete`, {});
  if (res?.success) UI.toast('Marked done ✓');
};
APP.showMOMForm = function() {
  UI.openModal('New MOM', `
    <div class="field-row"><label class="field-label" for="mom-title">Title / Purpose</label>
      <input type="text" id="mom-title" placeholder="e.g. Site coordination meeting"></div>
    <div class="field-row"><label class="field-label" for="mom-date">Meeting Date</label>
      <input type="date" id="mom-date" value="${UI.todayIST()}"></div>
    <div class="field-row"><label class="field-label" for="mom-attendees">Attendees</label>
      <input type="text" id="mom-attendees" placeholder="Names separated by commas"></div>
    <button class="btn-primary" onclick="APP.submitMOM()">Create MOM</button>
  `);
};
APP.submitMOM = async function() {
  const pid = APP.state.selectedProject;
  const body = {
    title:        document.getElementById('mom-title').value,
    meeting_date: document.getElementById('mom-date').value,
    attendees:    document.getElementById('mom-attendees').value,
  };
  if (!body.title || !body.meeting_date) { UI.toast('Fill in title and date'); return; }
  const res = await API.post(`/meetings/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('MOM created ✓'); APP.renderMOMs(); }
};

// ── LABOUR REGISTER — site manager enters, PMC validates
APP.renderLabour = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/labour/${pid}`);
  if (!data) return;
  const entries = data.entries || [];

  const role = APP.user.role;
  const canEnter    = ['site_manager','senior_site_manager'].includes(role);
  const canValidate = ['pmc_head','principal','design_principal'].includes(role);

  let html = '';

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
          <div class="card-meta">${UI.fmtDate(e.register_date)} · ${e.entered_by_name||'—'}</div>
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/meetings/${pid}`);
  if (!data) return;
  const visits = data.visits || [];

  const role = APP.user.role;
  const canLog = ['pmc_head','principal','design_principal','design_head','services_head'].includes(role);

  let html = '';
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/budget/${pid}`);
  if (!data) return;
  const heads = data.cost_heads || [];
  const totals = data.totals || {};

  const overallPct = totals.sanctioned > 0 ? ((totals.committed / totals.sanctioned)*100).toFixed(1) : '0.0';
  const totalColor = overallPct > 1.5 ? 'red' : overallPct > 1 ? 'amber' : 'green';
  const sanctioned = parseFloat(totals.sanctioned) || 0;
  const committed = parseFloat(totals.committed) || 0;

  let html = APP._budgetToggleHTML() + `
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

// ── PAYMENTS — Naveen Saturday batch approval.
// Design Head / Services Head only see advance + final bills (Sprint 2 Item 4).
// They have design-stream oversight on these but not on weekly labour/material cycles.
APP.renderPayments = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

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

  let html = '';

  if (pending.length) {
    const total = pending.reduce((s,p) => s + parseFloat(p.amount_requested||0), 0);
    html += `<div class="action-item c-navy" style="margin-bottom:16px">
      <div class="ai-icon"></div>
      <div class="ai-body">
        <div class="ai-title">Approve all — ${Money.formatRupee(total)}</div>
        <div class="ai-meta">${pending.length} vendor${pending.length>1?'s':''} waiting</div>
      </div>
      <button class="btn-sm approve" onclick="APP.batchApprovePayments('${pid}')">Approve All</button>
    </div>`;
    html += `<div class="sec-label">Payment Queue</div>`;
    html += APP._sortToggleHTML('payments', ['default','age']);
    const sortedPending = APP._applySort(pending, APP._getSortMode('payments'), { ageField:'created_at' });
    sortedPending.forEach(p => {
      html += `<div class="pay-item" data-pr-id="${p.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div class="pay-vendor">${p.vendor_name||'—'}</div>
            <div class="pay-scope">${(p.scope||'').substring(0,50)}</div>
            <div class="pay-meta">${UI.fmtDate(p.created_at)}</div>
          </div>
          <div class="pay-amount">${Money.formatRupee(p.amount_requested)}</div>
        </div>
      </div>`;
    });
  } else {
    html += UI.empty('','No payments pending approval');
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
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

// ── PAYMENTS FINANCE — Udupa view (Saturday workflow)
APP.renderPaymentsFin = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/payment-requests/${pid}/weekly-batch`);
  if (!data) return;
  const pending = data.pending || [];

  const total = pending.reduce((s,p) => s + parseFloat(p.amount_requested||0), 0);

  let html = `
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
    html += `
    <div class="sec-label">Steps</div>
    <div class="card" style="margin-bottom:8px">
      <div class="card-title">Step 1 — Run pre-upload check</div>
      <div class="card-meta">Validates account numbers and checks for duplicates</div>
      <button class="btn-secondary" style="margin-top:10px;width:100%" onclick="APP.runPreUploadCheck('${pid}')">
        Run Validation Check
      </button>
    </div>
    <div class="card" id="precheck-results" style="display:none;margin-bottom:8px"></div>
    <div class="card" style="margin-bottom:8px">
      <div class="card-title">Step 2 — Download ICICI Excel</div>
      <div class="card-meta">19-column PAB bulk payment format — ready to upload to ICICI portal</div>
      <a href="/api/payments/${pid}/icici-excel" download>
        <button class="btn-primary" style="margin-top:10px">
          Download ICICI Excel
        </button>
      </a>
    </div>
    <div class="card">
      <div class="card-title">Step 3 — Upload to ICICI portal</div>
      <div class="card-meta">Login to ICICI Corporate → Bulk Payments → Upload file</div>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">
        UTRs will be pushed back to the app automatically once payments process.
        Each vendor will receive WhatsApp confirmation with their UTR.
      </div>
    </div>`;
  } else {
    html += UI.empty('','No approved payments to process');
  }

  html += `<div class="sec-label">Payments</div>`;
  pending.forEach(p => {
    html += `<div class="pay-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="pay-vendor">${p.vendor_name||'—'}</div>
          <div class="pay-scope">${(p.scope||'').substring(0,50)}</div>
          <div class="pay-meta">${p.bank_ifsc||'—'} · ${(p.bank_ifsc||'').startsWith('ICIC')?'FT':'NEFT'}</div>
        </div>
        <div class="pay-amount">${Money.formatRupee(p.amount_requested)}</div>
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

// ── PI — proforma invoices
APP.renderPI = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  const data = await API.get(`/invoices/${pid}/pi`);
  if (!data) return;
  const pis = data.invoices || [];
  const canRaise = ['pmc_head','principal','design_principal','finance_admin'].includes(APP.user.role);

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sec-label" style="margin:0">Proforma Invoices</div>
      ${canRaise ? `<button class="btn-primary" onclick="APP.showRaisePI(${pid})">+ Raise PI</button>` : ''}
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
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
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
      // Udupa: offer to complete master right now
      const name = (res.error || '').match(/"([^"]+)"/)?.[1] || 'this client';
      if (confirm(`${res.error}\n\nOpen completion form now?`)) {
        APP.showCompleteClient(res.client_id, name);
      }
    } else {
      UI.toast('Client master incomplete — ask Udupa (finance) to complete it before raising PI');
    }
    return;
  }
  if (res?.code === 'CLIENT_NOT_LINKED') {
    UI.toast('This project has no client on record — contact finance');
    return;
  }

  UI.toast(res?.error || 'Failed to raise PI');
};

// ── PETTY CASH — Udupa
APP.renderPettyCash = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }
  const data = await API.get(`/finance/${pid}/petty-cash`);
  if (!data) return;
  const entries = data.entries || [];
  const balance = data.balance || 0;

  let html = `
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
  <div class="sec-label">Recent Transactions</div>`;
  entries.slice(0,10).forEach(e => {
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between">
        <div>
          <div class="card-title">${e.description||'—'}</div>
          <div class="card-meta">${UI.fmtDate(e.created_at)} · ${e.created_by_name||'—'}</div>
        </div>
        <div style="font-family:var(--mono);font-size:15px;font-weight:600;color:var(--red)">-${Money.formatRupee(e.amount)}</div>
      </div>
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── USERS — Naveen user management
APP.renderUsers = async function() {
  const el = UI.contentEl();

  const [pending, all, resettable] = await Promise.all([
    API.get('/user-management/pending'),
    API.get('/users'),
    API.get('/admin-reset/resettable-users'),
  ]);

  const resettableIds = new Set((resettable?.users||[]).map(u => u.id));

  let html = `
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Bulk Upload Users</div>
    <div class="card-meta">Upload Excel with all team members at once — use the template</div>
    <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:10px" class="bulk-upload-actions">
      <a href="/templates/nu_PMC_BulkUpload_Templates_v1.xlsx" download>
        <button class="btn-secondary">Download Template</button>
      </a>
      <label>
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="APP.bulkUploadUsers(this)">
        <button class="btn-primary" onclick="this.previousElementSibling.click()">Upload Excel</button>
      </label>
    </div>
  </div>`;

  const approvals = pending?.pending || [];
  if (approvals.length) {
    html += `<div class="sec-label">Pending Approval (${approvals.length})</div>`;
    approvals.forEach(u => {
      html += `<div class="action-item c-amber">
        <div class="ai-icon"></div>
        <div class="ai-body">
          <div class="ai-title">${UI.escapeText(u.full_name)}</div>
          <div class="ai-meta">${u.role} · ${u.email||u.phone||'—'}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm approve" onclick="APP.approveUser(${u.id})">Approve</button>
          <button class="btn-sm reject"  onclick="APP.rejectUser(${u.id})">Reject</button>
        </div>
      </div>`;
    });
  }

  const isPrincipal = ['principal','design_principal'].includes(APP.user?.role);
  html += `<div class="sec-hdr-row">
    <div class="sec-label" style="margin:0;flex:1">Active Users</div>
    ${isPrincipal ? `<button class="btn-primary sec-hdr-btn" onclick="APP.openAddUserModal()">+ Add User</button>` : ''}
  </div>
  ${isPrincipal ? `<button class="btn-primary sec-action-mobile" onclick="APP.openAddUserModal()">+ Add User</button>` : ''}`;
  (all?.users||[]).forEach(u => {
    const canReset = resettableIds.has(u.id);
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <div class="card-title">${UI.escapeText(u.full_name)}</div>
          <div class="card-meta">${APP._roleLabel(u.role)} · ${u.email||u.phone||'—'}</div>
        </div>
        <div style="display:flex;gap:12px;flex-shrink:0;align-items:center;justify-content:flex-end;width:182px">
          <span class="badge b-green" style="height:32px;min-height:32px;width:80px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;margin:0;font-weight:600;font-size:11px;letter-spacing:0.5px">ACTIVE</span>
          <div style="width:90px;height:32px;display:inline-flex;align-items:center;justify-content:flex-end;flex-shrink:0">
            ${canReset ? `<button class="btn-sm" onclick="APP.resetUserPassword(${u.id},'${UI.escapeText(u.full_name)}')" style="background:var(--bg);color:var(--navy);border:1px solid var(--border);height:32px;min-height:32px;padding:0;width:100%;font-size:11px;font-weight:600;box-sizing:border-box;margin:0;display:inline-flex;align-items:center;justify-content:center">Reset PW</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  });

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

  let html = '<div class="sec-label">AI Features — Phase 2 Toggles</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">These features call Claude AI when enabled. Off by default — enable gradually. Requires ANTHROPIC_API_KEY on the server.</div>';

  data.features.forEach(f => {
    const checked = f.enabled ? 'checked' : '';
    html += `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${UI.escapeText(f.label)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${UI.escapeText(f.description || '')}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" ${checked} onchange="APP.toggleAIFeature('${f.feature_key}', this.checked)">
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
    'detailing_head','jr_architect','detailing','services_engineer','team_lead',
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/issues/ncr/${pid}`);
  if (!data) return;
  const ncrs = data.ncrs || [];

  const role = APP.user.role;
  const canRaise = ['pmc_head','principal','design_principal','site_manager','senior_site_manager'].includes(role);

  let html = '';
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

APP.showNCRForm = function() {
  document.getElementById('modal-overlay').classList.add('open');
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
};

// ── SUBMITTALS — review queue
APP.renderSubmittals = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/submittals/${pid}`);
  if (!data) return;
  const subs = data.submittals || [];

  const role = APP.user.role;
  const canSubmit = ['site_manager','senior_site_manager','pmc_head'].includes(role);
  const canReview = ['design_head','services_head','pmc_head','principal','design_principal'].includes(role);

  let html = '';
  if (canSubmit) {
    html += `<button class="btn-primary" onclick="APP.showSubmittalForm()" style="margin-bottom:16px">+ New Submittal</button>`;
  }

  const pending = subs.filter(s => s.status === 'pending_review' && canReview);
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
          <span class="badge b-amber">Review</span>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn-approve" onclick="APP.reviewSubmittal(${s.id},'approved')">Approve</button>
          <button class="btn-reject" onclick="APP.reviewSubmittal(${s.id},'rejected')">Return</button>
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
      const b = s.status==='approved'?'b-green':s.status==='rejected'?'b-red':s.status==='pending_review'?'b-amber':'b-silver';
      html += `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1">
            <div style="font-family:var(--mono);font-size:11px;color:var(--navy)">${s.submittal_number||'SUB-'+s.id}</div>
            <div class="card-title">${s.title||'—'}</div>
            <div class="card-meta">${s.vendor_name||'—'}</div>
          </div>
          <span class="badge ${b}">${s.status||'draft'}</span>
        </div>
      </div>`;
    });
  }

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

APP.reviewSubmittal = async function(id, status) {
  const res = await API.patch(`/submittals/${id}/review`, { status });
  if (res?.success) { UI.toast(status==='approved'?'Approved ✓':'Returned'); APP.renderSubmittals(); }
};
APP.showSubmittalForm = function() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-title">New Submittal <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div class="field-row"><label class="field-label" for="sub-title">Title</label>
      <input type="text" id="sub-title" placeholder="e.g. Structural steel shop drawings"></div>
    <div class="field-row"><label class="field-label" for="sub-vendor">Vendor</label>
      <input type="text" id="sub-vendor" placeholder="Vendor name"></div>
    <button class="btn-primary" onclick="APP.submitSubmittal()">Submit</button>`;
};
APP.submitSubmittal = async function() {
  const pid = APP.state.selectedProject;
  const body = { title: document.getElementById('sub-title').value, vendor_name: document.getElementById('sub-vendor').value };
  if (!body.title) { UI.toast('Add a title'); return; }
  const res = await API.post(`/submittals/${pid}`, body);
  if (res?.success) { APP.closeModal(); UI.toast('Submittal submitted ✓'); APP.renderSubmittals(); }
};

// ── PMC DEPUTY — declare unavailable / return
// ── WEEKLY HEALTH REPORT — Naveen consolidated view
APP.renderWeeklyHealth = async function() {
  const el = UI.contentEl();
  const data = await API.get('/weekly-health/summary');
  if (!data) return;
  const projects = data.projects || [];

  let html = `<div class="sec-label">Weekly Health — All Projects</div>`;
  if (!projects.length) { html += UI.empty('','No active projects'); }
  else projects.forEach(p => {
    const sched = p.schedule || {};
    const drift = sched.drift_days || 0;
    const driftColor = drift > 14 ? 'red' : drift > 7 ? 'amber' : 'green';

    html += `<div class="proj-card">
      <div class="pc-top">
        <div style="flex:1">
          <div class="pc-name">${p.name}</div>
          <div class="pc-client">${p.client_name||'—'}</div>
        </div>
        ${UI.statusBadge(p.health_status||'active')}
      </div>
      <div class="pc-stats">
        <div class="pc-stat">
          <span class="pc-stat-val ${driftColor}">${drift>0?'+':''}${drift}d</span>
          <span class="pc-stat-lbl">Schedule</span>
        </div>
        <div class="pc-stat">
          <span class="pc-stat-val">${p.open_issues||0}</span>
          <span class="pc-stat-lbl">Issues</span>
        </div>
        <div class="pc-stat">
          <span class="pc-stat-val">${p.pending_payments||0}</span>
          <span class="pc-stat-lbl">Payments</span>
        </div>
        <div class="pc-stat">
          <span class="pc-stat-val">${p.open_cns||0}</span>
          <span class="pc-stat-lbl">CNs</span>
        </div>
      </div>
      ${p.riskNarratives?.length ? `<div class="pc-progress">
        ${p.riskNarratives.slice(0,2).map(n =>
          `<div style="font-size:11px;color:var(--${n.escalation_level==='critical'?'red':n.escalation_level==='red'?'red':'amber'});line-height:1.4;margin-bottom:4px">
            ${n.trade}: ${(n.narrative||'').replace(/\s*\(AI narrative.*?\)/i,'')}
          </div>`
        ).join('')}
      </div>` : ''}
    </div>`;
  });

  el.innerHTML = `<div class="fade-in">${html}</div>`;
};

// ── SCHEDULE COMPLIANCE — PMC Saturday trigger
APP.renderScheduleCompliance = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  let html = `
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
  <div class="card" style="margin-bottom:16px">
    <div class="prog-row">
      <div class="prog-label">Start</div>
      <div style="flex:1;font-family:var(--mono);font-size:12px;color:var(--text)">${UI.fmtDate(p.start_date)}</div>
    </div>
    <div class="prog-row">
      <div class="prog-label">Completion</div>
      <div style="flex:1;font-family:var(--mono);font-size:12px;color:var(--text)">${UI.fmtDate(p.completion_date)}</div>
    </div>
    <div class="prog-row">
      <div class="prog-label">Contract</div>
      <div style="flex:1;font-family:var(--mono);font-size:12px;color:var(--navy)">${Money.formatRupee(p.contract_value||0)}</div>
    </div>
  </div>`;

  // ── PMC Assignment card (v4.3)
  // Shows primary + optional backup. Principal/DP see a "Change" button.
  const pmc = summary.pmc || {};
  const canChange = summary.can_change_pmc;
  html += `
  <div class="sec-label">PMC Assignment</div>
  <div class="card" style="margin-bottom:16px">
    <div class="prog-row">
      <div class="prog-label">Primary</div>
      <div style="flex:1;font-family:var(--mono);font-size:13px;color:var(--text);font-weight:600">
        ${pmc.primary_name || '<span style="color:var(--muted);font-weight:400">— Not assigned —</span>'}
      </div>
      ${canChange ? `<button class="btn-sm" onclick="APP.openChangePmc(${pid},'primary')" style="margin-left:8px">Change</button>` : ''}
    </div>
    <div class="prog-row">
      <div class="prog-label">Backup</div>
      <div style="flex:1;font-family:var(--mono);font-size:13px;color:var(--text2)">
        ${pmc.backup_name || '<span style="color:var(--muted)">— Optional, for leave cover —</span>'}
      </div>
      ${canChange ? `<button class="btn-sm" onclick="APP.openChangePmc(${pid},'backup')" style="margin-left:8px">Change</button>` : ''}
    </div>
  </div>`;

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
    html += `<button class="card ps-btn" style="min-height:44px;margin-top:16px;cursor:pointer" onclick="APP.openSlaSettings(${pid})">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-weight:600;font-size:14px;color:var(--navy)">⏱ SLA Settings</div>
        <span style="margin-left:auto;color:var(--muted);font-size:12px">tap to edit ▸</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">
        Per-project thresholds for when items escalate to the Pending tab.
      </div>
    </button>`;
  }

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
  // Each category maps to the tab that shows the actionable items
  const CAT_TAB = {
    drawings: 'drawings',
    payments: 'payments',
    budget:   'budget',
    moms:     'meetings',
    other:    'dashboard',
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
        <input id="pmc-assign-note" type="text" placeholder="e.g. Murugesan on leave Apr 25 – May 2"
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

  const body = document.getElementById('modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="modal-title">⏱ SLA Settings <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
      Days before an item escalates into the Pending tab.
      Defaults apply unless overridden here. Range: 1–60 days.
    </div>
    ${items.map(it => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="font-weight:600;font-size:13px;color:var(--navy);flex:1">${UI.escapeText(it.label)}</div>
          ${it.overridden
            ? '<span style="background:#f5ecdb;color:#8a6320;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">CUSTOM</span>'
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

// ── CLIENT RECEIPTS — Udupa logs incoming payments
APP.renderClientReceipts = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/finance/${pid}/client-receipts`);
  if (!data) return;
  const receipts = data.receipts || [];

  let html = `<button class="btn-primary" onclick="APP.showReceiptForm()" style="margin-bottom:16px">+ Log Receipt</button>
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
APP.showReceiptForm = function() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-title">Log Client Receipt <button class="btn-close" onclick="APP.closeModal()" aria-label="Close">×</button></button>
    <div class="field-row"><label class="field-label" for="rcpt-amount">Amount (₹)</label>
      <input type="number" id="rcpt-amount" placeholder="0"></div>
    <div class="field-row"><label class="field-label" for="rcpt-date">Date</label>
      <input type="date" id="rcpt-date" value="${UI.todayIST()}"></div>
    <div class="field-row"><label class="field-label" for="rcpt-mode">Mode</label>
      <select id="rcpt-mode"><option>NEFT</option><option>RTGS</option><option>Cheque</option><option>UPI</option></select></div>
    <div class="field-row"><label class="field-label" for="rcpt-ref">Reference / UTR</label>
      <input type="text" id="rcpt-ref" placeholder="Transaction reference"></div>
    <button class="btn-primary" onclick="APP.submitReceipt()">Save</button>`;
};
APP.submitReceipt = async function() {
  const pid = APP.state.selectedProject;
  const body = {
    amount:       parseFloat(document.getElementById('rcpt-amount').value||0),
    receipt_date: document.getElementById('rcpt-date').value,
    mode:         document.getElementById('rcpt-mode').value,
    reference:    document.getElementById('rcpt-ref').value,
  };
  if (!body.amount) { UI.toast('Enter amount'); return; }
  const res = await API.post(`/finance/${pid}/client-receipts`, body);
  if (res?.success) { APP.closeModal(); UI.toast('Receipt logged ✓'); APP.renderClientReceipts(); }
};

// ── TALLY XML EXPORT — Udupa
APP.renderTallyExport = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.get(`/invoices/${pid}/pi`);
  if (!data) return;
  const pis = (data.invoices||[]).filter(p => p.status === 'paid');

  let html = `
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
  overdue_queries:   { title: 'Drawing queries — overdue',    tab: 'queries',  icon: '🔴',
                       label: it => `${it.drawing_number || '?'} · ${(it.description||'').slice(0,60)}`,
                       sub:   it => `${it.project_name} · ${it.days_open}d open` },
  fresh_queries:     { title: 'Drawing queries — open',       tab: 'queries',  icon: '💬',
                       label: it => `${it.drawing_number || '?'} · ${(it.description||'').slice(0,60)}`,
                       sub:   it => `${it.project_name} · ${it.days_open}d open` },
  open_flags:        { title: 'Site flags open',              tab: 'queries',  icon: '🚩',
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
    // Per-item actions — navigate to tab scoped to this item ID (deep link)
    const deep = `${meta.tab}?project=${it.project_id||''}&item=${it.id||''}`;
    return `
      <div class="triage-row">
        <div class="triage-row-icon">${meta.icon}</div>
        <div class="triage-row-body">
          <div class="triage-row-label">${label}</div>
          <div class="triage-row-sub">${sub}</div>
        </div>
        <button class="btn-sm navy" onclick="location.hash='${deep}';UI.closeModal();APP.handleHashRoute();">Review →</button>
      </div>`;
  };

  const html = `
    <div class="triage-body">
      <div class="triage-meta">${items.length} item${items.length===1?'':'s'} awaiting review</div>
      ${items.map(rowFor).join('')}
      <button class="btn-secondary" style="margin-top:12px;width:100%" onclick="UI.closeModal();APP.switchTab('${meta.tab}');">View all in ${meta.tab} tab →</button>
    </div>`;

  UI.openModal(meta.title, html);
};

// Override the existing renderDashboard to be role-aware
const _origRenderDashboard = APP.renderDashboard;
APP.renderDashboard = async function() {
  const role = APP.user?.role;
  if (role === 'site_manager' || role === 'senior_site_manager') {
    return APP.renderSiteDashboard();
  }
  if (role === 'finance_admin') {
    return APP.renderFinanceDashboard();
  }
  if (role === 'design_head' || role === 'services_head') {
    return APP.renderDesignDashboard();
  }
  if (['team_lead','detailing_head','coordinator','jr_architect','services_engineer'].includes(role)) {
    return APP.renderTeamDashboard();
  }
  // principal / design_principal — original dashboard
  return _origRenderDashboard.call(APP);
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
    <button class="stat-card" style="min-height:44px;cursor:pointer" onclick="APP.switchTab('issues')">
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','No project assigned'); return; }

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

  let html = `
  <div class="card" style="margin-bottom:16px;background:var(--navy);border:none">
    <div style="color:rgba(255,255,255,.7);font-size:11px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
    <div style="color:var(--white);font-size:22px;font-weight:700;margin-top:4px">${APP.user?.project_name||APP.state.projectName||'Site'}</div>
  </div>

  <div class="stat-row">
    <button class="stat-card" onclick="APP.switchTab('tasks')">
      <span class="stat-val">${activeTasks}</span>
      <span class="stat-lbl">Active Tasks</span>
    </button>
    <button class="stat-card" onclick="APP.switchTab('issues')">
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
    <button class="action-card" onclick="APP.switchTab('issues')">
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

  let html = `
  <div class="sec-label">Pending — ${streamLabel} Stream</div>`;

  // Read correct keys from action_centre
  const pending = (ac.pending_approvals || []).slice(0, 5);
  const queries = [...(ac.overdue_queries || []), ...(ac.fresh_queries || [])].slice(0, 5);
  const pendingChanges = (ac.pending_changes || []).slice(0, 5);

  if (!pending.length && !queries.length && !pendingChanges.length) {
    html += `<div class="card" style="text-align:center;padding:20px">
      <div style="font-size:24px;margin-bottom:8px"></div>
      <div style="font-size:13px;font-weight:600;color:var(--navy)">Nothing pending</div>
    </div>`;
  }

  if (pending.length) {
    html += pending.map(p => `
    <button class="action-item c-navy" style="min-height:44px" onclick="APP.switchTab('drawings')">
      <div class="ai-icon">📐</div>
      <div class="ai-body">
        <div class="ai-title">${p.drawing_number||p.title||'Drawing'} — ${p.drawing_name||p.request_type||''}</div>
        <div class="ai-meta">${p.project_name||'—'}</div>
      </div>
      <span class="badge b-amber">Approve</span>
    </button>`).join('');
  }

  if (queries.length) {
    html += `<div class="sec-label">Drawing Queries</div>`;
    html += queries.map(q => `
    <button class="action-item c-${q.days_open>=3?'red':'amber'}" style="min-height:44px" onclick="APP.switchTab('queries')">
      <div class="ai-icon"></div>
      <div class="ai-body">
        <div class="ai-title">${q.drawing_number||'—'} — ${(q.description||'').slice(0,60)}</div>
        <div class="ai-meta">${q.project_name||'—'} · ${q.days_open||0}d open</div>
      </div>
      <span class="badge b-${q.days_open>=3?'red':'amber'}">${q.days_open>=3?'Overdue':'Open'}</span>
    </button>`).join('');
  }

  if (pendingChanges.length) {
    html += `<div class="sec-label">Change Notices</div>`;
    html += pendingChanges.map(cn => `
    <button class="action-item c-blue" style="min-height:44px" onclick="APP.switchTab('changes')">
      <div class="ai-icon">📝</div>
      <div class="ai-body">
        <div class="ai-title">${cn.cn_number||'—'} — ${cn.title||''}</div>
        <div class="ai-meta">${cn.project_name||'—'}</div>
      </div>
      <span class="badge b-blue">Sign</span>
    </button>`).join('');
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
  const pid = APP.state.selectedProject;
  // Check what day it is
  const now = new Date();
  const isSaturday = now.getDay() === 6;
  const hour = now.getHours();

  let html = `<div class="sec-label">Finance Dashboard</div>`;

  if (isSaturday && hour >= 17) {
    html += `<button class="action-item c-green" style="min-height:44px" onclick="APP.switchTab('payments_fin')">
      <div class="ai-icon"></div>
      <div class="ai-body">
        <div class="ai-title">Payment Excel ready</div>
        <div class="ai-meta">Naveen has approved — download and upload to ICICI</div>
      </div>
      <span class="badge b-green">Ready</span>
    </div>`;
  }

  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
    <button class="action-card" onclick="APP.switchTab('payments_fin')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      <span style="font-size:13px;font-weight:600">Payments</span>
    </button>
    <button class="action-card" onclick="APP.switchTab('pi')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      <span style="font-size:13px;font-weight:600">Invoices</span>
    </button>
    <button class="action-card" onclick="APP.switchTab('petty_cash')">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      <span style="font-size:13px;font-weight:600">Petty Cash</span>
    </button>
    <button class="action-card" onclick="APP.renderTallyExport();APP.currentTab='tally'">
      <svg style="width:24px;height:24px;margin-bottom:6px;color:var(--navy)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2v20l8-4 8 4V2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="14" y2="12"/></svg>
      <span style="font-size:13px;font-weight:600">Tally Export</span>
    </button>
  </div>`;

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
      <button class="action-card" onclick="APP.switchTab('issues')">
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
      html += `<button class="action-item c-${isOverdue?'red':'amber'}" style="min-height:44px" onclick="APP.switchTab('issues')">
        <div class="ai-icon"></div>
        <div class="ai-body">
          <div class="ai-title">${q.drawing_number||'—'} — ${(q.description||'').slice(0,60)}</div>
          <div class="ai-meta">${q.project_name||'—'} · ${q.days_open||0}d open</div>
        </div>
        <span class="badge b-${isOverdue?'red':'amber'}">${isOverdue?'Overdue':'Open'}</span>
      </button>`;
    });
  } else if (role !== 'coordinator') {
    html += `<div class="card" style="text-align:center;padding:16px;margin-bottom:12px">
      <div style="font-size:22px;margin-bottom:6px"></div>
      <div style="font-size:13px;font-weight:600;color:var(--navy)">No open queries</div>
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
// Shows: "Naveen · Principal" on line 1, project name on line 2.
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
  'detailing_head','jr_architect','detailing','services_engineer','coordinator',
  'pmc_head','site_manager','senior_site_manager','finance_admin','trainee',
  'audit','it_admin'
];

APP._roleLabel = function(role) {
  if (role === 'it_admin') return 'IT Admin';
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('', 'Select a project first'); return; }
  const data = await API.get('/boq-mapping/' + pid);
  if (!data) return;
  const { engagements = [], unmapped_count = 0, mappings = [] } = data;
  let html = `
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
  html += '<div class="sec-label">Engagements</div>';
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
};

// ── BUDGET TREE — drill-down view. Accessed from:
//   - Budget tab with Drill-down toggle (most roles)
//   - budget_tree tab directly (Audit role only)
APP.renderBudgetTree = async function() {
  const el = UI.contentEl();
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('', 'Select a project first'); return; }
  const data = await API.get('/budget/' + pid + '/tree');
  if (!data) return;
  const tree = data.tree || [];
  const fmt = n => Money.formatRupee(n||0);
  let html = APP._budgetToggleHTML() + '<div class="sec-label">Budget — Committed vs Sanctioned</div>';
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
      summary += `<div style="padding:8px;border-left:3px solid ${col};background:#fafafa;margin-bottom:4px;font-size:12px">
        <div style="font-weight:600">${UI.escapeText(r.name)}</div>
        ${notes ? `<div style="color:${col};margin-top:2px">${notes}</div>` : ''}
      </div>`;
    });
  }

  summary += `<p style="font-size:11px;color:var(--muted);margin-top:10px">All rows submitted to finance for clearance. You may edit flagged rows individually; finance will review each entry.</p>`;

  UI.openModal('Upload Report', summary);
  APP.renderVendorsMaster();
};

// ── Finance Clearance tab — Udupa reviews and clears pending vendors
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
          flagsHtml = `<div style="margin-top:6px;padding:8px;background:#fafafa;border-radius:6px;font-size:11px">
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
  const pid = APP.state.selectedProject;
  if (!pid) { el.innerHTML = UI.empty('','Select a project first'); return; }

  const data = await API.call('GET', `/client-boq/${pid}`);
  if (!data) { el.innerHTML = UI.empty('','Failed to load'); return; }
  const items = data.items || [];
  const version = data.version || null;

  const me = APP.user;
  const canEditRate = ['principal','design_principal','pmc_head','design_head','services_head'].includes(me.role);

  let html = `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="card-title">Client BOQ</div>
        <div class="card-meta">${version ? `${UI.escapeText(version.label||'v1')} · ${items.length} items` : 'No client BOQ uploaded yet'}</div>
      </div>
      ${canEditRate ? `<label>
        <input type="file" id="client-boq-file" accept=".xlsx,.xls" style="display:none" onchange="APP.uploadClientBOQ(${pid},this)">
        <button class="btn-sm gold" onclick="document.getElementById('client-boq-file').click()">Upload</button>
      </label>` : ''}
    </div>
  </div>`;

  if (!items.length) {
    el.innerHTML = html + UI.empty('','No client BOQ for this project');
    return;
  }

  // Group by section (use parent_id tree — show top-level then children)
  const topLevel  = items.filter(i => !i.parent_id);
  const childOf   = {};
  items.filter(i => i.parent_id).forEach(i => { (childOf[i.parent_id] = childOf[i.parent_id] || []).push(i); });

  const fmt = n => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const renderItem = (item, indent) => {
    const hasRate = item.rate != null && item.rate !== '';
    const rate    = hasRate ? fmt(item.rate) : '—';
    const amount  = hasRate ? fmt((item.quantity || 0) * item.rate) : '—';
    return `<div class="card" style="margin:2px 0;padding:6px 10px;${indent?`border-left:2px solid #eee;margin-left:${indent*8}px`:''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:${item.is_section?600:500};color:${item.is_section?'var(--navy)':'inherit'}">${UI.escapeText(item.item_name)}</div>
          <div style="font-size:10px;color:var(--muted);font-family:var(--mono)">
            ${item.sor_ref ? UI.escapeText(item.sor_ref)+' · ' : ''}${item.quantity || 0} ${UI.escapeText(item.unit || '')}
            ${item.hsn_code ? ' · HSN: '+UI.escapeText(item.hsn_code) : ''}
          </div>
        </div>
        ${!item.is_section ? `<div style="text-align:right;font-family:var(--mono);font-size:11px;min-width:90px">
          <div>₹${rate}</div>
          <div style="color:var(--muted);font-size:10px">${amount !== '—' ? '₹'+amount : ''}</div>
        </div>` : ''}
        ${canEditRate && !item.is_section ? `<button class="btn-sm" onclick="APP.showEditClientBOQItem(${pid},${item.id})">✎</button>` : ''}
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
  const fd = new FormData();
  fd.append('client_boq', file);
  UI.toast('Uploading…');
  const res = await API.call('POST', `/client-boq/${pid}/upload`, fd, true);
  if (res?.success) { UI.toast(res.message || 'Uploaded ✓'); APP.renderClientBOQ(); }
  else UI.toast(res?.error || 'Upload failed');
};

APP.showEditClientBOQItem = async function(pid, itemId) {
  const data = await API.call('GET', `/client-boq/${pid}`);
  const item = (data?.items || []).find(i => i.id === itemId);
  if (!item) { UI.toast('Item not found'); return; }
  const hsnBtn = APP.state.aiToggles?.autofill_boq_hsn
    ? `<button class="btn-sm" type="button" onclick="APP.suggestHSN('${UI.escapeAttr(item.item_name||item.description||'')}','${UI.escapeAttr(item.trade||'')}','cb-hsn')" style="margin-top:4px;font-size:11px">Suggest HSN</button>`
    : '';
  UI.openModal(`Edit: ${item.item_name}`, `
    <div class="field-row"><label class="field-label" for="cb-rate">Rate (₹ per ${UI.escapeText(item.unit||'unit')})</label>
      <input type="number" step="0.01" id="cb-rate" value="${item.rate || ''}">
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

// ── PULL TO REFRESH
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
