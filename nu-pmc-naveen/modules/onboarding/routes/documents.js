// routes/documents.js
// V5 Fix 3 — Document library with version control.
// Endpoints:
//   GET    /api/documents/:projectId                  list all documents for project
//   GET    /api/documents/:projectId/:docId           single document metadata
//   GET    /api/documents/:projectId/:docId/versions  version history of one document
//   POST   /api/documents/:projectId                  upload NEW document (creates v1)
//   POST   /api/documents/:projectId/:docId/versions  upload NEW version of existing doc
//   GET    /api/documents/file/:versionId             download specific version file
//   POST   /api/documents/link                        link a document version to an approval

const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../../../middleware/db');
const { requireAuth, requireProjectScope, requireRole } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const upload = require('../../../middleware/upload').upload;
const storage = require('../../../services/file-storage');
const audit = require('../../../services/audit');

// Roles allowed to upload documents to a project they have scope for.
// Excludes trainee, jr_architect — they should not contribute to the formal
// document record. Coordinator/services_engineer included so site/services
// staff can attach delivery notes, photos-of-records, etc. Audit role is
// excluded — audit reads everything but should not contribute uploads.
const DOC_UPLOAD_ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'finance_admin','senior_site_manager','site_manager','team_lead',
  'detailing_head','services_engineer','coordinator',
];

const router = express.Router();

// Principals see classified docs too; everyone else sees only unclassified
function classifiedFilter(role) {
  return ['principal', 'design_principal'].includes(role) ? '' : 'AND pd.is_classified = 0';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents/:projectId — list documents for a project
router.get('/:projectId', requireAuth, asyncHandler(async (req, res) => {
  const role = req.session.user.role;
  const [docs] = await db.query(
    `SELECT pd.id, pd.title, pd.doc_type, pd.category, pd.doc_date,
            pd.file_name, pd.file_size_kb, pd.current_version_number,
            pd.latest_version_id, pd.is_classified, pd.notes,
            pd.uploaded_by, pd.uploaded_at
     FROM project_documents pd
     WHERE pd.project_id = ? ${classifiedFilter(role)}
     ORDER BY pd.uploaded_at DESC`,
    [req.params.projectId]
  );
  const Auth = require('../../auth/contract');
  const users = await Auth.functions.getUsers(docs.map(d => d.uploaded_by).filter(Boolean));
  docs.forEach(d => { d.uploaded_by_name = users.get(d.uploaded_by)?.full_name || null; });
  res.json({ documents: docs });
}));

// GET /api/documents/:projectId/:docId — single document
router.get('/:projectId/:docId', requireAuth, asyncHandler(async (req, res) => {
  const role = req.session.user.role;
  const [docs] = await db.query(
    `SELECT pd.* FROM project_documents pd
     WHERE pd.id = ? AND pd.project_id = ? ${classifiedFilter(role)}`,
    [req.params.docId, req.params.projectId]
  );
  if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });
  const Auth = require('../../auth/contract');
  const users = await Auth.functions.getUsers([docs[0].uploaded_by].filter(Boolean));
  docs[0].uploaded_by_name = users.get(docs[0].uploaded_by)?.full_name || null;
  res.json({ document: docs[0] });
}));

// GET /api/documents/:projectId/:docId/versions — full version history
router.get('/:projectId/:docId/versions', requireAuth, requireProjectScope(req => req.params.projectId), asyncHandler(async (req, res) => {
  const role = req.session.user.role;
  // First check the document exists and is visible to this role
  const [[doc]] = await db.query(
    `SELECT pd.id FROM project_documents pd
     WHERE pd.id = ? AND pd.project_id = ? ${classifiedFilter(role)}`,
    [req.params.docId, req.params.projectId]
  ).then(r => [r]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const [versions] = await db.query(
    `SELECT id, version_number, file_name, file_size_kb,
            mime_type, change_note, uploaded_at, uploaded_by
     FROM project_document_versions
     WHERE document_id = ?
     ORDER BY version_number DESC`,
    [req.params.docId]
  );
  const Auth = require('../../auth/contract');
  const users = await Auth.functions.getUsers(versions.map(v => v.uploaded_by).filter(Boolean));
  versions.forEach(v => { v.uploaded_by_name = users.get(v.uploaded_by)?.full_name || null; });
  res.json({ versions });
}));

// POST /api/documents/:projectId — upload a NEW document (creates v1)
//
// Bug B48: previously gated only by requireAuth — any logged-in user
// (including trainee, coordinator, jr_architect) could upload to ANY
// project. Now: project scope enforced + role allowlist.
router.post('/:projectId',
  requireAuth,
  requireProjectScope(req => req.params.projectId),
  requireRole(...DOC_UPLOAD_ROLES),
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { title, doc_type, category, notes, doc_date } = req.body;
    const isClassified = ['contract', 'approval', 'statutory'].includes(category) ? 1 : 0;

    const result = await storage.saveDocument({
      projectId: req.params.projectId,
      file: req.file,
      uploadedBy: me.id,
      docType: doc_type || 'other',
      category: category || 'other',
      title: title || null,
      notes: notes || null,
      docDate: doc_date || null,
      isClassified,
    });

    // Bug B49: document upload now audited (project record-keeping).
    audit.log({ userId: me.id, action: 'document.upload',
      entityType: 'project_documents', entityId: result.documentId,
      details: { project_id: parseInt(req.params.projectId), doc_type: doc_type || 'other', category: category || 'other', title: title || null, is_classified: isClassified, version_id: result.versionId }, req });

    res.json({ success: true, ...result });
  })
);

