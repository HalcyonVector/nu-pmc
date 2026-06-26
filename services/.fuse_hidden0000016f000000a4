// services/notifications.js
// ===========================================================
// Single source of truth for EVENT-BASED notifications.
// Every route that wants to say "this happened, tell the right people"
// calls a function from here. One signature per event.
//
// Convention:
//   notify<Event>(projectOrContextId, ...eventData)
//
// As of v5.23 (Matrix substrate), the substrate is services/messaging.js —
// notify() routes through messaging.notifyUser() which decides Matrix vs
// WhatsApp per the global NOTIFICATIONS env flag and per-user preferences.
//
// ─── DUAL-SUBSTRATE NOTE (Concept-Map Audit, May 2026) ───────────────
// nu PMC has THREE outbound-dispatch substrates. They are NOT redundant:
//
//   Path A — THIS FILE (notifications.js + notify())
//            DB-driven via notification_triggers (event_key → recipient
//            roles → users → channel). Use when:
//              • Recipients are a ROLE (principals, PMC heads, finance admins)
//              • You want governance-sheet edit-ability for routing
//              • Recipients are internal (have user rows)
//
//   Path B — services/whatsapp-interactive.js
//            Direct phone arg, Twilio Content API buttons. Use when:
//              • Message has interactive buttons (Approve/Reject, etc.)
//              • Recipient is already known by phone (no role lookup)
//              • Built-in reply parsing is needed (paired with
//                wa-reply-actions.js correlation rows)
//
//   Path C — services/whatsapp.js send() directly
//            Raw text, single recipient. Use when:
//              • Recipient is EXTERNAL (vendor, client) — no user row
//              • Message body is fully owned by the caller
//              • No correlation / reply-handling needed
//
// COMMON DRIFT (4 sites known as of May 2026): a route uses Path C with
// `users.principalPhones()` or similar — that's Path A territory pretending
// to be Path C. If you have a role to look up + a known event key, use
// Path A. The drift list:
//   modules/auth/routes/admin-reset.js:170     (password.reset event)
//   modules/finance/routes/payments.js:118     (payment.exception event)
//   modules/finance/routes/payments.js:597     (self-notification — edge)
//   modules/finance/routes/payments.js:1009    (urgent-payment.utr-confirmed)
// Migration is blocked on Principal-input: each new event_key needs recipient
// roles seeded into notification_triggers (governance-sheet decision).
// ─────────────────────────────────────────────────────────────────────
// ===========================================================

const db = require('../middleware/db');
const users = require('./users-lookup');

// Twilio creds env-read at call time (not at module-load) so an operator
// can rotate them or move from sandbox to production without restart.
// Same pattern as services/matrix-adapter.js _env() and services/whatsapp.js
// (which does its own env-at-call-time inside provider.send).

// ── CORE: notify a single user by id, log + send
// As of v5.23 this delegates to services/messaging.js — that adapter handles
// channel resolution (matrix vs whatsapp), notification logging via notif-log,
// and provider-specific send via matrix-adapter.js or whatsapp.js.
//
// Optional 4th argument: { projectId, roomType, channel } — if provided, a
// matrix-channel send will target the specified project room. Most callers
// don't supply these; messaging.js will then route to the user's per-role
// internal room (e.g. internal_finance for finance_admin).
async function notify(userId, messageType, content, opts = {}) {
  try {
    const messaging = require('./messaging');
    return await messaging.notifyUser({
      userId,
      messageType,
      body: content,
      projectId: opts.projectId,
      roomType:  opts.roomType,
      channel:   opts.channel,
    });
  } catch (err) {
    console.error('[notify] error:', err.message);
  }
}

