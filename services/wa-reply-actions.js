// services/wa-reply-actions.js
// WhatsApp reply-to-act state machine
// Sends actionable messages and processes replies

const { tag } = require('./wa-headers');
const users = require('./users-lookup');
const notif = require('./notifications');

// Action types eligible for auto-accept (low stakes only)
const AUTO_ACCEPT_TYPES = new Set(['anomaly_ack','drawing_approval','vendor_defect_ack']);

// Calculate auto-accept time — business hours 7AM-9PM, next 9AM otherwise
function getAutoAcceptTime(sentAt) {
  const sent  = new Date(sentAt || Date.now());
  const hour  = sent.getHours();
  const BIZ_START = 7;
  const BIZ_END   = 21;

  if (hour >= BIZ_START && hour < (BIZ_END - 2)) {
    return new Date(sent.getTime() + 2 * 3600000); // +2 hours
  }
  // Outside hours — 9AM next morning
  const next = new Date(sent);
  if (hour >= BIZ_END) next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

const EXPIRY_HOURS = {
  anomaly_ack:        24,
  grn_approve:        12,
  report_update:       4, // 30min edit window + buffer
  issue_confirm:      24,
  vendor_defect_ack:  48,
  urgent_payment_fyi:  4,
  mom_client_ack:     72, // 3-day MOM window
};

/**
 * Send a pending action message and record it
 */
async function sendPendingAction(db, wa, opts) {
  const { actionType, refId, refTable, phone, userId, raisedBy, message } = opts;
  const expiryHours = EXPIRY_HOURS[actionType] || 24;
  const expiresAt   = new Date(Date.now() + expiryHours * 3600000);

  // Cancel any existing pending action of same type + ref
  await db.query(
    "UPDATE wa_pending_actions SET status='cancelled' WHERE action_type=? AND ref_id=? AND status='pending'",
    [actionType, refId]
  );

  const autoAcceptAt = AUTO_ACCEPT_TYPES.has(actionType) ? getAutoAcceptTime(new Date()) : null;

  const [result] = await db.query(
    `INSERT INTO wa_pending_actions
     (action_type, ref_id, ref_table, phone, user_id, raised_by, message_sent, expires_at, auto_accept_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [actionType, refId, refTable, phone, userId||null, raisedBy||null, message, expiresAt, autoAcceptAt]
  );

  // Append auto-accept notice to eligible action types
  let finalMessage = message;
  if (autoAcceptAt) {
    const timeStr = autoAcceptAt.toLocaleTimeString('en-IN', {
      hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata'
    });
    const dateStr = autoAcceptAt.toLocaleDateString('en-IN', {
      day:'2-digit', month:'short', timeZone:'Asia/Kolkata'
    });
    const isToday = autoAcceptAt.toDateString() === new Date().toDateString();
    finalMessage += '\n\nNo reply by ' + timeStr + (isToday ? '' : ' '+dateStr) + ' = accepted.';
  }

  await wa.send(phone, finalMessage);
  return result.insertId;
}

/**
 * Process an incoming reply — called by webhook
 * Returns { handled, response } or null if no match
 */
async function processReply(db, from, body) {
  const phone = from.replace('whatsapp:+','').replace('whatsapp:','');
  const reply = (body || '').trim();

  // Find pending action for this phone
  const [[pending]] = await db.query(
    `SELECT * FROM wa_pending_actions
     WHERE phone = ? AND status = 'pending' AND expires_at > NOW()
     ORDER BY sent_at DESC LIMIT 1`,
    [phone]
  );

  // Also check for drawing approval button payloads
  if (!pending) {
    if (reply.startsWith('dw_approve_') || reply.startsWith('dw_hold_')) {
      return handleDrawingButtonReply(db, from, reply);
    }
    return null;
  }

  // Mark as acted
  await db.query(
    "UPDATE wa_pending_actions SET status='acted', reply_received=?, replied_at=NOW() WHERE id=?",
    [reply.substring(0,500), pending.id]
  );

  // Route to handler
  switch (pending.action_type) {
    case 'anomaly_ack':        return handleAnomalyAck(db, pending, reply);
    case 'grn_approve':        return handleGRNApprove(db, pending, reply);
    case 'report_update':      return handleReportUpdate(db, pending, reply, from);
    case 'issue_confirm':      return handleIssueConfirm(db, pending, reply);
    case 'vendor_defect_ack':  return handleVendorDefectAck(db, pending, reply);
    case 'urgent_payment_fyi': return handleUrgentPaymentFYI(db, pending, reply);
    case 'mom_client_ack':     return handleMOMClientAck(db, pending, reply);
    case 'drawing_approval':     return handleDrawingApproval(db, pending, reply);
    case 'rfi_photo_reply':      return handleRFIPhotoReply(db, pending, reply);
    case 'udupa_excel_request':  return handleUdupaExcelRequest(db, pending, reply);
    case 'drawing_query':      return handleDrawingQueryReply(db, pending, reply);
    default: return null;
  }
}

// ── HANDLERS

async function handleAnomalyAck(db, pending, reply) {
  if (reply === '1') {
    await db.query(
      "UPDATE daily_reports SET ai_flag_acknowledged=1, ai_flag_ack_at=NOW() WHERE id=?",
      [pending.ref_id]
    );
    return { handled: true, response: '✓ Anomaly acknowledged. Recorded in app.' };
  }
  if (reply === '2') {
    // Escalate to Principal
    const [principals] = await db.query(
      "SELECT id FROM users WHERE role IN ('principal','design_principal') AND is_active=1"
    );
    const notifLog = require('./notif-log');
    for (const p of principals) {
      await notifLog.logUserNotif({
        userId: p.id, messageType: 'report_anomaly_escalated',
        body: 'Daily report anomaly escalated by PMC Head — review needed.',
        status: 'pending',
      });
    }
    // Send deep-link to Principal for escalated report
    try {
      const waInt = require('./whatsapp-interactive');
      const [[report]] = await db.query('SELECT project_id FROM daily_reports WHERE id=?', [pending.ref_id]);
      if (report) {
        for (const p of principals) {
          const user = await users.userContact(p.id);
          if (user?.phone) {
            await waInt.sendAnomalyEscalated(user.phone, pending.ref_id,
              'Project', 'Escalated by PMC — review needed').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
          }
        }
      }
    } catch (e) { console.warn('[wa-reply-actions]', e.message); }
    return { handled: true, response: '✓ Escalated to Principal and Design Principal.' };
  }
  return { handled: false, response: 'Please reply 1 (acknowledge) or 2 (escalate).' };
}

async function handleGRNApprove(db, pending, reply) {
  if (reply === '1') {
    await db.query(
      "UPDATE grns SET status='approved', approved_by=?, approved_at=NOW() WHERE id=? AND status='pending'",
      [pending.raised_by, pending.ref_id]
    );
    const [[grn]] = await db.query('SELECT grn_number FROM grns WHERE id=?', [pending.ref_id]);
    return { handled: true, response: '✓ ' + (grn?.grn_number||'GRN') + ' approved.' };
  }
  if (reply === '2') {
    await db.query(
      "UPDATE grns SET status='rejected', approved_by=?, approved_at=NOW(), rejection_reason='Rejected via WhatsApp' WHERE id=?",
      [pending.raised_by, pending.ref_id]
    );
    const [[grn]] = await db.query('SELECT grn_number FROM grns WHERE id=?', [pending.ref_id]);
    return { handled: true, response: '✓ ' + (grn?.grn_number||'GRN') + ' rejected. Open app to add reason.' };
  }
  return { handled: false, response: 'Please reply 1 (approve) or 2 (reject).' };
}

async function handleReportUpdate(db, pending, reply, from) {
  if (reply.toUpperCase() === 'EDIT') {
    // Re-open edit window — send new prompt
    const [[pendingData]] = await db.query(
      'SELECT message_sent FROM wa_pending_actions WHERE id=?', [pending.id]
    );
    return { handled: true, response: 'Send your corrected update now.\n\nFormat: 1-60 2-35 3-25\n(task number - % complete)' };
  }

  // Parse structured progress update
  const updates = parseProgressReply(reply);
  if (Object.keys(updates).length === 0) {
    return { handled: false, response: 'Format: 1-60 2-35 3-25\nReply EDIT to change previous update.' };
  }

  // Get task list from pending ref (daily_report id)
  const [[report]] = await db.query('SELECT project_id FROM daily_reports WHERE id=?', [pending.ref_id]);
  if (!report) return { handled: false, response: 'Report not found. Open app to update.' };

  // Get current tasks in order
  const [tasks] = await db.query(
    `SELECT st.id FROM schedule_tasks st
     JOIN schedule_versions sv ON st.schedule_version_id=sv.id
     WHERE st.project_id=? AND sv.is_current=1
     ORDER BY st.display_order LIMIT 20`,
    [report.project_id]
  );

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  let saved = 0;
  for (const [idxStr, pct] of Object.entries(updates)) {
    const taskIdx = parseInt(idxStr, 10) - 1;
    if (tasks[taskIdx]) {
      await db.query(
        `INSERT INTO task_updates (task_id, project_id, report_date, pct_complete, updated_by)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE pct_complete=VALUES(pct_complete), updated_by=VALUES(updated_by)`,
        [tasks[taskIdx].id, report.project_id, today, pct, pending.raised_by]
      );
      saved++;
    }
  }

  // Notify PMC
  if (pending.raised_by) {
    const [pmcs] = await db.query(
      `SELECT u.id FROM users u JOIN project_assignments pa ON pa.user_id=u.id
       WHERE pa.project_id=? AND u.role='pmc_head' AND u.is_active=1`,
      [report.project_id]
    );
    const notifLog = require('./notif-log');
    for (const p of pmcs) {
      await notifLog.logUserNotif({
        userId: p.id, messageType: 'daily_report',
        body: 'Daily update received via WhatsApp — ' + saved + ' tasks updated.',
        status: 'pending',
      });
    }
  }

  return {
    handled: true,
    response: '✓ Update recorded — ' + saved + ' task' + (saved !== 1 ? 's' : '') + ' updated.\n\nReply EDIT within 30 min to change.'
  };
}

async function handleIssueConfirm(db, pending, reply) {
  if (reply === '1') {
    await db.query(
      "UPDATE issues SET status='open', confirmed_by=?, confirmed_at=NOW() WHERE id=?",
      [pending.raised_by, pending.ref_id]
    );
    const [[issue]] = await db.query('SELECT issue_number FROM issues WHERE id=?', [pending.ref_id]);
    return { handled: true, response: '✓ ' + (issue?.issue_number||'Issue') + ' confirmed — entered into register.' };
  }
  if (reply === '2') {
    await db.query("UPDATE issues SET status='closed' WHERE id=?", [pending.ref_id]);
    return { handled: true, response: '✓ Issue dismissed.' };
  }
  return { handled: false, response: 'Reply 1 (confirm into register) or 2 (dismiss).' };
}

async function handleVendorDefectAck(db, pending, reply) {
  if (reply === '1') {
    await db.query(
      "UPDATE issues SET status='in_progress', resolution_note=CONCAT(COALESCE(resolution_note,''), ' | Vendor acknowledged via WhatsApp ', NOW()) WHERE id=?",
      [pending.ref_id]
    );
    return { handled: true, response: '✓ Defect acknowledged. Please rectify and notify PMC.' };
  }
  if (reply === '2') {
    await db.query(
      "UPDATE issues SET vendor_disputed=1 WHERE id=?", [pending.ref_id]
    );
    // Notify PMC of dispute
    const [[ncr]] = await db.query("SELECT project_id FROM issues WHERE issue_type='quality' AND id=?", [pending.ref_id]);
    if (ncr) {
      const [pmcs] = await db.query(
        `SELECT u.id FROM users u JOIN project_assignments pa ON pa.user_id=u.id
         WHERE pa.project_id=? AND u.role='pmc_head' AND u.is_active=1`, [ncr.project_id]
      );
      for (const p of pmcs) {
        await notif.notify(p.id, 'ncr_disputed', 'Vendor has disputed a defect — review in app.');
      }
    }
    return { handled: true, response: '✓ Dispute noted. PMC has been notified.' };
  }
  return { handled: false, response: 'Reply 1 (acknowledge defect) or 2 (dispute).' };
}

async function handleUrgentPaymentFYI(db, pending, reply) {
  if (reply === '1') {
    return { handled: true, response: '✓ Noted.' };
  }
  if (reply === '2') {
    // Flag for review — add note to payment request
    await db.query(
      "UPDATE payment_requests SET pmc_notes=CONCAT(COALESCE(pmc_notes,''),' [PMC Query via WA]') WHERE id=?",
      [pending.ref_id]
    );
    return { handled: true, response: '✓ Query noted — open app to review the payment.' };
  }
  return { handled: false, response: 'Reply 1 (noted) or 2 (query).' };
}

async function handleMOMClientAck(db, pending, reply) {
  if (reply === '1') {
    await db.query(
      "UPDATE meetings SET client_acked_at=NOW(), client_ack_response='accepted', status='acknowledged' WHERE id=?",
      [pending.ref_id]
    );
    return { handled: true, response: '✓ MOM accepted. Thank you.' };
  }
  if (reply === '2') {
    // Reset 3-day window
    const [[rev]] = await db.query(
      'SELECT * FROM meeting_revisions WHERE meeting_id=? ORDER BY version DESC LIMIT 1', [pending.ref_id]
    );
    if (rev && !rev.locked) {
      // Notify author to reissue
      const [[mom]] = await db.query('SELECT created_by FROM meetings WHERE id=?', [pending.ref_id]);
      if (mom) {
        await notif.notify(mom.created_by, 'mom_client_revision',
          'Client has requested changes to MOM. Please revise and reissue. Open app.');
      }
    }
    return { handled: true, response: '✓ Change request noted. Our team will reissue the MOM shortly.' };
  }
  return { handled: false, response: 'Reply 1 (accept MOM) or 2 (request changes).' };
}

// ── HELPERS

function parseProgressReply(text) {
  const updates = {};
  const matches = (text || '').match(/(\d+)[-:]\s*(\d+)/g) || [];
  matches.forEach(m => {
    const parts = m.split(/[-:]/);
    const idx = parseInt(parts[0], 10);
    const pct = parseInt(parts[1], 10);
    if (idx >= 1 && idx <= 20 && pct >= 0 && pct <= 100) {
      updates[idx] = pct;
    }
  });
  return updates;
}

async function handleDrawingQueryReply(db, pending, reply) {
  // 'open_app' button tapped — just acknowledge, deep-link already sent
  if (reply.toLowerCase().includes('open') || reply === '2') {
    return { handled: true, response: null }; // silence — CTA button handles navigation
  }
  // Text reply — capture as RFI response
  await db.query(
    "UPDATE issues SET rfi_response=?, rfi_responded_by=?, rfi_responded_at=NOW(), status='resolved' WHERE id=?",
    [reply.substring(0,500), pending.raised_by, pending.ref_id]
  );
  // Notify the site manager who raised the query
  const [[query]] = await db.query(
    'SELECT dq.project_id, dq.raised_by, u.phone FROM issues dq JOIN users u ON dq.raised_by=u.id WHERE dq.id=?',
    [pending.ref_id]
  );
  if (query?.phone) {
    const wa = require('./whatsapp');
    await wa.send(query.phone, tag('fyi', 'Your drawing query has been answered. Open the nu PMC app to view the full response.', null)).catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
  }
  return { handled: true, response: '✓ Answer recorded. Site manager notified.' };
}

async function handleDrawingApproval(db, pending, reply) {
  if (reply === '1' || reply.toLowerCase() === 'approve') {
    await db.query(
      "UPDATE drawing_versions SET status='issued', l2_approved_by=?, l2_approved_at=NOW() WHERE id=?",
      [pending.raised_by, pending.ref_id]
    );
    return { handled: true, response: '✓ Drawing approved.' };
  }
  if (reply === '2' || reply.toLowerCase() === 'hold') {
    await db.query(
      "UPDATE drawing_versions SET is_held=1, held_at=NOW(), held_by=? WHERE id=?",
      [pending.raised_by, pending.ref_id]
    );
    return { handled: true, response: '✓ Drawing held. Open app to add comments.' };
  }
  return { handled: false, response: 'Reply 1 (Approve) or 2 (Hold).' };
}

async function handleDrawingButtonReply(db, phone, payload) {
  const [action, , versionId] = payload.split('_');
  if (!versionId) return null;
  const isApprove = action === 'dw' && payload.includes('approve');
  const [[user]] = await db.query(
    "SELECT id FROM users WHERE phone=? AND is_active=1 LIMIT 1", [phone]
  );
  if (user) {
    if (isApprove) {
      await db.query(
        "UPDATE drawing_versions SET status='issued', l2_approved_by=?, l2_approved_at=NOW() WHERE id=?",
        [user.id, versionId]
      );
    } else {
      await db.query(
        "UPDATE drawing_versions SET is_held=1, held_at=NOW(), held_by=? WHERE id=?",
        [user.id, versionId]
      );
    }
  }
  return {
    handled: true,
    response: isApprove ? '✓ Drawing approved.' : '✓ Drawing held. Open app to add comments.',
  };
}

async function handleUdupaExcelRequest(db, pending, reply) {
  // Generate ICICI Excel and send as attachment
  try {
    const payFmt = require('./payment-format');
    const wa     = require('./whatsapp');

    const [payments] = await db.query(
      `SELECT pr.pmc_amount, pr.amount_requested,
              v.vendor_name, v.bank_account, v.bank_ifsc, ve.scope
       FROM payment_requests pr
       JOIN vendor_engagements ve ON pr.engagement_id=ve.id
       JOIN vendors v ON ve.vendor_id=v.id
       WHERE pr.status='principal_approved' AND DATE(pr.principal_reviewed_at)=CURDATE()`
    );

    if (!payments.length) {
      return { handled: true, response: 'No approved payments found for today.' };
    }

    const _d = new Date();
    const today = String(_d.getDate()).padStart(2,'0') + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + _d.getFullYear();

    // This cross-project WhatsApp path assumes the LLP entity — all payment
    // batches disburse from the same account. If multi-entity support is ever
    // needed this path must be refactored to group payments by entity first.
    const [[entity]] = await db.query(
      `SELECT bank_account_no FROM company_entities WHERE entity_code = 'LLP' LIMIT 1`
    );
    if (!entity?.bank_account_no) throw new Error('LLP entity bank account not configured');

    const excelPath = await payFmt.generateBulkPaymentExcel(
      payments.map(p => ({
        vendor: { vendor_name: p.vendor_name, bank_account: p.bank_account, bank_ifsc: p.bank_ifsc },
        engagement: { scope: p.scope },
        payment: { recommended_amount: p.pmc_amount || p.amount_requested },
      })),
      'ALL-PROJECTS', today, entity.bank_account_no
    );

    // Send Excel as WhatsApp media attachment
    await wa.sendFile(pending.phone, excelPath,
      'ICICI_Bulk_Payment_' + today.replace(/ /g,'_') + '.xlsx').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));

    return { handled: true, response: 'ICICI Excel sent. Please verify before uploading to portal.' };
  } catch (err) {
    console.error('[WA-Reply] Excel generation error:', err.message);
    return { handled: true, response: 'Excel generation failed. Please open the app to download manually.' };
  }
}

async function handleRFIPhotoReply(db, pending, body) {
  // Site manager sends photo via WhatsApp — system downloads and links to RFI
  // Note: actual media download handled in WhatsApp webhook (req.body.MediaUrl0)
  // This handler processes the text confirmation
  if (!body || body.trim().length === 0) {
    return { handled: false, response: 'Please send a photo with your message.' };
  }

  // Check if this is a text reply (no photo) or just confirmation
  return {
    handled: true,
    response: 'Photo received. Open the app to add more photos or close the request.',
    store_text: body,
  };
}

// Register only — no WA send (used when interactive button was already sent separately)
async function registerPendingAction(db, opts) {
  const { actionType, refId, refTable, phone, userId, message } = opts;
  const expiryHours = EXPIRY_HOURS[actionType] || 24;
  const expiresAt   = new Date(Date.now() + expiryHours * 3600000);
  await db.query(
    "UPDATE wa_pending_actions SET status='cancelled' WHERE action_type=? AND ref_id=? AND phone=? AND status='pending'",
    [actionType, refId, phone]
  );
  const [result] = await db.query(
    `INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, raised_by, message_sent, expires_at)
     VALUES (?,?,?,?,?,?,?)`,
    [actionType, refId, refTable, phone, userId||null, message||'', expiresAt]
  );
  return result.insertId;
}

module.exports = { sendPendingAction, registerPendingAction, processReply };