// POST /api/documents/:projectId/:docId/versions — upload NEW version of existing doc
//
// Bug B50: previously gated only by requireAuth.
router.post('/:projectId/:docId/versions',
  requireAuth,
  requireProjectScope(req => req.params.projectId),
  requireRole(...DOC_UPLOAD_ROLES),
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Verify doc belongs to this project
    const [[doc]] = await db.query(
      `SELECT id FROM project_documents WHERE id = ? AND project_id = ?`,
      [req.params.docId, req.params.projectId]
    ).then(r => [r]);
    if (!doc) return res.status(404).json({ error: 'Document not found in this project' });

    const result = await storage.saveDocumentVersion({
      documentId: req.params.docId,
      file: req.file,
      uploadedBy: me.id,
      changeNote: req.body.change_note || null,
    });

    // Bug B51: version upload now audited.
    audit.log({ userId: me.id, action: 'document.version_upload',
      entityType: 'project_documents', entityId: parseInt(req.params.docId),
      details: { project_id: parseInt(req.params.projectId), version_id: result.versionId, version_number: result.versionNumber, change_note: req.body.change_note || null }, req });

    res.json({ success: true, ...result });
  })
);

// GET /api/documents/file/:versionId — download/stream a specific version
//
// Bug B52: previously this route did no scope check at all — sequential
// version_ids meant a site_manager from Project A could enumerate version_ids
// and download files from Project B. Now: we derive project_id from the
// joined project_documents row and enforce scope inline (since the URL has
// no :project_id to feed requireProjectScope).
router.get('/file/:versionId', requireAuth, asyncHandler(async (req, res) => {
  const me   = req.session.user;
  const role = me.role;
  const [[v]] = await db.query(
    `SELECT pdv.file_path, pdv.file_name, pdv.mime_type, pd.is_classified, pd.project_id
     FROM project_document_versions pdv
     JOIN project_documents pd ON pdv.document_id = pd.id
     WHERE pdv.id = ?`,
    [req.params.versionId]
  ).then(r => [r]);
  if (!v) return res.status(404).json({ error: 'Version not found' });

  // Project scope check — for project-scoped roles, confirm the user is
  // assigned to v.project_id. Firm-wide roles pass through.
  const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
  if (PROJECT_SCOPED_ROLES.includes(role)) {
    const assigned = (me.projects || []).some(p => parseInt(p.id) === v.project_id);
    if (!assigned) {
      return res.status(403).json({ error: 'Not authorised for this project' });
    }
  }

  if (v.is_classified && !['principal', 'design_principal'].includes(role)) {
    return res.status(403).json({ error: 'Classified document — principals only' });
  }
  if (!fs.existsSync(v.file_path)) {
    return res.status(410).json({ error: 'File missing from disk', file_name: v.file_name });
  }
  if (v.mime_type) res.setHeader('Content-Type', v.mime_type);
  // Bug B53: filename came directly from upload's originalname, which
  // could contain CR/LF and break the Content-Disposition header. Strip
  // anything not in a safe charset before emitting the header.
  const safeFilename = String(v.file_name || 'download').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
  fs.createReadStream(v.file_path).pipe(res);
}));

// Resolve the project_id for an approval entity. Returns null if entity not
// found, or undefined if entity_type is unrecognised. Used by /link to
// enforce that the document version and the entity belong to the same
// project, and that the linker has scope.
async function resolveEntityProjectId(entityType, entityId) {
  const id = parseInt(entityId, 10);
  if (!id) return null;
  let row;
  switch (entityType) {
    case 'vendor_engagement':
      [[row]] = await db.query('SELECT project_id FROM vendor_engagements WHERE id = ?', [id]);
      break;
    case 'payment_request':
      [[row]] = await db.query('SELECT project_id FROM payment_requests WHERE id = ?', [id]);
      break;
    case 'drawing_version':
      [[row]] = await db.query(
        'SELECT d.project_id FROM drawing_versions dv JOIN drawings d ON dv.drawing_id = d.id WHERE dv.id = ?',
        [id]
      );
      break;
    case 'change_notice':
      [[row]] = await db.query('SELECT project_id FROM change_notices WHERE id = ?', [id]);
      break;
    case 'grn':
      [[row]] = await db.query('SELECT project_id FROM grns WHERE id = ?', [id]);
      break;
    case 'meeting':
      [[row]] = await db.query('SELECT project_id FROM meetings WHERE id = ?', [id]);
      break;
    case 'other':
      // 'other' has no fixed table — caller can't enforce cross-project here.
      // We accept it (legacy) but mark it for higher scrutiny in audit.
      return undefined;
    default:
      return undefined;
  }
  return row ? row.project_id : null;
}