// ── HELPER: triangulate a phone number to a user_id, then notify by id
//
// Why: many legacy notification helpers were written when the only
// channel was WhatsApp. They take `phone` as the recipient. As part of
// the May 2026 Matrix migration we don't want to churn every call site
// (50+ callers across modules) — instead we keep the phone-based
// signatures and route them through messaging.notifyUser internally.
//
// Lookup logic:
//   1. Phone matches a row in `users` → notify by users.id (gets Matrix
//      DM if user has matrix_user_id, otherwise bridge fallback). This
//      covers all internal staff.
//   2. Phone matches no users row → external recipient (vendor, client).
//      Route via messaging's bridge path which sends to the WhatsApp-
//      bridged Matrix room keyed on phone. Same end-user UX as before
//      Matrix migration: vendor gets a WhatsApp message on their phone.
//
// Phone normalisation: defers to wa-link.normalisePhone — same digits-
// with-country-code form that `users.phone` is stored in. Without this,
// a `+91 98765 43210` caller-string and a `919876543210` DB value won't
// match and lookup-1 silently misses → fallback path fires for an
// internal user (wrong room).
async function _notifyByPhone(phone, messageType, content, opts = {}) {
  if (!phone) return;
  let normalised;
  try {
    const { normalisePhone } = require('./wa-link');
    normalised = normalisePhone(phone) || phone;
  } catch (_e) {
    normalised = phone;
  }

  // Try users-table lookup. Both raw and normalised forms — DB values
  // historically vary because earlier inserts didn't normalise.
  const [[user]] = await db.query(
    `SELECT id FROM users
       WHERE (phone = ? OR phone = ?) AND is_active = 1
       LIMIT 1`,
    [phone, normalised]
  );

  if (user) {
    return notify(user.id, messageType, content, opts);
  }

  // External recipient — no Matrix room.
  // Create an assignment for the responsible person to send manually via wa.me.
  // The friction is intentional: repeated manual sends create pressure to onboard
  // the vendor to Matrix.
  try {
    const { assignExternalComm } = require('./external-comm');
    await assignExternalComm({
      activityType: messageType,
      vendorPhone:  normalised,
      messageBody:  content,
    });
    await _logCommsOut({
      phone: normalised, body: content, messageType,
      status: 'assigned_manual',
    });
  } catch (err) {
    console.error('[_notifyByPhone external]', err.message);
  }
}

// Note: an earlier _sendWhatsApp helper that posted to AiSensy was removed
// after Principal confirmed AiSensy is no longer in use (replaced by Twilio).
// The only caller (sendOTP below) now uses services/whatsapp.send() directly.
// The bug being fixed: the AiSensy call was passing TWILIO_AUTH_TOKEN as the
// AiSensy apiKey field — wrong-credential reuse from a half-finished refactor.

// ── HELPER: notify everyone holding a role (optionally filtered to a project)
async function _notifyByRole(roles, messageType, content, projectId = null) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  const placeholders = roleList.map(() => '?').join(',');

  let rows;
  if (projectId) {
    [rows] = await db.query(
      `SELECT DISTINCT u.id FROM users u
       JOIN project_assignments pa ON pa.user_id = u.id
       WHERE u.role IN (${placeholders}) AND u.is_active = 1
         AND pa.project_id = ? AND pa.is_active = 1`,
      [...roleList, projectId]
    );
  } else {
    [rows] = await db.query(
      `SELECT id FROM users WHERE role IN (${placeholders}) AND is_active = 1`,
      roleList
    );
  }
  for (const u of rows) await notify(u.id, messageType, content);
}

// ── HELPER: notify everyone subscribed to a NAMED EVENT
//
// Looks up the recipient roles from notification_triggers (loaded from
// Sheet 3 — the governance source of truth). When the table has rows for
// the event, those are used. When the table is empty (sheet not loaded
// yet, or this event is brand-new), falls back to the hardcoded role list
// passed by the caller.
//
// This is the abstraction over the previously-scattered hardcoded role
// arrays in this file. Principal edits Sheet 3, reloads, behavior changes
// without code edits — same governance-driven principle as approvals.
//
// Errors querying the table fall back silently to the hardcoded list so
// notification reliability never depends on the governance table being up.
async function _notifyByEvent(eventKey, fallbackRoles, messageType, content, projectId = null) {
  let dbRoles = null;
  try {
    const [rows] = await db.query(
      `SELECT recipient_role FROM notification_triggers WHERE event_key = ? AND is_active = 1`,
      [eventKey]
    );
    if (rows && rows.length) {
      // Filter out non-role recipients (assignee/raiser/vendor) — those need
      // context-specific resolution that this helper doesn't have.
      const ROLE_LIKE = /^[a-z_]+$/;
      const NON_ROLE = new Set(['assignee', 'raiser', 'vendor']);
      dbRoles = rows
        .map(r => r.recipient_role)
        .filter(r => r && ROLE_LIKE.test(r) && !NON_ROLE.has(r));
    }
  } catch (e) {
    // Table may not exist (pre-migration), or query failed — fall back
    console.warn('[_notifyByEvent] table lookup failed for', eventKey, '— using fallback:', e.message);
  }
  const finalRoles = (dbRoles && dbRoles.length) ? dbRoles : fallbackRoles;
  await _notifyByRole(finalRoles, messageType, content, projectId);
}

const fmtRupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// ========================================================
// EVENT NOTIFICATIONS — one per real-world event
// ========================================================

async function notifyDrawingIssued(projectId, drawingNumber, revision, drawingName) {
  const msg = `nu PMC: Drawing issued — ${drawingNumber} ${revision} (${drawingName}). Open app to view.`;
  await _notifyByEvent('drawing.issued', ['site_manager','senior_site_manager','pmc_head'], 'drawing_issued', msg, projectId);
}

async function notifyRFIRaised(projectId, drawingNumber, question, stream) {
  const msg = `nu PMC: RFI raised on ${drawingNumber} — "${(question||'').substring(0,80)}...". Assign and resolve in app.`;
  // Stream-specific fallback list. Sheet 3 should have a stream-aware
  // event_key (e.g. rfi.raised.design vs rfi.raised.services) for table-driven
  // dispatch; until those rows exist, fallback distinguishes stream here.
  const fallback = stream === 'design'
    ? ['pmc_head','design_head','design_principal','principal']
    : ['pmc_head','services_head','design_principal','principal'];
  const eventKey = stream === 'design' ? 'rfi.raised.design' : 'rfi.raised.services';
  await _notifyByEvent(eventKey, fallback, 'rfi_raised', msg, projectId);
}

async function notifyRFIOverdue(projectId, drawingNumber, daysOpen) {
  const msg = `nu PMC ⚠️ OVERDUE: RFI on ${drawingNumber} unanswered for ${daysOpen} days. Immediate action needed.`;
  await _notifyByEvent('rfi.overdue', ['pmc_head','design_head','services_head','principal'], 'rfi_overdue', msg, projectId);
}

async function notifyRFIClosed(projectId, drawingNumber, resolutionNote) {
  const msg = `nu PMC: RFI on ${drawingNumber} closed. ${(resolutionNote||'').substring(0,80)}`;
  await _notifyByEvent('rfi.closed', ['pmc_head','site_manager'], 'rfi_closed', msg, projectId);
}

async function notifyScheduleApproved(projectId, versionLabel, driftDays) {
  const drift = driftDays > 0 ? ` (+${driftDays}d slip)` : (driftDays < 0 ? ` (${driftDays}d ahead)` : '');
  const msg = `nu PMC: Schedule ${versionLabel} approved${drift}. Baseline updated in app.`;
  await _notifyByEvent('schedule.approved', ['pmc_head','site_manager','design_head','services_head'], 'schedule_approved', msg, projectId);
}

async function notifyChangeNoticeApproved(projectId, cnNumber, title) {
  const msg = `nu PMC: Change Notice ${cnNumber} approved — "${title}". Execute as per revised scope.`;
  await _notifyByEvent('cn.approved', ['pmc_head','site_manager','design_head','services_head'], 'cn_approved', msg, projectId);
}

async function notifyCNSignaturesNeeded(cnNumber, title) {
  const msg = `nu PMC: Change Notice ${cnNumber} — "${title}" needs your sign-off. Open app to sign.`;
  await _notifyByEvent('cn.signatures', ['design_head','services_head','pmc_head'], 'cn_signatures', msg);
}

async function notifyCNStuck(projectId, cnNumber, daysOpen) {
  const msg = `nu PMC ⚠️ STUCK: Change Notice ${cnNumber} unsigned for ${daysOpen} days. Escalating.`;
  await _notifyByEvent('cn.stuck', ['principal','design_principal'], 'cn_stuck', msg, projectId);
}

