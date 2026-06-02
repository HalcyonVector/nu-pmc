// modules/readiness-gate/service.js
// ═══════════════════════════════════════════════════════════════════════════
// Readiness gate — encapsulates the "can this project go active?" check.
//
// Before: 7 checklist columns checked inline in projects.js with an AND chain.
// Now: one function, one source of truth, machine-readable output.
// Change the set of blockers here and every caller updates.
// ═══════════════════════════════════════════════════════════════════════════
const db = require('../../middleware/db');

// Each blocker maps to (a) the DB column that must be 1 and (b) a
// human-readable label shown in error messages / UI.
// Keeping this as data — not a chain of if-statements — so tests enumerate it,
// and so adding a new blocker later is one line.
const BLOCKERS = [
  { key: 'project_created',   column: 'checklist_project_created',   label: 'Project record created' },
  { key: 'design_register',   column: 'checklist_design_register',   label: 'Design drawing register signed off' },
  { key: 'services_register', column: 'checklist_services_register', label: 'Services drawing register signed off' },
  { key: 'design_boq',        column: 'checklist_design_boq',        label: 'Design BOQ uploaded' },
  { key: 'services_boq',      column: 'checklist_services_boq',      label: 'Services BOQ uploaded' },
  { key: 'schedule',          column: 'checklist_schedule',          label: 'R0 schedule uploaded and approved' },
  { key: 'site_manager',      column: 'checklist_site_manager',      label: 'Site manager assigned' },
];

/**
 * Check readiness of one project.
 *
 * @param {number} projectId
 * @returns {Promise<{
 *   projectId: number,
 *   status: string,
 *   ready: boolean,
 *   blockers: Array<{key:string,label:string}>,
 *   completed: Array<{key:string,label:string}>
 * }>}
 */
async function checkReadiness(projectId) {
  const cols = BLOCKERS.map(b => b.column).join(', ');
  const [rows] = await db.query(
    `SELECT id, status, ${cols} FROM projects WHERE id = ?`,
    [projectId]
  );
  if (rows.length === 0) {
    throw new Error(`Project ${projectId} not found`);
  }
  const p = rows[0];

  const blockers = [];
  const completed = [];
  for (const b of BLOCKERS) {
    (Number(p[b.column]) === 1 ? completed : blockers).push({
      key: b.key,
      label: b.label,
    });
  }

  return {
    projectId: Number(p.id),
    status: p.status,
    ready: blockers.length === 0,
    blockers,
    completed,
  };
}

/**
 * Throw a 409 if the project is not ready. Callers can wrap in try/catch
 * or let asyncHandler pass it to the error handler.
 * The error carries {statusCode: 409, blockers: [...]} so the HTTP layer
 * can return a proper payload.
 */
async function assertReady(projectId) {
  const r = await checkReadiness(projectId);
  if (!r.ready) {
    const err = new Error(
      `Project ${projectId} is not ready to activate. ${r.blockers.length} blocker(s): ` +
      r.blockers.map(b => b.label).join('; ')
    );
    err.statusCode = 409;
    err.blockers = r.blockers;
    err.projectId = projectId;
    throw err;
  }
  return r;
}

/**
 * Combined activate helper: if ready, flip status to 'active'.
 * Idempotent — safe to call on an already-active project.
 * Returns the readiness summary either way.
 */
async function activateIfReady(projectId) {
  const r = await checkReadiness(projectId);
  if (r.ready && r.status === 'initialising') {
    const sm = require('../../services/state-machines').project;
    await sm.transition({
      id: projectId, from: 'initialising', to: 'active',
    });
    r.status = 'active';
    r.justActivated = true;
  } else {
    r.justActivated = false;
  }
  return r;
}

module.exports = {
  BLOCKERS,
  checkReadiness,
  assertReady,
  activateIfReady,
};
