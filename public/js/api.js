
// api.js — all API calls to the backend

// Read a single cookie value by name. Returns empty string if absent.
// Used to pull the CSRF token (cookie 'nu_csrf') before each write request.
function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function uploadedFileUrl(value, defaultSubdir = '') {
  if (!value) return '';
  const raw = String(value).replace(/\\/g, '/');
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/api/files/')) return raw;
  const clean = raw.split(/[?#]/)[0];
  const match = clean.match(/(?:^|\/)uploads\/([^/]+)\/([^/]+)$/i);
  const subdir = match ? match[1] : defaultSubdir;
  const filename = match ? match[2] : clean.split('/').pop();
  if (!subdir || !filename) return raw.startsWith('/') ? raw : '/' + raw;
  return `/api/files/${encodeURIComponent(subdir)}/${encodeURIComponent(filename)}`;
}

// Fire-and-forget client-side error reporter. Posts non-2xx responses (and
// network/parse failures) to /api/log/client-error so a Principal can review
// what's broken. Rate-limited per (method,path) to one report every 30s
// so a broken button being mashed doesn't flood the server.
const _reportedRecently = new Map();   // key → last-reported timestamp
const REPORT_THROTTLE_MS = 30 * 1000;
function reportClientError(info) {
  try {
    const key = info.method + ' ' + info.path;
    const now = Date.now();
    const last = _reportedRecently.get(key) || 0;
    if (now - last < REPORT_THROTTLE_MS) return;
    _reportedRecently.set(key, now);

    // Direct fetch (NOT API.call) — we'd recurse if /log/client-error itself
    // failed. Include the CSRF header. Don't await; don't surface failures.
    const headers = { 'Content-Type': 'application/json' };
    const csrf = readCookie('nu_csrf');
    if (csrf) headers['X-Nu-CSRF'] = csrf;
    fetch('/api/log/client-error', {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({
        request_method:   info.method,
        request_path:     info.path,
        http_status:      info.status,
        error_code:       info.code,
        response_excerpt: info.excerpt,
        client_path:      window.location?.pathname || null,
      }),
    }).catch(() => { /* swallow — best effort */ });
  } catch { /* never let the reporter break the app */ }
}

const API = {
  fileUrl: uploadedFileUrl,

  async call(method, path, data, isForm = false, _retried = false) {
    // AUDIT ROLE INTERCEPT — read-only test account. Block non-GET at the client
    // so buttons fail gracefully with a toast rather than a backend 403.
    // /auth/logout is allowed so the audit user can end their session.
    // /auth/end-impersonation is allowed so a Principal who sudoed into audit
    // can return to their real role (otherwise they'd be trapped read-only).
    if (window.APP?.user?.role === 'audit'
        && method !== 'GET'
        && path !== '/auth/logout'
        && path !== '/auth/end-impersonation') {
      if (window.UI?.toast) UI.toast('Read-only audit account — cannot edit');
      return { error: 'Read-only audit account — cannot edit', code: 'AUDIT_READ_ONLY' };
    }

    const opts = {
      method,
      credentials: 'include',
      headers: {},
    };
    if (data && !isForm) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    if (isForm) opts.body = data;

    // CSRF token on state-changing requests. The token is set as a cookie
    // by the login response; we read it back and echo it as a header.
    // GETs don't need it (server middleware skips GETs).
    if (method !== 'GET') {
      const csrf = readCookie('nu_csrf');
      if (csrf) opts.headers['X-Nu-CSRF'] = csrf;
    }

    try {
      const res  = await fetch('/api' + path, opts);
      // Some endpoints can return HTML (e.g. session expired with HTML login
      // page from a misconfigured proxy). Try to parse JSON, fall back to text.
      let json, raw = '';
      try { json = await res.json(); }
      catch { try { raw = await res.text(); } catch {} json = null; }

      if (!res.ok && res.status === 401) {
        // /auth/change-password returns 401 for "Current password incorrect",
        // which is a field-level error, not a session expiry. Let the caller
        // surface the message instead of bouncing to the login screen — but
        // do honour SESSION_USER_GONE (user deleted while session was live).
        if (path === '/auth/change-password' && json?.code !== 'SESSION_USER_GONE') {
          return json || { error: 'Failed to change password' };
        }
        APP.showLogin();
        return null;
      }
      // CSRF token was missing from the session (session predates CSRF rollout)
      // but the server has now issued a fresh token and set the cookie. Retry
      // the original request once — the cookie is now readable and will be
      // included in the header on the retry.
      if (!res.ok && res.status === 403 && json?.code === 'CSRF_TOKEN_REISSUED' && !_retried) {
        return API.call(method, path, data, isForm, true);
      }
      // CSRF failures look like 403 with one of these codes. Treat as
      // session-expired and force re-login — same UX as 401.
      if (!res.ok && res.status === 403 && json?.code &&
          (json.code === 'CSRF_INVALID' ||
           json.code === 'CSRF_HEADER_MISSING' ||
           json.code === 'CSRF_NO_SESSION_TOKEN')) {
        APP.showLogin();
        return null;
      }
      // Anything else non-2xx — log it for triage. Skip the log endpoint
      // itself to avoid recursion; skip auth flows (their failures are
      // expected during login attempts).
      if (!res.ok && !path.startsWith('/log/client-error') && !path.startsWith('/auth/')) {
        reportClientError({
          method, path: '/api' + path, status: res.status,
          code: json?.code, excerpt: json ? JSON.stringify(json).slice(0, 1000) : raw.slice(0, 1000),
        });
      }
      // Service worker may respond with {queued:true, offline:true} when the
      // device is offline — surface a gentle toast once, then hand the
      // response back so callers can treat it as a soft success.
      if (json && json.queued === true && json.offline === true) {
        if (window.UI?.toast) UI.toast(json.message || 'Saved offline — will sync');
        if (window.OfflineQueue?.refreshStatus) OfflineQueue.refreshStatus();
      }
      return json || { error: raw || 'Empty response from server', code: 'NO_BODY' };
    } catch (err) {
      console.error('API error:', err);
      // Network errors and JSON parse failures land here. Report them too.
      if (!path.startsWith('/log/client-error') && !path.startsWith('/auth/')) {
        reportClientError({
          method, path: '/api' + path, status: null,
          code: 'NETWORK_OR_PARSE_ERROR', excerpt: String(err.message || err).slice(0, 1000),
        });
      }
      return { error: 'Network error — check signal' };
    }
  },

  // Convenience shims — used by newer modules
  get:    (path)          => API.call('GET',    path),
  post:   (path, data)    => API.call('POST',   path, data),
  patch:  (path, data)    => API.call('PATCH',  path, data),
  del:    (path)          => API.call('DELETE', path),

  // Auth
  login:          (u, p)    => API.call('POST', '/auth/login', { username: u, password: p }),
  logout:         ()        => API.call('POST', '/auth/logout'),
  me:             ()        => API.call('GET',  `/auth/me?_cb=${Date.now()}`),
  changePassword: (c, n)    => API.call('POST', '/auth/change-password', { current_password: c, new_password: n }),
  resetPassword:  (uid, p)  => API.call('POST', '/auth/reset-password', { user_id: uid, new_password: p }),

  // Projects
  getProjects:    ()        => API.call('GET',  '/projects'),
  getProject:     (id)      => API.call('GET',  `/projects/${id}`),
  createProject:  (data)    => API.call('POST', '/projects', data),
  assignSiteMgr:  (id, uid) => API.call('POST', `/projects/${id}/assign-site-manager`, { user_id: uid }),

  // Schedule
  getSchedule:    (pid, d)  => API.call('GET',  `/schedule/${pid}?date=${d||''}`),
  getLookahead:   (pid, days)     => API.call('GET',  `/schedule/${pid}/lookahead${days?`?days=${days}`:''}`),
  getLookaheadWorkspace: (pid) => API.call('GET', `/schedule/${pid}/lookahead/workspace?_cb=${Date.now()}`),
  createTask:     (pid, data) => API.call('POST', `/schedule/${pid}/tasks`, data),
  getVersions:    (pid)     => API.call('GET',  `/schedule/${pid}/versions`),
  updateTask:     (pid, d)  => API.call('POST', `/schedule/${pid}/update`, d),
  validateTask:   (pid, d)  => API.call('POST', `/schedule/${pid}/validate`, d),

  // Drawings
  getDrawings:    (pid)     => API.call('GET',  `/drawings/${pid}`),
  getHistory:     (pid, did)=> API.call('GET',  `/drawings/${pid}/${did}/history`),
  approveDrawing: (vid)     => API.call('POST', `/drawings/version/${vid}/approve`),
  rejectDrawing:  (vid, n)  => API.call('POST', `/drawings/version/${vid}/reject`, { rejection_note: n }),

  // Queries
  getQueries:     (pid, s)  => API.call('GET',  `/issues/rfi/${pid}${s?'?status='+s:''}`),
  raiseQuery:     (pid, d)  => API.call('POST', `/issues/rfi/${pid}`, d),
  assignQuery:    (id)      => API.call('POST', `/issues/rfi/${id}/assign`),
  answerQuery:    (id, a)   => API.call('POST', `/issues/rfi/${id}/answer`, { answer: a }),
  closeQuery:     (id, n)   => API.call('POST', `/issues/rfi/${id}/close`, { resolution_note: n }),

  // Materials
  getBOQ:         (pid)     => API.call('GET',  `/materials/${pid}/boq`),
  getRequests:    (pid)     => API.call('GET',  `/materials/${pid}/requests`),
  raiseRequest:   (pid, d)  => API.call('POST', `/materials/${pid}/requests`, d),
  updateStatus:   (id, s)   => API.call('PATCH',`/materials/requests/${id}/status`, { status: s }),

  // Approvals
  getApprovals:   ()        => API.call('GET',  '/approvals'),
  raiseApproval:  (d)       => API.call('POST', '/approvals', d),
  approve:        (id)      => API.call('POST', `/approvals/${id}/approve`),
  reject:         (id, n)   => API.call('POST', `/approvals/${id}/reject`, { rejection_note: n }),
  // v2 (build-commit lock #7) — unified approvals + multi-signer
  getApprovalV2:  (id)      => API.call('GET',  `/approvals/v2/${id}`),
  voteApprovalV2: (id, vote, comment) => API.call('POST', `/approvals/v2/${id}/vote`, { vote, comment }),
  cancelApprovalV2: (id, reason) => API.call('POST', `/approvals/v2/${id}/cancel`, { reason }),

  // Changes
  getChanges:     (pid)     => API.call('GET',  `/changes/${pid}`),
  raiseChange:    (pid, d)  => API.call('POST', `/changes/${pid}`, d),
  signChange:     (id)      => API.call('POST', `/changes/${id}/sign`),
  approveChange:  (id)      => API.call('POST', `/changes/${id}/approve`),
  rejectChange:   (id, n)   => API.call('POST', `/changes/${id}/reject`, { rejection_note: n }),

  // Dashboard
  getDashboard:   ()        => API.call('GET',  '/dashboard'),

  // Reports
  getReports:     (pid)     => API.call('GET',  `/reports/${pid}`),
  carryForward:   (pid)     => API.call('GET',  `/reports/${pid}/carry-forward`),
  getMOMItems:    (pid)     => API.call('GET',  `/reports/${pid}/mom-items`),
  saveMOMItems:   (pid, d)  => API.call('POST', `/reports/${pid}/mom-items`, d),
  generateReport: (pid)     => API.call('GET',  `/reports/${pid}/generate`),
  saveReport:     (pid, d)  => API.call('POST', `/reports/${pid}`, d),
  approveReport:  (id)      => API.call('POST', `/reports/${id}/approve`),
  markSent:       (id)      => API.call('POST', `/reports/${id}/mark-sent`),

  // Users
  getUsers:       ()        => API.call('GET',  '/users'),
  createUser:     (d)       => API.call('POST', '/users', d),
  deactivateUser: (id)      => API.call('PATCH',`/users/${id}/deactivate`),

  // File uploads (multipart)
  uploadPhoto: (pid, formData) => API.call('POST', `/photos/${pid}/upload`, formData, true),
  uploadDoc:   (pid, formData) => API.call('POST', `/photos/${pid}/documents/upload`, formData, true),
  uploadDrawing:(pid, formData)=> API.call('POST', `/drawings/${pid}/upload`, formData, true),
  uploadBOQ:   (pid, formData) => API.call('POST', `/materials/${pid}/boq/upload`, formData, true),
  uploadSchedule:   (pid, formData) => API.call('POST', `/schedule/${pid}/upload`, formData, true),
  scheduleTemplateUrl: (pid)        => `/api/schedule/${pid}/template`,
  saveTaskPlanningNote: (pid, taskId, note) => API.call('PATCH', `/schedule/${pid}/tasks/${taskId}/planning-note`, { planning_note: note }),
  getDailyReportsHistory: (pid)     => API.call('GET', `/daily-reports/${pid}`),

  // Drawing register
  getRegister:      (pid, stream) => API.call('GET', `/register/${pid}${stream?`?stream=${stream}`:''}`),
  uploadRegister:   (pid, fd)     => API.call('POST',`/register/${pid}/upload`, fd, true),
  addRegisterEntry: (pid, d)      => API.call('POST',`/register/${pid}/add`, d),
  signOffRegister:  (pid, d)      => API.call('POST',`/register/${pid}/sign-off`, d),
  deleteRegisterEntry:(pid, eid)  => API.call('DELETE',`/register/${pid}/${eid}`),

  // Photos
  getPhotos:   (pid, date, types) => API.call('GET',  `/photos/${pid}?date=${date||''}${types?`&types=${types}`:''}`),
  getDocs:     (pid, date)  => API.call('GET',  `/photos/${pid}/documents?date=${date||''}`),

  // Gantt
  getGantt:    (pid) => API.call('GET', `/gantt/${pid}`),

  // Vendors (engagements per project)
  getVendors:      (pid)         => API.call('GET',   `/vendors/${pid}/engagements`),
  registerVendor:  (pid, d)      => API.call('POST',  `/vendors/${pid}/engagements`, d),
  assignBOQ:       (pid, eid, d) => API.call('POST',  `/boq-mapping/${pid}`, { engagement_id: eid, boq_item_ids: [d.boq_item_id], notes: d.notes }),
  // Payment requests list — under payment-requests router
  getPayments:     (pid, w)      => API.call('GET',   `/payment-requests/${pid}${w?'?week_ending='+w:''}`),
  // Raise a vendor payment — payments router
  raisePayment:    (pid, d)      => API.call('POST',  `/payments/${pid}/raise`, d),
  // Approve a vendor payment (PMC) — PATCH under payments router
  approvePayment:  (pid, id)     => API.call('PATCH', `/payments/${pid}/payments/${id}/approve`),
  // Weekly payment sheet generator
  getPaymentSheet: (pid, w)      => API.call('GET',   `/payments/${pid}/sheet${w?'?week_ending='+w:''}`),
};

// ── MEETINGS (unified site visits + MOMs)
API.getMeetings       = (pid)    => API.call('GET',   `/meetings/${pid}`);
API.getMeetingActions = (id)     => API.call('GET',   `/meetings/${id}/action-items`);
API.createMeeting     = (pid, d) => API.call('POST',  `/meetings/${pid}`, d);
API.addMeetingAction  = (id, d)  => API.call('POST',  `/meetings/${id}/action-items`, d);
API.logSiteVisit      = (pid, d) => API.call('POST',  `/meetings/${pid}/site-visit`, d);
API.addObservation    = (mid, formData) => API.call('POST', `/meetings/${mid}/observation`, formData, true);
// Legacy aliases — kept for backward compat during UI transition
API.getMOMs           = API.getMeetings;
API.getMOMActions     = API.getMeetingActions;
API.createMOM         = API.createMeeting;
API.addMOMAction      = API.addMeetingAction;
API.getVisits         = API.getMeetings;
API.logVisit          = API.logSiteVisit;
API.startVisit        = API.logSiteVisit;
API.addObs            = (pid, vid, formData) => API.call('POST', `/meetings/${vid}/observation`, formData, true);

// ── BUDGET
API.getBudget   = (pid)     => API.call('GET',   `/budget/${pid}`);
API.getBudgetDigest = (pid) => API.call('GET',   `/budget/${pid}/digest`);

// ── LABOUR
API.getLabour   = (pid)     => API.call('GET',   `/labour/${pid}`);
API.logLabour   = (pid, d)  => API.call('POST',  `/labour/${pid}`, d);
API.validateLabour = (pid, d) => API.call('POST', `/labour/${pid}/validate-all`, d);

// ── PAYMENT REQUESTS
API.getPaymentBatch  = (pid) => API.call('GET',  `/payment-requests/${pid}/weekly-batch`);
API.batchApprovePay  = (pid) => API.call('POST', `/payments/${pid}/batch-approve`);
API.runCompliance    = (pid) => API.call('POST', `/payments/${pid}/compliance-check`);

// ── NOTIFICATIONS
API.getNotifLog = () => API.call('GET', '/notifications/log');

// ── NCR
API.getNCRs  = (pid)     => API.call('GET',  `/issues/ncr/${pid}`);
API.raiseNCR = (pid, d)  => API.call('POST', `/issues/ncr/${pid}`, d);

// ── SUBMITTALS
API.getSubmittals  = (pid)     => API.call('GET',   `/submittals/${pid}`);
API.reviewSubmittal= (id, d)   => API.call('PATCH', `/submittals/${id}/review`, d);

// ── PMC DEPUTY routes were removed in v5.11 (pmc_deputy table dropped,
//   deputisation now handled via the unified users.deputy_id mechanism on
//   PATCH /api/users/:id/deputy). Helpers removed to match.

// ── WEEKLY HEALTH
API.getWeeklyHealth = () => API.call('GET', '/weekly-health/report');

// ── DRAWINGS (review actions)
API.getDrawings          = (pid)          => API.call('GET',  `/drawings/${pid}`);
API.getDrawingHistory    = (pid, drawId)  => API.call('GET',  `/drawings/${pid}/${drawId}/history`);
API.approveDrawingVersion= (vid)          => API.call('POST', `/drawings/version/${vid}/approve`);
API.rejectDrawingVersion = (vid, d)       => API.call('POST', `/drawings/version/${vid}/reject`, d);
API.flagDrawingVersion   = (vid, d)       => API.call('POST', `/drawings/version/${vid}/flag`, d);

// ── DAILY REPORTS
API.getDailyReportToday  = (pid)          => API.call('GET',  `/daily-reports/${pid}/today`);
API.submitDailyReport    = (pid, d, fd)   => fd
  ? API.call('POST', `/daily-reports/${pid}/submit`, fd, true)
  : API.call('POST', `/daily-reports/${pid}/submit`, d);
API.approveDailyReport   = (id)           => API.call('POST', `/daily-reports/${id}/approve`);
API.flagDailyReport      = (id, reason)   => API.call('POST', `/daily-reports/${id}/flag`, { reason });
API.batchApproveDailyReports = (pid)      => API.call('POST', `/daily-reports/${pid}/batch-approve`);

// ── MEETINGS (review/issue actions)
API.updateMeeting        = (id, d)        => API.call('PATCH', `/meetings/${id}`, d);
API.approveMeeting       = (id)           => API.call('POST',  `/meetings/${id}/approve`);
API.issueMeetingToClient = (id, d)        => API.call('POST',  `/meetings/${id}/issue-to-client`, d);
API.reissueMeeting       = (id)           => API.call('POST',  `/meetings/${id}/reissue`);
API.unlockMeeting        = (id)           => API.call('POST',  `/meetings/${id}/unlock`);
API.acknowledgeMeetingAction  = (id)      => API.call('PATCH', `/meetings/action-items/${id}/acknowledge`);
API.countersignMeetingAction  = (id)      => API.call('PATCH', `/meetings/action-items/${id}/countersign`);
API.completeMeetingAction     = (id)      => API.call('PATCH', `/meetings/action-items/${id}/complete`);

// ── PAYMENT REQUESTS (review chain)
API.pmcReviewPaymentRequest       = (id, d) => API.call('PATCH', `/payment-requests/${id}/pmc-review`, d);
API.principalReviewPaymentRequest = (id, d) => API.call('PATCH', `/payment-requests/${id}/principal-review`, d);
API.confirmPayment                = (id, d) => API.call('PATCH', `/payment-requests/${id}/confirm-payment`, d);
API.raisePaymentRequest           = (pid, d)=> API.call('POST',  `/payment-requests/${pid}`, d);

// ── LABOUR (single entry)
API.validateLabourEntry = (pid, id)       => API.call('PATCH', `/labour/${pid}/${id}/validate`);
API.rejectLabourEntry   = (pid, id, d)    => API.call('PATCH', `/labour/${pid}/${id}/reject`, d);

// ── URGENT PAYMENTS
API.getUrgentPayments   = (pid)           => API.call('GET',  `/urgent-payments/${pid}`);
API.raiseUrgentPayment  = (pid, d, fd)    => fd
  ? API.call('POST', `/urgent-payments/${pid}`, fd, true)
  : API.call('POST', `/urgent-payments/${pid}`, d);

// ── VENDOR MASTER (finance clearance + engagement approvals)
API.getVendorMaster          = (q)        => API.call('GET',  `/vendors/master${q?'?q='+encodeURIComponent(q):''}`);
API.getPendingVendorClearance = ()         => API.call('GET',  '/vendors/master/pending-clearance');
API.clearVendor              = (id, d)    => API.call('PATCH', `/vendors/master/${id}/clear`, d);
API.rejectVendor             = (id, d)    => API.call('PATCH', `/vendors/master/${id}/reject`, d);
API.approveEngagement        = (pid, id)  => API.call('PATCH', `/vendors/${pid}/engagements/${id}/approve`);
API.rejectEngagement         = (pid, id, d) => API.call('PATCH', `/vendors/${pid}/engagements/${id}/reject`, d);
API.getEngagementHistory     = (pid, id)  => API.call('GET',   `/vendors/${pid}/engagements/${id}/history`);

// ── USER MANAGEMENT
API.getPendingUsers  = ()  => API.call('GET',  '/user-management/pending');
API.approveUserMgmt  = (id) => API.call('POST', `/user-management/${id}/approve`);
API.rejectUserMgmt   = (id) => API.call('POST', `/user-management/${id}/reject`);

// ── FINANCE
API.getClientReceipts = (pid)    => API.call('GET',  `/finance/${pid}/client-receipts`);
API.logClientReceipt  = (pid, d) => API.call('POST', `/finance/${pid}/client-receipts`, d);
API.getPettyCash      = (pid)    => API.call('GET',  `/finance/${pid}/petty-cash`);

// ── GRN
API.getGRNs      = (pid)     => API.call('GET',   `/grn/${pid}`);
API.approveGRN   = (id)      => API.call('PATCH', `/grn/${id}/approve`);
API.rejectGRN    = (id)      => API.call('PATCH', `/grn/${id}/reject`);
API.raiseGRN     = (pid, d)  => API.call('POST',  `/grn/${pid}`, d);

// ── ISSUES
API.getIssues    = (pid)     => API.call('GET',   `/issues/${pid}`);
API.raiseIssue   = (pid, d)  => API.call('POST',  `/issues/${pid}`, d);
API.confirmIssue = (id)      => API.call('PATCH', `/issues/${id}/confirm`);
API.dismissIssue = (id)      => API.call('PATCH', `/issues/${id}/dismiss`);


// ── MEASUREMENTS
API.getMeasurements         = (pid)          => API.call('GET',  `/measurements/${pid}`);
API.getMeasurementItems     = (pid, id)      => API.call('GET',  `/measurements/${pid}/${id}/items`);
API.createMeasurement       = (pid, d)       => API.call('POST', `/measurements/${pid}`, d);
API.addMeasurementItems     = (pid, id, d)   => API.call('POST', `/measurements/${pid}/${id}/items`, d);
API.measurementRsSignoff    = (pid, id, d)   => API.call('POST', `/measurements/${pid}/${id}/rs-signoff`, d);
API.measurementClientAccept = (pid, id, fd)  => API.call('POST', `/measurements/${pid}/${id}/client-acceptance`, fd, true);
API.measurementCertificate  = (pid, id)      => API.call('GET',  `/measurements/${pid}/${id}/certificate`);

// ── CLAIMS
API.getClaims       = (pid)          => API.call('GET',  `/claims/${pid}`);
API.getClaimItems   = (pid, id)      => API.call('GET',  `/claims/${pid}/${id}/items`);
API.createClaim     = (pid, d)       => API.call('POST', `/claims/${pid}`, d);
API.addClaimItems   = (pid, id, d)   => API.call('POST', `/claims/${pid}/${id}/items`, d);
API.claimRsSignoff  = (pid, id, d)   => API.call('POST', `/claims/${pid}/${id}/rs-signoff`, d);
API.claimPmcApprove = (pid, id)      => API.call('POST',  `/claims/${pid}/${id}/pmc-signoff`, {});
API.setClaimInvoice = (pid, id, d)   => API.call('PATCH', `/claims/${pid}/${id}/invoice-number`, d);

// ── FORMS / INSPECTIONS
API.getFormTemplates    = ()          => API.call('GET',  `/forms/templates`);
API.getFormSubmissions  = (pid)       => API.call('GET',  `/forms/${pid}/submissions`);
API.createFormTemplate  = (d)         => API.call('POST', `/forms/templates`, d);
API.approveFormTemplate = (id)        => API.call('PATCH', `/forms/templates/${id}/approve`, {});
API.submitForm          = (pid, d)    => API.call('POST', `/forms/${pid}/submit`, d);

// ── LABOUR QUICK
API.getLabourQuick    = (pid)     => API.call('GET',  `/labour-quick/${pid}`);
API.submitLabourQuick = (pid, d)  => API.call('POST', `/labour-quick/${pid}`, d);

// ── SCHEDULE QUICK
API.getScheduleQuick    = (pid)     => API.call('GET',  `/schedule-quick/${pid}`);
API.submitScheduleQuick = (pid, d)  => API.call('POST', `/schedule-quick/${pid}`, d);

// ── COMMS
API.getComms  = (pid)              => API.call('GET',   `/comms/${pid}`);
API.postComm  = (pid, d)           => API.call('POST',  `/comms/${pid}`, d);
API.ackComm   = (pid, commId)      => API.call('PATCH', `/comms/${pid}/${commId}/ack`, {});

// ── DIRECT PAYMENTS
API.getDirectPayments    = (pid)     => API.call('GET',  `/finance/${pid}/direct-payments`);
API.createDirectPayment  = (pid, d)  => API.call('POST', `/finance/${pid}/direct-payments`, d);
API.getAdvanceRecovery   = (engId)   => API.call('GET',  `/finance/advance-recovery/${engId}`);

// ── VENDOR BANK CHANGE
API.getPendingBankChanges = ()         => API.call('GET',  '/vendors/master/bank-changes/pending');
API.proposeBankChange     = (vid, d)   => API.call('POST', `/vendors/master/${vid}/bank-change/propose`, d);
API.approveBankChange   