async function notifyMaterialOverdue(projectId, itemName, neededBy) {
  const msg = `nu PMC: Material overdue — "${itemName}" needed by ${neededBy}. Review in app.`;
  await _notifyByEvent('material.overdue', ['pmc_head','site_manager'], 'material_overdue', msg, projectId);
}

async function notifyTaskRejected(siteManagerId, taskName, reason) {
  const msg = `nu PMC: Your update on "${taskName}" was rejected. Reason: ${reason||'See app'}. Please revise.`;
  await notify(siteManagerId, 'task_rejected', msg);
}

// Notify a proposer that their approval expired without reaching quorum.
// Called by services/approvals.expireOverdue() after the row's status flips
// from 'pending' to 'expired'. Best-effort — notification failure must not
// roll back the expiry (the expiry has already been committed by the caller).
async function notifyApprovalExpired(proposerId, label, title) {
  if (!proposerId) return;
  const labelText = label || 'Approval';
  const titleText = title || '(untitled)';
  const msg = `nu PMC: ${labelText} "${titleText}" expired without reaching quorum. Open app to re-raise if still needed.`;
  await notify(proposerId, 'approval_expired', msg);
}

async function notifyApprovalNeeded(requestType, title, projectName) {
  const msg = `nu PMC: ${requestType} approval needed — "${title}" on ${projectName}. Open app to review.`;
  await _notifyByEvent('approval.needed', ['principal','design_principal'], 'approval_needed', msg);
}

async function notifyWeeklyReportApproved(projectId, weekNumber, summary, issues) {
  const msg = `nu PMC: Weekly report Week ${weekNumber} approved.\n${(summary||'').substring(0,100)}${issues ? '\nIssues: ' + issues.substring(0,60) : ''}`;
  await _notifyByEvent('weekly.approved', ['pmc_head','design_head','services_head'], 'weekly_approved', msg, projectId);
}

async function notifyPaymentSheet(projectId, weekEnding, total) {
  const totalFmt = fmtRupee(total);
  const msg = `nu PMC: Weekly payment sheet ready — Week ending ${weekEnding}. Total: ${totalFmt}. Download in app.`;
  await _notifyByEvent('payment.sheet', ['pmc_head','principal','design_principal'], 'payment_sheet', msg, projectId);
}

async function notifyDrawingEscalated(projectId, drawingNumber, daysPending) {
  const msg = `nu PMC ⚠️ ESCALATED: Drawing ${drawingNumber} pending approval ${daysPending} days.`;
  await _notifyByEvent('drawing.escalated', ['principal','design_principal'], 'drawing_escalated', msg, projectId);
}

async function notifyMissingReport(siteManagerId, projectName, date, escalationLevel) {
  const urgent = escalationLevel === 'high' ? '⚠️ FINAL REMINDER' : '';
  const msg = `nu PMC ${urgent}: Daily report for ${projectName} (${date}) missing. Submit now.`;
  await notify(siteManagerId, 'missing_report', msg);
}

async function notifyPMCDigest(pmcHeadId, summary) {
  const msg = `nu PMC daily digest:\n${summary}`;
  await notify(pmcHeadId, 'pmc_digest', msg);
}

// Helper: log outbound WhatsApp to external phones (vendors/clients/new users — not user_ids).
// Used by the six notifyX functions below to give auditable delivery tracking.
async function _logCommsOut({ phone, body, messageType, projectId = null, status = 'sent' }) {
  const notifLog = require('./notif-log');
  return notifLog.logOutbound({
    channel: 'whatsapp', toAddress: phone, body, messageType, projectId, status,
  });
}

