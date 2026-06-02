// public/js/offline-queue.js
// ============================================================
// Client-side companion for the service-worker queue.
//
// Listens to postMessages from the SW and exposes:
//   OfflineQueue.status           — current {pending, dead_letter, last_sync_at}
//   OfflineQueue.syncNow()        — ask SW to replay the queue immediately
//   OfflineQueue.listDeadLetter() — get the list of permanently-failed items
//   OfflineQueue.clearDeadLetter()— drop dead-letter items (user confirmed)
//   OfflineQueue.onStatus(fn)     — subscribe to status-change events
//
// Renders a small status indicator at the bottom-right of the page:
//   "● Online"              — nothing queued
//   "↻ 3 pending"           — 3 writes waiting for signal
//   "⚠ 1 failed"            — 1 item moved to dead-letter
// Clicking the indicator opens a panel with "Sync now" and dead-letter list.
// ============================================================

(function() {
  'use strict';

  const listeners = new Set();
  const state = { pending: 0, dead_letter: 0, last_sync_at: null, online: navigator.onLine };

  function notify() { listeners.forEach(fn => { try { fn({ ...state }); } catch (_) {} }); }

  function postToSW(msg) {
    return new Promise((resolve) => {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { resolve(null); return; }
      const channel = new MessageChannel();
      channel.port1.onmessage = e => resolve(e.data);
      try { navigator.serviceWorker.controller.postMessage(msg, [channel.port2]); }
      catch { resolve(null); }
      // Fallback — some browsers deliver via the global listener; resolve after a beat
      setTimeout(() => resolve(null), 1500);
    });
  }

  async function refreshStatus() {
    if (!navigator.serviceWorker?.controller) return;
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'queue:status' });
    } catch {}
  }

  function syncNow() {
    if (!navigator.serviceWorker?.controller) return Promise.resolve(null);
    try { navigator.serviceWorker.controller.postMessage({ type: 'queue:sync-now' }); } catch {}
    return new Promise(resolve => {
      const handler = e => {
        if (e.data?.type === 'queue:sync-complete') {
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve(e.data);
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      setTimeout(() => { navigator.serviceWorker.removeEventListener('message', handler); resolve(null); }, 30000);
    });
  }

  function listDeadLetter() {
    if (!navigator.serviceWorker?.controller) return Promise.resolve([]);
    try { navigator.serviceWorker.controller.postMessage({ type: 'queue:list-dead-letter' }); } catch {}
    return new Promise(resolve => {
      const handler = e => {
        if (e.data?.type === 'queue:dead-letter-list') {
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve(e.data.items || []);
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      setTimeout(() => { navigator.serviceWorker.removeEventListener('message', handler); resolve([]); }, 5000);
    });
  }

  function clearDeadLetter() {
    if (!navigator.serviceWorker?.controller) return;
    try { navigator.serviceWorker.controller.postMessage({ type: 'queue:clear-dead-letter' }); } catch {}
  }

  // ── Listen for SW status broadcasts ────────────────────────
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'queue:status') {
        state.pending      = e.data.pending     || 0;
        state.dead_letter  = e.data.dead_letter || 0;
        state.last_sync_at = e.data.last_sync_at || null;
        notify();
        render();
      }
    });
  }

  window.addEventListener('online',  () => { state.online = true;  notify(); render(); syncNow(); });
  window.addEventListener('offline', () => { state.online = false; notify(); render(); });

  // Re-check when user comes back to tab (catches silent reconnects)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) syncNow();
  });

  // ── UI indicator ────────────────────────────────────────────
  let indicator = null;
  function ensureIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.id = 'offline-queue-indicator';
    indicator.style.cssText =
      'position:fixed;bottom:12px;right:12px;z-index:9999;' +
      'padding:6px 10px;border-radius:14px;font-size:12px;' +
      'font-family:system-ui,sans-serif;cursor:pointer;' +
      'box-shadow:0 2px 6px rgba(0,0,0,0.15);background:#fff;' +
      'border:1px solid #ccc;user-select:none;line-height:1.2;';
    indicator.addEventListener('click', openPanel);
    document.body.appendChild(indicator);
    return indicator;
  }

  function render() {
    if (!document.body) return;
    const el = ensureIndicator();
    if (!state.online) {
      el.textContent = '⚠ Offline' + (state.pending ? ` — ${state.pending} queued` : '');
      el.style.background = '#fff3cd'; el.style.borderColor = '#ffc107'; el.style.color = '#664d03';
      el.style.display = 'block';
    } else if (state.dead_letter > 0) {
      el.textContent = `⚠ ${state.dead_letter} failed`;
      el.style.background = '#f8d7da'; el.style.borderColor = '#dc3545'; el.style.color = '#842029';
      el.style.display = 'block';
    } else if (state.pending > 0) {
      el.textContent = `↻ ${state.pending} pending`;
      el.style.background = '#cfe2ff'; el.style.borderColor = '#0d6efd'; el.style.color = '#084298';
      el.style.display = 'block';
    } else {
      // Everything fine — hide
      el.style.display = 'none';
    }
  }

  async function openPanel() {
    const items = state.dead_letter > 0 ? await listDeadLetter() : [];
    const lastSync = state.last_sync_at
      ? new Date(state.last_sync_at).toLocaleString('en-IN')
      : 'never';
    const html =
      `<div style="font-family:system-ui,sans-serif;font-size:14px;">
        <div style="margin-bottom:10px;"><strong>Offline queue</strong></div>
        <div>Pending: <strong>${state.pending}</strong></div>
        <div>Failed (dead-letter): <strong>${state.dead_letter}</strong></div>
        <div style="color:#666;font-size:12px;margin-top:4px;">Last sync: ${lastSync}</div>
        <div style="margin-top:12px;">
          <button id="oq-sync" style="padding:6px 12px;margin-right:6px;">Sync now</button>
          ${state.dead_letter > 0 ? `<button id="oq-clear" style="padding:6px 12px;">Clear failed</button>` : ''}
        </div>
        ${items.length ? `<details style="margin-top:10px;"><summary>Failed items (${items.length})</summary>
          <ul style="font-size:11px;max-height:200px;overflow:auto;padding-left:18px;">
            ${items.map(i => `<li><strong>${i.method}</strong> ${i.url.split('?')[0]}<br/>
              <span style="color:#c00;">${i.last_error || '?'}</span>
              · ${new Date(i.timestamp).toLocaleTimeString('en-IN')}</li>`).join('')}
          </ul>
        </details>` : ''}
      </div>`;
    showModal(html, panel => {
      panel.querySelector('#oq-sync')?.addEventListener('click', async () => {
        panel.querySelector('#oq-sync').textContent = 'Syncing…';
        const result = await syncNow();
        panel.remove();
      });
      panel.querySelector('#oq-clear')?.addEventListener('click', () => {
        if (confirm('Permanently delete ' + state.dead_letter + ' failed requests?')) {
          clearDeadLetter();
          panel.remove();
        }
      });
    });
  }

  function showModal(html, onMount) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;' +
      'display:flex;align-items:center;justify-content:center;';
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:8px;padding:20px;min-width:280px;max-width:90vw;';
    panel.innerHTML = html + '<div style="margin-top:12px;text-align:right;"><button id="oq-close">Close</button></div>';
    panel.querySelector('#oq-close').addEventListener('click', () => wrap.remove());
    if (onMount) onMount(panel);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  // ── Public API ──────────────────────────────────────────────
  window.OfflineQueue = {
    get status() { return { ...state }; },
    syncNow,
    refreshStatus,
    listDeadLetter,
    clearDeadLetter,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  // Prime status on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { refreshStatus(); render(); });
  } else {
    refreshStatus(); render();
  }
})();
