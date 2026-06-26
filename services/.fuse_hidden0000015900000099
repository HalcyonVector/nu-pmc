// services/file-storage.js
// ============================================================
// Consolidates the upload → INSERT dance done by several routes.
// Actual file storage (multer + compression) still lives in
// middleware/upload.js. This service just normalises the DB write.
// ============================================================

const db = require('../middleware/db');
const { getFileSize } = require('../middleware/upload');
const dateUtil = require('./date-util');

/**
 * savePhoto({ projectId, file, uploadedBy, taskId?, caption?, source?, photoDate? })
 *   Writes a row to project_photos with primary_entity_type='project_progress'.
 *   `taskId` (when present) is stored in primary_entity_id, preserving the
 *   project_progress photo → schedule_task relationship.
 *   Returns insertId.
 *   `file` is a multer file object with `.path`.
 */
async function savePhoto({ projectId, file, uploadedBy, taskId = null, caption = null, source = 'app', photoDate = null, entityType = 'project_progress' }) {
  const today = photoDate || dateUtil.todayIST();
  const [r] = await db.query(
    `INSERT INTO project_photos
       (project_id, task_id, photo_date,
        file_path, file_size_kb, caption, uploaded_by, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, taskId, today, file.path, getFileSize(file.path), caption, uploadedBy, source]
  );
  return r.insertId;
}

/**
 * saveDocument({ projectId, file, uploadedBy, docType?, category?, title?, notes?, docDate?, isClassified? })
 *   Creates a NEW document record and its version 1.
 *   Returns { documentId, versionId, versionNumber }.
 *   For uploading a NEW version of an existing document, use saveDocumentVersion().
 */
async function saveDocument({ projectId, file, uploadedBy, docType = 'other', category = 'other', title = null, notes = null, docDate = null, isClassified = 0 }) {
  const today = docDate || dateUtil.todayIST();
  const size = getFileSize(file.path);
  const fname = file.originalname;
  const conn = await db.getConnection ? db.getConnection() : null;
  try {
    if (conn) await conn.beginTransaction();
    const runner = conn || db;

    // 1. Create the document record with denormalised current-version fields
    const [r] = await runner.query(
      `INSERT INTO project_documents
         (project_id, title, doc_date, doc_type, category, file_path, file_name, file_size_kb,
          current_version_number, is_classified, notes, uploaded_by)
       VALUES (?,?,?,?,?,?,?,?,1,?,?,?)`,
      [projectId, title || fname, today, docType, category, file.path, fname, size, isClassified ? 1 : 0, notes, uploadedBy]
    );
    const docId = r.insertId;

    // 2. Create version 1 history row
    const [vr] = await runner.query(
      `INSERT INTO project_document_versions
         (document_id, version_number, file_path, file_name, file_size_kb, mime_type, change_note, uploaded_by)
       VALUES (?,1,?,?,?,?,?,?)`,
      [docId, file.path, fname, size, file.mimetype || null, notes, uploadedBy]
    );
    const versionId = vr.insertId;

    // 3. Point the document at its version 1
    await runner.query(
      `UPDATE project_documents SET latest_version_id = ? WHERE id = ?`,
      [versionId, docId]
    );

    if (conn) { await conn.commit(); conn.release(); }
    return { documentId: docId, versionId, versionNumber: 1 };
  } catch (err) {
    if (conn) { try { await conn.rollback(); conn.release(); } catch (_) {} }
    throw err;
  }
}

/**
 * saveDocumentVersion({ documentId, file, uploadedBy, changeNote? })
 *   Adds a NEW version to an existing document. Returns { documentId, versionId, versionNumber }.
 *   Bumps project_documents.current_version_number and latest_version_id atomically.
 */
async function saveDocumentVersion({ documentId, file, uploadedBy, changeNote = null }) {
  const [docs] = await db.query(
    `SELECT id, project_id, current_version_number FROM project_documents WHERE id = ?`,
    [documentId]
  );
  if (docs.length === 0) throw new Error(`Document ${documentId} not found`);
  const nextV = Number(docs[0].current_version_number) + 1;

  const size = getFileSize(file.path);
  const fname = file.originalname;
  const conn = await db.getConnection ? db.getConnection() : null;
  try {
    if (conn) await conn.beginTransaction();
    const runner = conn || db;

    const [vr] = await runner.query(
      `INSERT INTO project_document_versions
         (document_id, version_number, file_path, file_name, file_size_kb, mime_type, change_note, uploaded_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [documentId, nextV, file.path, fname, size, file.mimetype || null, changeNote, uploadedBy]
    );
    const versionId = vr.insertId;

    await runner.query(
      `UPDATE project_documents
         SET current_version_number = ?, latest_version_id = ?,
             file_path = ?, file_name = ?, file_size_kb = ?
       WHERE id = ?`,
      [nextV, versionId, file.path, fname, size, documentId]
    );

    if (conn) { await conn.commit(); conn.release(); }
    return { documentId, versionId, versionNumber: nextV };
  } catch (err) {
    if (conn) { try { await conn.rollback(); conn.release(); } catch (_) {} }
    throw err;
  }
}

/**
 * linkApprovalToDocument({ entityType, entityId, documentVersionId, linkedBy })
 *   Records that a specific version of a document was the evidence for an approval.
 *   Insert-only (audit trail). Returns insertId.
 */
async function linkApprovalToDocument({ entityType, entityId, documentVersionId, linkedBy }) {
  const [r] = await db.query(
    `INSERT INTO approval_document_links
       (entity_type, entity_id, document_version_id, linked_by)
     VALUES (?,?,?,?)`,
    [entityType, entityId, documentVersionId, linkedBy]
  );
  return r.insertId;
}

module.exports = { savePhoto, saveDocument, saveDocumentVersion, linkApprovalToDocument };