async function notifyVendorDefectRaised(vendorPhone, projectId, description) {
  // Try vendor's Matrix room first. If not on Matrix, the EMS WhatsApp bridge
  // handles delivery via the vendor's WhatsApp transparently.
  const matrixAdapter = require('./matrix-adapter');
  const project = { name: await users.projectName(projectId) };
  const msg = `⚠️ Defect raised on ${project?.name || 'project'}. ${(description||'').substring(0,120)}. Please attend.`;

  // Look up vendor by phone to find matrix_room_id
  const [[vendor]] = await db.query(
    `SELECT matrix_room_id FROM vendors WHERE phone = ? AND is_active = 1 LIMIT 1`,
    [vendorPhone]
  );
  let sent = false;
  if (vendor?.matrix_room_id) {
    try {
      await matrixAdapter.sendText({ roomId: vendor.matrix_room_id, body: msg });
      sent = true;
    } catch (err) { console.error('[notifyVendorDefectRaised] Matrix failed:', err.message); }
  } else {
    // Tier B vendor — assign to PMC head for manual WhatsApp send.
    const { assignExternalComm } = require('./external-comm');
    await assignExternalComm({
      activityType:  'vendor_defect_raised',
      vendorId:      vendor?.id || null,
      projectId,
      vendorPhone:   vendorPhone,
      messageBody:   msg,
    }).catch(e => console.warn('[notifyVendorDefectRaised] assignExternalComm:', e.message));
  }
  await _logCommsOut({ phone: vendorPhone, body: msg, messageType: 'vendor_defect_raised', projectId, status: sent ? 'sent' : 'assigned_manual' });
}

async function notifyPaymentConfirmed(vendorPhone, vendorName, amount, utr, date) {
  const matrixAdapter = require('./matrix-adapter');
  const amt = Number(amount || 0).toLocaleString('en-IN');
  const msg = `💰 Payment confirmed — ${vendorName}\nAmount: ₹${amt}\nUTR: ${utr}\nDate: ${date}.`;
  const [[vendor]] = await db.query(
    `SELECT matrix_room_id FROM vendors WHERE phone = ? AND is_active = 1 LIMIT 1`,
    [vendorPhone]
  );
  let sent = false;
  if (vendor?.matrix_room_id) {
    try {
      await matrixAdapter.sendText({ roomId: vendor.matrix_room_id, body: msg });
      sent = true;
    } catch (err) { console.error('[notifyPaymentConfirmed] Matrix failed:', err.message); }
  } else {
    const { assignExternalComm } = require('./external-comm');
    await assignExternalComm({
      activityType:  'payment_utr_confirm',
      vendorId:      vendor?.id || null,
      vendorPhone:   vendorPhone,
      messageBody:   msg,
    }).catch(e => console.warn('[notifyPaymentConfirmed] assignExternalComm:', e.message));
  }
  await _logCommsOut({ phone: vendorPhone, body: msg, messageType: 'payment_confirmed', status: sent ? 'sent' : 'assigned_manual' });
}

async function notifyPIRaised(clientPhone, piNumber, amount, milestone) {
  // Per brief §4: PI raised to client is a formal external document — sent via
  // personal email (mailto: deep link in PWA), not via messaging system.
  // This function logs the intent; the PWA handles the actual mailto: dispatch.
  const amt = Number(amount || 0).toLocaleString('en-IN');
  const msg = `Proforma Invoice ${piNumber} raised for ₹${amt}. Milestone: ${milestone||''}.`;
  await _logCommsOut({ phone: clientPhone, body: msg, messageType: 'pi_raised', status: 'pending_email' });
}

async function notifyUserCreated(phone, username, tempPassword) {
  // tempPassword required — caller (admin user-create flow) generates a random
  // one and passes it through. NEVER hardcode a default password here.
  if (!tempPassword) {
    console.error('[notifyUserCreated] tempPassword missing — aborting send to avoid default-password leak');
    return;
  }
  if (!phone) return;
  const msg = `Welcome to nu PMC. Username: ${username}. Temporary password: ${tempPassword}. You must change it on first login.`;
  // Routes through _notifyByPhone which triangulates the phone to a user_id
  // and dispatches via messaging.notifyUser (Matrix DM where possible, WA
  // bridge otherwise). Caller signature unchanged from pre-migration so
  // 50+ existing call sites don't need to touch.
  await _notifyByPhone(phone, 'user_created', msg);
}

