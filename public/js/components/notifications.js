// public/js/components/notifications.js
// ============================================================
// Alpine component: notifications feed (today + earlier).
// Replaces APP.renderNotifications.
// ============================================================

window.Components = window.Components || {};

const TYPE_ICONS = {
  morning_priorities: '☀️', evening_digest: '🌙', morning_site_prep: '🏗️',
  evening_close: '✅', report_anomaly: '⚠️', budget_flag: '💰',
  budget_escalation: '🚨', task_outlier: '📊', drawing_query: '📐',
  grn_pending: '📦', issue_raised: '⚠️', urgent_payment: '💳',
  utr_consolidated: '✅', weekly_digest: '📋', saturday_payment_digest: '💰',
};

window.Components['notifications'] = function() {
  return {
    loading: true,
    todayMsgs: [],
    olderMsgs: [],

    get hasAny() { return this.todayMsgs.length + this.olderMsgs.length > 0; },

    async init() {
      const data = await API.call('GET', '/notifications/log');
      const msgs = data?.notifications || [];
      const today = window.UI?.todayIST ? UI.todayIST() : new Date().toISOString().split('T')[0];
      this.todayMsgs = msgs.filter(m => (m.sent_at || '').startsWith(today));
      this.olderMsgs = msgs.filter(m => !(m.sent_at || '').startsWith(today)).slice(0, 20);
      this.loading = false;
      // Hide the red dot on the bell icon
      const dot = document.getElementById('notif-dot');
      if (dot) dot.style.display = 'none';
    },

    iconFor(type)   { return TYPE_ICONS[type] || '🔔'; },
    summaryFor(m)   {
      const body = m.message_body || '';
      return body.substring(0, 60) + (body.length > 60 ? '…' : '');
    },
    dateFor(m) {
      const d = (m.sent_at || '').split('T')[0];
      return window.UI?.fmtDate ? UI.fmtDate(d) : d;
    },
    isUnread(m) { return !m.read_at; },
  };
};
