// Load workflow_transitions from Sheet 2 with terminal-step fix
process.env.DB_SOCKET   = process.env.DB_SOCKET   || '/run/mysqld/mysqld.sock';
process.env.DB_NAME     = process.env.DB_NAME     || 'nu_pmc';
process.env.DB_USER     = process.env.DB_USER     || 'nu_app';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';

const XLSX = require('../node_modules/xlsx');
const db   = require('../middleware/db');
const fs   = require('fs');

const OBJECT_MAP = {
  'Claims':'claims','Measurements':'measurements','Snags':'snags',
  'Weekly Reports':'weekly_reports','Payment Requests':'payment_requests',
  'Issues':'issues','Change Notices':'change_notices',
  'Drawings':'drawings','Submittals':'submittals',
};

function toSnake(s) {
  return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

async function importWorkflows(conn) {
  const buf = fs.readFileSync('./governance_sheets/02_Workflow_Status_Transitions.xlsx');
  const wb  = XLSX.read(buf, { type: 'buffer' });
  let added = 0, updated = 0, errors = [];

  for (const [sheetName, objectType] of Object.entries(OBJECT_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { errors.push(`Missing sheet: ${sheetName}`); continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const stepRows = [], exRows = [];
    let inEx = false;

    for (let i = 8; i < rows.length; i++) {
      const row = rows[i];
      const stepMark  = String(row[0] || '').trim();
      const fromState = String(row[2] || '').trim();   // col C — technical state
      const who       = String(row[3] || '').trim();   // col D — who acts
      const what      = String(row[4] || '').trim();   // col E — what they do
      const colF      = String(row[5] || '').trim();   // col F — moves to (plain English)

      if (stepMark.toLowerCase().includes('exception')) { inEx = true; continue; }
      if (!fromState || fromState === 'Technical state' ||
          fromState === 'Technical name (for reference)') continue;
      if (!who) continue;

      if (!inEx) {
        // Store row alongside so terminal step can read col F
        stepRows.push({ i, fromState, who, what, colF });
      } else {
        // Exception: col F holds the to_state (already technical in our exception table)
        const toState = toSnake(colF);
        if (toState) exRows.push({ i, fromState, toState, who, what });
      }
    }

    // Happy-path steps: to_state = next step's col C
    // Terminal step: to_state = this step's col F → snake_case
    for (let si = 0; si < stepRows.length; si++) {
      const { i, fromState, who, what, colF } = stepRows[si];
      const toState = si + 1 < stepRows.length
        ? stepRows[si + 1].fromState   // next row's technical state
        : toSnake(colF);               // terminal: col F → snake_case

      if (!toState) { errors.push(`${sheetName} step ${si+1}: cannot derive to_state`); continue; }

      try {
        const [r] = await conn.query(
          `INSERT INTO workflow_transitions
             (object_type, from_state, to_state, roles_who, label, is_exception, sort_order)
           VALUES (?,?,?,?,?,0,?)
           ON DUPLICATE KEY UPDATE
             roles_who=VALUES(roles_who), label=VALUES(label), is_exception=0`,
          [objectType, fromState, toState, who, what || who, si + 1]
        );
        if (r.affectedRows === 1) added++; else updated++;
      } catch (e) {
        errors.push(`${sheetName} step ${si+1} (${fromState}→${toState}): ${e.message}`);
      }
    }

    // Exception rows
    for (const { i, fromState, toState, who, what } of exRows) {
      try {
        const [r] = await conn.query(
          `INSERT INTO workflow_transitions
             (object_type, from_state, to_state, roles_who, label, is_exception, sort_order)
           VALUES (?,?,?,?,?,1,?)
           ON DUPLICATE KEY UPDATE
             roles_who=VALUES(roles_who), label=VALUES(label), is_exception=1`,
          [objectType, fromState, toState, who, what || who, i]
        );
        if (r.affectedRows === 1) added++; else updated++;
      } catch (e) {
        errors.push(`${sheetName} exception (${fromState}→${toState}): ${e.message}`);
      }
    }
  }
  return { added, updated, errors };
}

async function main() {
  console.log('Loading workflow_transitions from Sheet 2...\n');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { added, updated, errors } = await importWorkflows(conn);
    console.log(`added: ${added}  updated: ${updated}  errors: ${errors.length}`);
    if (errors.length) {
      errors.forEach(e => console.log('  ERR:', e));
      await conn.rollback();
      process.exit(1);
    }
    await conn.commit();
    console.log('✓ Committed');
  } catch (e) {
    await conn.rollback();
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    conn.release();
  }

  // ── Verify ──────────────────────────────────────────────────────────────
  console.log('\n=== Verification ===');

  const objects = ['claims','measurements','snags','weekly_reports','payment_requests',
                   'issues','change_notices','drawings','submittals'];
  let allOk = true;

  // Expected happy-path step counts per object (verified from sheets)
  const expectedSteps = {
    claims: { happy: 4, ex: 0,
      chain: ['draft','pmc_signed','stream_signed','approved','invoiced'] },
    measurements: { happy: 2, ex: 0,
      chain: ['draft','rs_signed','client_accepted'] },
    snags: { happy: 2, ex: 1,
      chain: ['open','rectified','closed'] },
    weekly_reports: { happy: 3, ex: 0,
      chain: ['draft','pending_review','approved','sent'] },
    payment_requests: { happy: 4, ex: 2,
      chain: ['pending_pmc','pmc_approved','pending_principal','principal_approved','paid'] },
    issues: { happy: 3, ex: 1,
      chain: ['open','in_progress','resolved','closed'] },
    change_notices: { happy: 2, ex: 1,
      chain: ['draft','pending_approval','approved'] },
    drawings: { happy: 2, ex: 2,
      chain: ['uploaded','under_review','issued'] },
    submittals: { happy: 2, ex: 3,
      chain: ['submitted','under_review','approved'] },
  };

  for (const obj of objects) {
    const [rows] = await db.query(
      `SELECT from_state, to_state, is_exception FROM workflow_transitions
       WHERE object_type=? ORDER BY is_exception, sort_order`, [obj]
    );
    const happy = rows.filter(r => !r.is_exception);
    const ex    = rows.filter(r =>  r.is_exception);
    const exp   = expectedSteps[obj];

    // Check happy-path chain
    const chain = [happy[0]?.from_state, ...happy.map(r => r.to_state)];
    const chainOk = exp.chain.every((s, i) => chain[i] === s);

    const ok = happy.length === exp.happy && ex.length === exp.ex && chainOk;
    const icon = ok ? '✓' : '✗';
    console.log(`${icon} ${obj.padEnd(20)} happy:${happy.length}/${exp.happy}  ex:${ex.length}/${exp.ex}  chain:${chainOk?'OK':'WRONG'}`);
    if (!ok) {
      console.log(`  got chain: ${chain.join(' → ')}`);
      console.log(`  expected:  ${exp.chain.join(' → ')}`);
      allOk = false;
    }
  }

  console.log('\n' + '='.repeat(40));
  console.log(allOk ? '✓ ALL WORKFLOW CHECKS PASSED' : '✗ WORKFLOW CHECKS FAILED');
  await db.end().catch(() => {});
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
