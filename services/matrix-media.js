// services/matrix-media.js
// ============================================================
// Inbound file processing — delta brief §11 (1 May 2026).
//
// Team members and vendors send photos, PDFs, and documents via
// Element X. The bot's reader job (services/matrix-reply-actions.js)
// scans recent room events; for every m.image/m.file/m.video/m.audio
// event, it calls processIncomingFile() here.
//
// What this module does for each file event:
//   1. Look up the project from project_matrix_rooms by room_id.
//      If the room isn't a project room, drop the file.
//   2. If the event is in a thread, look up the signoff_instance by
//      poll_event_id to derive document_id and workflow_type.
//   3. Dedupe by matrix_event_id (UNIQUE constraint on
//      document_attachments). Re-runs are no-ops.
//   4. Reject videos > 25MB cap (Principal, May 2026). Record the rejected
//      attempt so the reader doesn't keep re-fetching it.
//   5. Download the bytes from EMS via the adapter.
//   6. Compress images > 2MB via existing sharp pipeline.
//   7. Persist to UPLOAD_DIR/matrix-media/<project_code>/<filename>.
//   8. Insert into document_attachments.
//
// What this module does NOT do:
//   - It does not poll Matrix on its own. The reader passes events.
//   - It does not advance any cursor — dedup is by matrix_event_id.
//   - It does not own the trigger schedule. The reader cron does.
// ============================================================

'use strict';

const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const matrixAdapter = require('./matrix-adapter');
const db            = require('../middleware/db');

const UPLOAD_DIR        = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const MEDIA_SUBDIR      = 'matrix-media';
const VIDEO_MAX_BYTES   = 25 * 1024 * 1024;   // 25 MB cap, Principal's call
const IMAGE_COMPRESS_AT = 2  * 1024 * 1024;   // brief §11.7: compress images >2MB
const HANDLED_TYPES     = new Set(['m.image', 'm.file', 'm.video', 'm.audio']);

/**
 * Public entry point.
 *
 * @param {object} event   Matrix room event (m.room.message kind)
 * @param {string} roomId  the room the event was seen in
 * @returns {Promise<{action:'inserted'|'duplicate'|'rejected'|'skipped', id?:number, reason?:string}>}
 */
