// modules/onboarding/routes/vendor-public.js
// ============================================================
// PUBLIC routes for vendor confirmation flow. NO auth, NO CSRF.
// Mounted at /vendor-onboard in server.js (NOT /api/...).
//
// One of FOUR vendor-data surfaces (healthy split — see vendors.js header
// for the full map). This file = TOKEN side: vendor (unauthenticated)
// confirms / rejects bank or onboarding details via a single-use wa.me link.
//
// Endpoints:
//   GET  /vendor-onboard/:token          — render the confirmation HTML
//   POST /vendor-onboard/:token/confirm  — vendor accepts the proposed change
//   POST /vendor-onboard/:token/reject   — vendor rejects
//
// Security model:
//   - The token IS the auth. No session, no cookie, no CSRF.
//   - Token is single-use (consume on POST confirm/reject)
//   - Token expires in 48h
//   - Token leakage risk: the token is in the URL. We mitigate by:
//     • short 48h validity
//     • single-use
//     • user-agent + accept-header heuristic (preview-crawler detection)
//     • no destructive action on GET — GET is read-only
//   - Rate-limited at the route level (not built here; lives in
//     server.js's existing /api/ limiter — we extend by mounting our own
//     for /vendor-onboard).
// ============================================================

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const onboarding = require('../../../services/vendor-onboarding');
const db = require('../../../middleware/db');
const audit = require('../../../services/audit');
const asyncHandler = require('../../../middleware/asyncHandler');

// Pre-load the template once on module init. Templates rarely change at
// runtime; if they do, restart picks them up.
const TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', 'public', 'vendor-onboard.html');
let TEMPLATE = '';
try {
  TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8');
} catch (err) {
  console.error('[vendor-public] Failed to load template:', TEMPLATE_PATH, err.message);
  TEMPLATE = '<!DOCTYPE html><html><body><h1>Service unavailable</h1><p>Template missing.</p></body></html>';
}

/**
 * Render an HTML response by substituting %%CONTENT%% in the template.
 * The substitution is a single replace; %%CONTENT%% should appear exactly
 * once in the template.
 */
