
// ui.js — UI helpers, modal, toast, offline detection

const UI = {
  // HTML-attribute-safe string escape — use when interpolating user data into
  // inline event handlers like onclick="APP.fn('${UI.escapeAttr(name)}')".
  // Escapes quotes, backslashes, angle brackets. Does NOT encode for text nodes
  // (use textContent or x-text for that).
  escapeAttr(s) {
    if (s == null) return '';
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  // HTML text-content escape — use when interpolating user data inside HTML
  // tag bodies (e.g. <option>${UI.escapeText(name)}</option>).
  // Encodes &, <, > so user-authored angle brackets cannot break out of the
  // tag context into new elements.
  escapeText(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  toast(msg, ms = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  },

  // openModal(title, html) — populates #modal-body with a title bar + content block
  // and toggles the overlay open. Used everywhere in app.js.
  openModal(title, html) {
    const body = document.getElementById('modal-body');
    if (!body) return;
    body.innerHTML = `
      <div class="modal-title">
        <span id="modal-title-text" tabindex="-1">${UI.escapeText(title || '')}</span>
        <button class="btn-close" onclick="UI.closeModal()" aria-label="Close">×</button>
      </div>
      <div id="modal-content">${html || ''}</div>`;
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('open');
    // Lock background scroll
    document.body.style.overflow = 'hidden';
    // Move focus into modal
    const titleEl = document.getElementById('modal-title-text');
    if (titleEl) titleEl.focus();
    // Focus trap — keep Tab/Shift+Tab inside modal
    UI._trapFocus(body);
  },

  _trapFocus(container) {
    const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const els = Array.from(container.querySelectorAll(focusable)).filter(el => !el.disabled);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    UI._focusTrapHandler = e => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    container.addEventListener('keydown', UI._focusTrapHandler);
  },

  // showModal — legacy alias for openModal (7 existing callers in app.js).
  showModal(title, html) { return UI.openModal(title, html); },

  // setContent — write HTML into the main #content-area.
  setContent(html) {
    const el = document.getElementById('content-area');
    if (el) el.innerHTML = html;
  },

  closeModal(e) {
    if (!e || e.target === document.getElementById('modal-overlay')) {
      const overlay = document.getElementById('modal-overlay');
      overlay.classList.remove('open');
      // Restore background scroll
      document.body.style.overflow = '';
      // Remove focus trap
      const body = document.getElementById('modal-body');
      if (body && UI._focusTrapHandler) {
        body.removeEventListener('keydown', UI._focusTrapHandler);
        UI._focusTrapHandler = null;
      }
    }
  },

  confirm(msg) {
    return new Promise(resolve => {
      UI.openModal('Confirm', `
        <p style="font-size:13px;color:var(--text);margin-bottom:16px">${msg}</p>
        <div style="display:flex;gap:8px">
          <button class="btn-approve" onclick="UI.closeModal();document.dispatchEvent(new CustomEvent('confirm-yes'))">Yes</button>
          <button class="btn-reject" onclick="UI.closeModal();document.dispatchEvent(new CustomEvent('confirm-no'))">No</button>
        </div>
      `);
      document.addEventListener('confirm-yes', () => resolve(true),  { once: true });
      document.addEventListener('confirm-no',  () => resolve(false), { once: true });
    });
  },

  prompt(label, placeholder = '') {
    return new Promise(resolve => {
      UI.openModal(label, `
        <div class="field-row">
          <textarea id="prompt-input" rows="3" placeholder="${placeholder}" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-family:var(--sans);font-size:12px;padding:9px 11px;outline:none;resize:none"></textarea>
        </div>
        <button class="btn-primary" onclick="
          const v=document.getElementById('prompt-input').value.trim();
          UI.closeModal();
          document.dispatchEvent(new CustomEvent('prompt-done',{detail:v}))
        ">Submit</button>
      `);
      document.addEventListener('prompt-done', e => resolve(e.detail), { once: true });
    });
  },

  badge(txt, cls) { return `<span class="badge ${cls}">${txt}</span>`; },

  statusBadge(s) {
    const m = {
      'on-track':     ['On Track',     'b-green'],
      'at-risk':      ['At Risk',      'b-amber'],
      'delayed':      ['Delayed',      'b-red'],
      'initialising': ['Initialising', 'b-blue'],
      'active':       ['Active',       'b-green'],
      'completed':    ['Completed',    'b-navy'],
    };
    const [label, cls] = m[s] || [s, 'b-navy'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  fmtDate(d) {
    if (!d) return '-';
    let dateStr = '';
    if (d instanceof Date) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      const s = String(d).trim();
      if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s === '0000-00-00') return '-';
      dateStr = s.includes('T') ? s.split('T')[0] : s;
    }
    const parsed = new Date(dateStr + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      const direct = new Date(d);
      return isNaN(direct.getTime()) ? '-' : direct.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    }
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  },

  fmtDay(d) {
    if (!d) return '';
    let dateStr = '';
    if (d instanceof Date) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      const s = String(d).trim();
      if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s === '0000-00-00') return '';
      dateStr = s.includes('T') ? s.split('T')[0] : s;
    }
    const parsed = new Date(dateStr + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      const direct = new Date(d);
      return isNaN(direct.getTime()) ? '' : direct.toLocaleDateString('en-IN', { weekday: 'short' });
    }
    return parsed.toLocaleDateString('en-IN', { weekday: 'short' });
  },

  todayIST() {
    if (window.APP && window.APP.state && window.APP.state.serverToday) {
      return window.APP.state.serverToday;
    }
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  },

  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
  },

  showSyncBanner(show) {
    const el = document.getElementById('sync-banner');
    if (el) el.classList.toggle('show', show);
  },

  loading(el) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:var(--mono);font-size:11px">Loading…</div>';
  },

  empty(icon, text) {
    return `<div class="empty"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
  },

  // F10: shorthand for the app's primary content container. Replaces
  // 60+ scattered `document.getElementById('content-area')` calls.
  contentEl() {
    return document.getElementById('content-area');
  },
};

// Offline detection
window.addEventListener('online',  () => {
  UI.showSyncBanner(false);
  UI.toast('Back online — syncing…');
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(reg => reg.sync.register('sync-queue'));
  }
});
window.addEventListener('offline', () => {
  UI.showSyncBanner(true);
  UI.toast('Offline — work saved on phone');
});

// Escape key closes modal from anywhere on the page
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('modal-overlay')?.classList.contains('open')) {
    UI.closeModal();
  }
});