async function notifyUserActivated(phone, username, tempPassword) {
  if (!phone) return;
  const msg = tempPassword
    ? `nu PMC account activated.\nUsername: ${username}\nTemporary password: ${tempPassword}\nYou will be asked to change it on first login.`
    : `nu PMC account activated for ${username}. You can now log in.`;
  await _notifyByPhone(phone, 'user_activated', msg);
}

async function notifyUserApprovalNeeded(approverPhone, newUserName, role, initiatedBy) {
  if (!approverPhone) return;
  const msg = `nu PMC: New user pending approval — ${newUserName} (${role}), added by ${initiatedBy}. Open app to approve.`;
  await _notifyByPhone(approverPhone, 'user_approval_needed', msg);
}

// ========================================================
// OTP — uses services/whatsapp transport (was AiSensy until Principal confirmed
// AiSensy was decommissioned). Twilio creds checked at call time so a
// post-startup credential rotation or environment switch is honoured.
// ========================================================
async function sendOTP(phone, otp) {
  const msg = `nu PMC: Your password reset OTP is ${otp}. Valid for 10 minutes. Do not share.`;
  if (process.env.TWILIO_ACCOUNT_SID) {
    const wa = require('./whatsapp');
    await wa.send(phone, msg);
  } else {
    console.log(`[OTP] Would send to ${phone}: ${msg}`);
  }
}

// ── notifyVendor — generalised vendor notification (F1, friction-reduction brief)
// Takes vendor ID, not phone. Routes to Matrix poll or Matrix message depending
// on pollOptions. Falls back to assignExternalComm for Tier B vendors.
//
// @param {number}   vendorId     vendors.id
// @param {string}   message      plain-text message body
// @param {string[]|null} pollOptions  if provided, sends a Matrix poll; else plain message
async function notifyVendor(vendorId, message, pollOptions = null) {
  const [[vendor]] = await db.query(
    `SELECT id, phone, matrix_room_id FROM vendors WHERE id = ? AND is_active = 1 LIMIT 1`,
    [vendorId]
  );
  if (!vendor) {
    console.warn('[notifyVendor] vendor not found or inactive:', vendorId);
    return;
  }

  let sent = false;
  if (vendor.matrix_room_id) {
    const matrixAdapter = require('./matrix-adapter');
    try {
      if (pollOptions && pollOptions.length >= 2) {
        await matrixAdapter.sendPoll({
          roomId:   vendor.matrix_room_id,
          question: message,
          answers:  pollOptions,
        });
      } else {
        await matrixAdapter.sendText({ roomId: vendor.matrix_room_id, body: message });
      }
      sent = true;
    } catch (err) {
      console.error('[notifyVendor] Matrix failed:', err.message);
    }
  }

  if (!sent) {
    // Tier B — assign to PMC/Finance for manual WhatsApp send
    const { assignExternalComm } = require('./external-comm');
    await assignExternalComm({
      activityType:  'vendor_notification',
      vendorId:      vendor.id,
      vendorPhone:   vendor.phone,
      messageBody:   message,
    }).catch(e => console.warn('[notifyVendor] assignExternalComm:', e.message));
  }

  await _logCommsOut({
    phone:       vendor.phone,
    body:        message,
    messageType: 'vendor_notification',
    status:      sent ? 'sent' : 'assigned_manual',
  });
}

module.exports = {
  notify,                              // core — notify one user
  notifyDrawingIssued,
  notifyRFIRaised,
  notifyRFIOverdue,
  notifyRFIClosed,
  notifyScheduleApproved,
  notifyChangeNoticeApproved,
  notifyCNSignaturesNeeded,
  notifyCNStuck,
  notifyMaterialOverdue,
  notifyTaskRejected,
  notifyApprovalExpired,
  notifyApprovalNeeded,
  notifyWeeklyReportApproved,
  notifyPaymentSheet,
  notifyDrawingEscalated,
  notifyMissingReport,
  notifyPMCDigest,
  notifyVendorDefectRaised,
  notifyPaymentConfirmed,
  notifyPIRaised,
  notifyUserCreated,
  notifyUserActivated,
  notifyUserApprovalNeeded,
  notifyVendor,
  sendOTP,
};