function renderHtml(res, contentHtml, statusCode = 200) {
  res.status(statusCode);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store');                   // never cache token responses
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(TEMPLATE.replace('%%CONTENT%%', contentHtml));
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── GET /vendor-onboard/:token ───────────────────────────────
router.get('/:token', async (req, res) => {
  let lookupRes;
  try {
    lookupRes = await onboarding.lookup(req.params.token);
  } catch (err) {
    if (err.status === 404) {
      return renderHtml(res, `
        <div class="card">
          <div class="alert alert-error">
            <strong>Link not found</strong><br>
            This link doesn't match any active record. The link may have
            been revoked, or you may have copied it incorrectly.
          </div>
        </div>`, 404);
    }
    return renderHtml(res, `
      <div class="card">
        <div class="alert alert-error">Link could not be opened. Please contact nu associates.</div>
      </div>`, 500);
  }

  // Bump open_count, mark opened on first non-crawler hit
  try { await onboarding.recordOpen(req.params.token, req); } catch (_) { /* best-effort */ }

  if (lookupRes.isExpired) {
    const validity = require('../../../services/vendor-onboarding').humanReadableValidity();
    return renderHtml(res, `
      <div class="card">
        <div class="alert alert-error">
          <strong>This link has expired.</strong><br>
          Confirmation links are valid for ${escapeHtml(validity)}. Please contact
          nu associates to request a fresh link.
        </div>
      </div>`, 410);
  }
  if (lookupRes.isConsumed) {
    return renderHtml(res, `
      <div class="card">
        <div class="alert alert-ok">
          <strong>Already confirmed.</strong><br>
          You've already responded to this link. If you need to make a
          change, please contact nu associates.
        </div>
      </div>`, 200);
  }
  if (lookupRes.isRevoked) {
    return renderHtml(res, `
      <div class="card">
        <div class="alert alert-error">
          <strong>Link revoked.</strong><br>
          A newer confirmation link has been issued. Please use the most
          recent link. If you can't find it, contact nu associates.
        </div>
      </div>`, 410);
  }

  // Valid token — render the form. Branch by purpose.
  const v = lookupRes.vendor;
  const purpose = lookupRes.row.purpose;
  const payload = lookupRes.row.payload_json
    ? (typeof lookupRes.row.payload_json === 'string'
        ? JSON.parse(lookupRes.row.payload_json)
        : lookupRes.row.payload_json)
    : null;

  if (purpose === 'bank_confirm') {
    // Show before/after bank fields with a "Confirm" / "Reject" pair.
    // payload should contain `before` and `after` snapshots.
    const before = payload?.before || {};
    const after  = payload?.after  || {};
    const fld = (lbl, beforeVal, afterVal) => {
      const changed = (beforeVal || '') !== (afterVal || '');
      return `
        <div class="field">
          <label>${escapeHtml(lbl)}</label>
          <div class="value ${changed ? 'changed' : ''}">${escapeHtml(afterVal || '—')}</div>
          ${changed ? `<div class="meta" style="font-size:10px;margin-top:3px">Was: ${escapeHtml(beforeVal || '—')}</div>` : ''}
        </div>`;
    };
    const content = `
      <div class="card">
        <div class="card-title">Confirm bank details for ${escapeHtml(v.vendor_name)}</div>
        <div class="meta" style="margin-bottom:14px">
          nu associates wants to update the bank details we use to pay you.
          Please confirm the new details below are correct.
        </div>
        ${fld('Bank name',     before.bank_name,    after.bank_name)}
        ${fld('Account no.',   before.bank_account, after.bank_account)}
        ${fld('IFSC',          before.bank_ifsc,    after.bank_ifsc)}
        <div class="actions">
          <button class="btn-confirm" id="btn-confirm">✓ Confirm — these are correct</button>
          <button class="btn-reject"  id="btn-reject">✗ Reject — incorrect</button>
        </div>
        <div id="result"></div>
      </div>
      <script>
        (function() {
          var token = ${JSON.stringify(req.params.token)};
          function disable() {
            document.getElementById('btn-confirm').disabled = true;
            document.getElementById('btn-reject').disabled = true;
          }
          async function call(action) {
            disable();
            try {
              const r = await fetch('/vendor-onboard/' + token + '/' + action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
              });
              const data = await r.json().catch(function() { return {}; });
              const cls = r.ok ? 'alert-ok' : 'alert-error';
              const msg = data.message || (r.ok ? 'Recorded.' : 'Something went wrong.');
              document.getElementById('result').innerHTML =
                '<div class="alert ' + cls + '" style="margin-top:14px">' + msg + '</div>';
            } catch (e) {
              document.getElementById('result').innerHTML =
                '<div class="alert alert-error" style="margin-top:14px">Network error. Try again.</div>';
              document.getElementById('btn-confirm').disabled = false;
              document.getElementById('btn-reject').disabled  = false;
            }
          }
          document.getElementById('btn-confirm').addEventListener('click', function(){ call('confirm'); });
          document.getElementById('btn-reject').addEventListener('click',  function(){ call('reject');  });
        })();
      </script>`;
    return renderHtml(res, content);
  }

  if (purpose === 'onboard' || purpose === 're_validation') {
    // Display current vendor details for the vendor to verify.
    const fld = (lbl, val) => `
      <div class="field">
        <label>${escapeHtml(lbl)}</label>
        <div class="value">${escapeHtml(val || '—')}</div>
      </div>`;
    const introCopy = purpose === 're_validation'
      ? 'nu associates is migrating to a new payments process. Please confirm the details we have on file are still correct.'
      : 'nu associates is onboarding you as a vendor. Please confirm the details below are correct.';
    const content = `
      <div class="card">
        <div class="card-title">${purpose === 're_validation' ? 'Re-confirm' : 'Confirm'} details for ${escapeHtml(v.vendor_name)}</div>
        <div class="meta" style="margin-bottom:14px">${introCopy}</div>
        ${fld('GSTIN',       v.gst_number)}
        ${fld('PAN',         v.pan_number)}
        ${fld('Bank name',   v.bank_name)}
        ${fld('Account no.', v.bank_account)}
        ${fld('IFSC',        v.bank_ifsc)}
        <div class="actions">
          <button class="btn-confirm" id="btn-confirm">✓ Confirm — these are correct</button>
          <button class="btn-reject"  id="btn-reject">✗ Reject — incorrect</button>
        </div>
        <div id="result"></div>
      </div>
      <script>
        (function() {
          var token = ${JSON.stringify(req.params.token)};
          function disable() {
            document.getElementById('btn-confirm').disabled = true;
            document.getElementById('btn-reject').disabled = true;
          }
          async function call(action) {
            disable();
            try {
              const r = await fetch('/vendor-onboard/' + token + '/' + action, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
              });
              const data = await r.json().catch(function() { return {}; });
              const cls = r.ok ? 'alert-ok' : 'alert-error';
              const msg = data.message || (r.ok ? 'Recorded.' : 'Something went wrong.');
              document.getElementById('result').innerHTML =
                '<div class="alert ' + cls + '" style="margin-top:14px">' + msg + '</div>';
            } catch (e) {
              document.getElementById('result').innerHTML =
                '<div class="alert alert-error" style="margin-top:14px">Network error. Try again.</div>';
              document.getElementById('btn-confirm').disabled = false;
              document.getElementById('btn-reject').disabled  = false;
            }
          }
          document.getElementById('btn-confirm').addEventListener('click', function(){ call('confirm'); });
          document.getElementById('btn-reject').addEventListener('click',  function(){ call('reject');  });
        })();
      </script>`;
    return renderHtml(res, content);
  }

  // Unknown purpose — defensive
  return renderHtml(res, `
    <div class="card">
      <div class="alert alert-error">Unknown link type. Please contact nu associates.</div>
    </div>`, 400);
});

// Inner action handler shared by confirm + reject (vote: 'approve' | 'reject')
async function handleAction(req, res, vote) {
  let consumed;
  try {
    consumed = await onboarding.consume(req.params.token);
  } catch (err) {
    return res.status(err.status || 400).json({
      error: err.message,
      code:  err.code,
    });
  }

  // Apply side effects based on the purpose + vote.
  // For bank_confirm: link to the V8 approval row; if vendor confirms, set
  // bank_validated_by_vendor=1 AND stamp approvals.vendor_confirmed_at via
  // approvals.recordVendorConfirm so the requires_vendor_confirm gate releases
  // (otherwise approval stays pending even after quorum + vendor confirmed).
  if (consumed.purpose === 'bank_confirm') {
    if (vote === 'approve') {
      await db.tx(async (conn) => {
        await conn.query(
          `UPDATE vendors
              SET bank_validated_by_vendor = 1,
                  bank_validated_at = NOW(),
                  bank_validation_method = 'wa_form'
            WHERE id = ?`,
          [consumed.vendorId]
        );
        // Emit alert for the V8 approval flow
        if (consumed.approvalId) {
          await conn.query(
            `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
             VALUES (?, ?, ?)`,
            [consumed.vendorId, 'bank_change.vendor_confirmed', JSON.stringify({
              approval_id: consumed.approvalId,
              vendor_id: consumed.vendorId,
              method: 'wa_form',
            })]
          );
        }
      });
      // Stamp approvals.vendor_confirmed_at + re-evaluate quorum gate.
      // Done AFTER the vendor-table update so the audit trail shows vendor
      // master changed first, then approval status flipped. Errors swallowed
      // — the vendor-side flow has already succeeded; the approval pipeline
      // can be re-driven by an admin if reevaluate fails (rare).
      if (consumed.approvalId) {
        try {
          const approvals = require('../../../services/approvals');
          await approvals.recordVendorConfirm({ approvalId: consumed.approvalId });
        } catch (err) {
          console.error('[vendor-public] recordVendorConfirm failed for approval',
            consumed.approvalId, '—', err.message);
        }
      }
      // userId=null is correct here — this is a vendor-side action by an
      // UNAUTHENTICATED user holding a one-time token. The token is the
      // identity (entityId=tokenId), and ip+user-agent come through `req`.
      // Audit reader who needs to know "which vendor confirmed" joins
      // details.vendor_id → vendors.
      audit.log({
        userId: null,
        action: 'vendor.bank_confirm.confirmed',
        entityType: 'vendor_onboarding_tokens',
        entityId: consumed.tokenId,
        details: { vendor_id: consumed.vendorId, approval_id: consumed.approvalId },
        req,
      });
      return res.json({ success: true, message: 'Thank you — confirmation recorded.' });
    } else {
      // vote === 'reject'
      await db.query(
        `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
         VALUES (?, ?, ?)`,
        [consumed.vendorId, 'bank_change.vendor_rejected', JSON.stringify({
          approval_id: consumed.approvalId,
          vendor_id: consumed.vendorId,
        })]
      );
      audit.log({
        userId: null,
        action: 'vendor.bank_confirm.rejected',
        entityType: 'vendor_onboarding_tokens',
        entityId: consumed.tokenId,
        details: { vendor_id: consumed.vendorId, approval_id: consumed.approvalId },
        req,
      });
      return res.json({ success: true, message: 'Thanks for letting us know — nu associates will follow up with you.' });
    }
  }

  if (consumed.purpose === 'onboard' || consumed.purpose === 're_validation') {
    if (vote === 'approve') {
      await db.tx(async (conn) => {
        await conn.query(
          `UPDATE vendors
              SET bank_validated_by_vendor = 1,
                  bank_validated_at = NOW(),
                  bank_validation_method = 'wa_form'
            WHERE id = ?`,
          [consumed.vendorId]
        );
        await conn.query(
          `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
           VALUES (?, ?, ?)`,
          [consumed.vendorId,
           consumed.purpose === 'onboard' ? 'onboard.confirmed' : 're_validation.confirmed',
           JSON.stringify({ vendor_id: consumed.vendorId, method: 'wa_form' })]
        );
      });
      audit.log({
        userId: null,
        action: `vendor.${consumed.purpose}.confirmed`,
        entityType: 'vendor_onboarding_tokens',
        entityId: consumed.tokenId,
        details: { vendor_id: consumed.vendorId },
        req,
      });
      return res.json({ success: true, message: 'Thank you — your details are confirmed.' });
    } else {
      await db.query(
        `INSERT INTO vendor_alerts (vendor_id, alert_type, payload_json)
         VALUES (?, ?, ?)`,
        [consumed.vendorId,
         consumed.purpose === 'onboard' ? 'onboard.rejected' : 're_validation.rejected',
         JSON.stringify({ vendor_id: consumed.vendorId })]
      );
      audit.log({
        userId: null,
        action: `vendor.${consumed.purpose}.rejected`,
        entityType: 'vendor_onboarding_tokens',
        entityId: consumed.tokenId,
        details: { vendor_id: consumed.vendorId },
        req,
      });
      return res.json({ success: true, message: 'Thanks for the response — nu associates will be in touch.' });
    }
  }

  return res.status(400).json({ error: 'Unsupported purpose', code: 'PURPOSE_INVALID' });
}

router.post('/:token/confirm', asyncHandler((req, res) => handleAction(req, res, 'approve')));
router.post('/:token/reject',  asyncHandler((req, res) => handleAction(req, res, 'reject')));

module.exports = router;