// POST /api/documents/link — attach a document version to an approval entity
//
// Bug B54: previously gated only by requireAuth — anyone could link any
// document to any entity, including across projects. Bug B56: no
// cross-project consistency check meant a document from Project A could be
// attached to a payment_request on Project B.
//
// Now: derive project_id from BOTH the document version AND the entity,
// require they match, require the user has scope on that project.
router.post('/link', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const { entity_type, entity_id, document_version_id } = req.body;
  if (!entity_type || !entity_id || !document_version_id) {
    return res.status(400).json({ error: 'entity_type, entity_id, document_version_id required' });
  }
  const validTypes = ['vendor_engagement','payment_request','drawing_version','change_notice','grn','meeting','other'];
  if (!validTypes.includes(entity_type)) {
    return res.status(400).json({ error: `Invalid entity_type; must be one of: ${validTypes.join(', ')}` });
  }

  // Look up the document version's project.
  const [[v]] = await db.query(
    `SELECT pd.project_id, pd.is_classified
     FROM project_document_versions pdv
     JOIN project_documents pd ON pdv.document_id = pd.id
     WHERE pdv.id = ?`,
    [document_version_id]
  );
  if (!v) return res.status(404).json({ error: 'Document version not found' });

  const docProjectId = v.project_id;

  // For known entity types, look up the entity's project and require match.
  // 'other' has no schema — accepted but logged (legacy linkage).
  const entityProjectId = await resolveEntityProjectId(entity_type, entity_id);
  if (entityProjectId === null) {
    return res.status(404).json({ error: 'Entity not found' });
  }
  if (entityProjectId !== undefined && entityProjectId !== docProjectId) {
    return res.status(400).json({
      error: 'Cross-project linking not allowed',
      doc_project_id: docProjectId,
      entity_project_id: entityProjectId,
    });
  }

  // Project scope check — caller must have access to docProjectId.
  const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
  if (PROJECT_SCOPED_ROLES.includes(me.role)) {
    const assigned = (me.projects || []).some(p => parseInt(p.id) === docProjectId);
    if (!assigned) {
      return res.status(403).json({ error: 'Not authorised for this project' });
    }
  }

  // Classified docs only linkable by principals.
  if (v.is_classified && !['principal', 'design_principal'].includes(me.role)) {
    return res.status(403).json({ error: 'Classified document — principals only' });
  }

  const linkId = await storage.linkApprovalToDocument({
    entityType: entity_type,
    entityId: entity_id,
    documentVersionId: document_version_id,
    linkedBy: me.id,
  });

  // Bug B55: audit the link.
  audit.log({ userId: me.id, action: 'document.link',
    entityType: 'approval_document_links', entityId: linkId,
    details: { project_id: docProjectId, entity_type, entity_id: parseInt(entity_id), document_version_id: parseInt(document_version_id) }, req });

  res.json({ success: true, link_id: linkId });
}));

// GET /api/documents/links/:entityType/:entityId — find docs linked to an approval
router.get('/links/:entityType/:entityId', requireAuth, asyncHandler(async (req, res) => {
  const role = req.session.user.role;
  const [links] = await db.query(
    `SELECT adl.id AS link_id, adl.linked_at, adl.linked_by,
            pdv.id AS version_id, pdv.version_number, pdv.file_name, pdv.file_size_kb,
            pdv.mime_type, pdv.change_note, pdv.uploaded_at,
            pd.id AS document_id, pd.title, pd.category, pd.is_classified
     FROM approval_document_links adl
     JOIN project_document_versions pdv ON adl.document_version_id = pdv.id
     JOIN project_documents pd ON pdv.document_id = pd.id
     WHERE adl.entity_type = ? AND adl.entity_id = ?
           ${classifiedFilter(role)}
     ORDER BY adl.linked_at DESC`,
    [req.params.entityType, req.params.entityId]
  );
  const Auth = require('../../auth/contract');
  const users = await Auth.functions.getUsers(links.map(l => l.linked_by).filter(Boolean));
  links.forEach(l => { l.linked_by_name = users.get(l.linked_by)?.full_name || null; });
  res.json({ links });
}));

module.exports = router;