async function processIncomingFile(event, roomId) {
  const msgtype = event?.content?.msgtype;
  if (!HANDLED_TYPES.has(msgtype)) return { action: 'skipped', reason: 'not_a_file' };
  if (!event.event_id || !event.content?.url) return { action: 'skipped', reason: 'malformed_event' };

  // 1. Dedupe FIRST — cheap, lets us bail before any download.
  const [[existing]] = await db.query(
    `SELECT id FROM document_attachments WHERE matrix_event_id = ? LIMIT 1`,
    [event.event_id]
  );
  if (existing) return { action: 'duplicate', id: existing.id };

  // 2. Resolve project from room.
  const [[room]] = await db.query(
    `SELECT pmr.project_id, p.code AS project_code
       FROM project_matrix_rooms pmr
       JOIN projects p ON p.id = pmr.project_id
      WHERE pmr.matrix_room_id = ? LIMIT 1`,
    [roomId]
  );
  if (!room) return { action: 'skipped', reason: 'room_not_a_project_room' };

  // 3. Resolve document context if event is in a thread.
  let documentId  = null;
  let workflowType = null;
  const threadRootId =
        event.content?.['m.relates_to']?.event_id
     ?? event['m.relates_to']?.event_id;
  if (threadRootId) {
    const [[inst]] = await db.query(
      `SELECT document_id, workflow_type
         FROM signoff_instances WHERE poll_event_id = ? LIMIT 1`,
      [threadRootId]
    );
    if (inst) {
      documentId   = inst.document_id;
      workflowType = inst.workflow_type;
    }
  }

  // 4. Resolve uploader to a user id if known. Senders may also be
  //    vendors or guests (no users row) — uploaded_by_uid stays NULL
  //    in that case; uploaded_by_mxid always preserved for audit.
  let uploaderUid = null;
  if (event.sender) {
    const [[u]] = await db.query(
      `SELECT id FROM users WHERE matrix_user_id = ? LIMIT 1`,
      [event.sender]
    );
    if (u) uploaderUid = u.id;
  }

  // 5. Size-cap rejection for videos. Record rejection so re-scans
  //    don't try again.
  const declaredSize = Number(event.content?.info?.size || 0);
  if (msgtype === 'm.video' && declaredSize > VIDEO_MAX_BYTES) {
    return _recordRejection({
      event, roomId, room, documentId, workflowType, uploaderUid,
      reason: `video exceeds ${VIDEO_MAX_BYTES / (1024 * 1024)}MB cap`,
    });
  }

  // 6. Download bytes.
  let buf;
  try {
    buf = await matrixAdapter.downloadMedia(event.content.url);
  } catch (err) {
    console.warn('[matrix-media] download failed', event.event_id, err.message);
    return { action: 'skipped', reason: 'download_failed' };
  }

  // 7. Compress oversized images. Best-effort — fall through to
  //    raw bytes if sharp errors (e.g. unrecognised format).
  let outBuf       = buf;
  let outMime      = event.content.info?.mimetype || 'application/octet-stream';
  let outExtension = path.extname(event.content.body || '').toLowerCase();
  if (msgtype === 'm.image' && buf.length > IMAGE_COMPRESS_AT) {
    try {
      outBuf       = await sharp(buf).rotate().jpeg({ quality: 80 }).toBuffer();
      outMime      = 'image/jpeg';
      outExtension = '.jpg';
    } catch (err) {
      console.warn('[matrix-media] sharp compress failed, storing raw', event.event_id, err.message);
    }
  }

  // 8. Persist locally. Path:
  //    <UPLOAD_DIR>/matrix-media/<project_code>/<eventId>-<safeName>
  //    eventId prefix avoids name collisions across senders.
  const safeName = _safeFilename(event.content.body || `file${outExtension}`);
  const dir      = path.join(UPLOAD_DIR, MEDIA_SUBDIR, room.project_code);
  fs.mkdirSync(dir, { recursive: true });
  const eventTag = String(event.event_id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
  const stored   = path.join(dir, `${eventTag}-${safeName}`);
  fs.writeFileSync(stored, outBuf);

  // 9. Persist DB row. UNIQUE on matrix_event_id catches concurrent
  //    inserts; on duplicate-key error we treat it as a duplicate.
  let insertId;
  try {
    const [r] = await db.query(
      `INSERT INTO document_attachments
         (project_id, document_id, workflow_type, filename, mimetype,
          size_bytes, stored_path, uploaded_by_mxid, uploaded_by_uid,
          uploaded_at, matrix_event_id, mxc_url, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'matrix')`,
      [
        room.project_id, documentId, workflowType, safeName, outMime,
        outBuf.length, path.relative(UPLOAD_DIR, stored),
        event.sender || null, uploaderUid,
        new Date(Number(event.origin_server_ts) || Date.now()),
        event.event_id, event.content.url,
      ]
    );
    insertId = r.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Race: another worker inserted first. Clean up the file we wrote.
      try { fs.unlinkSync(stored); } catch (_e) { /* ignore */ }
      return { action: 'duplicate' };
    }
    throw err;
  }

  return { action: 'inserted', id: insertId };
}

// ── helpers ─────────────────────────────────────────────────────────

async function _recordRejection({ event, room, documentId, workflowType, uploaderUid, reason }) {
  try {
    const [r] = await db.query(
      `INSERT INTO document_attachments
         (project_id, document_id, workflow_type, filename, mimetype,
          size_bytes, stored_path, uploaded_by_mxid, uploaded_by_uid,
          uploaded_at, matrix_event_id, mxc_url, source,
          rejected, rejection_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'matrix', 1, ?)`,
      [
        room.project_id, documentId, workflowType,
        _safeFilename(event.content.body || 'rejected'),
        event.content.info?.mimetype || null,
        Number(event.content.info?.size || 0),
        '',                         // stored_path empty: nothing on disk
        event.sender || null, uploaderUid,
        new Date(Number(event.origin_server_ts) || Date.now()),
        event.event_id, event.content.url,
        reason,
      ]
    );
    return { action: 'rejected', id: r.insertId, reason };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return { action: 'duplicate' };
    throw err;
  }
}

function _safeFilename(name) {
  const trimmed = String(name).slice(0, 200);
  return trimmed.replace(/[^A-Za-z0-9._-]+/g, '_') || 'file';
}

module.exports = {
  processIncomingFile,
  // exported for tests
  _safeFilename,
  VIDEO_MAX_BYTES,
  IMAGE_COMPRESS_AT,
};
