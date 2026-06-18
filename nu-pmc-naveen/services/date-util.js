// services/date-util.js
// ============================================================
// Date helpers for the nu PMC stack. The whole business runs on
// IST (Asia/Kolkata, UTC+5:30) — every "today" we compute must
// reflect the local day, not the UTC day.
//
// BUG GUARD: `new Date().toISOString().split('T')[0]` returns the
// UTC date. Between 00:00 and 05:30 IST, UTC is still yesterday
// — so "today" comes out as yesterday for 5.5 hours every night.
// Always use DateUtil.todayIST() instead.
// ============================================================

const IST_OFFSET_MIN = 5 * 60 + 30;  // 330 minutes

/**
 * todayIST() → "YYYY-MM-DD" for the current IST calendar date.
 * Works regardless of server timezone.
 */
function todayIST() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MIN * 60000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * dateIST(d) → "YYYY-MM-DD" for the IST calendar date of a given Date.
 */
function dateIST(d) {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MIN * 60000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * yyyymmddIST() → "YYYYMMDD" for IST date (invoice prefixes etc.)
 */
function yyyymmddIST() {
  return todayIST().replace(/-/g, '');
}

module.exports = { todayIST, dateIST, yyyymmddIST };
