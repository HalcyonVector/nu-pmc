// Verify single-boss architecture: all legacy actions now in DB, no fallback exists
process.env.DB_SOCKET='/run/mysqld/mysqld.sock';
process.env.DB_NAME='nu_pmc';
process.env.DB_USER='nu_app';
process.env.DB_PASSWORD='';

const db    = require('../middleware/db');
const perms = require('../middleware/permissions');

async function main() {
  console.log('=== Single-boss verification ===\n');

  // Force reload
  const r = await perms.reloadPermissions();
  console.log(`Reload: ${r.rules} rules covering ${r.actions} unique actions`);
  console.log(`Source: ${perms.getStatus().source}\n`);

  // The 18 legacy actions that were previously hardcoded — must now resolve via DB
  const LEGACY_ACTIONS = [
    ['users.bulk_upload',     ['principal','design_principal','finance_admin']],
    ['users.deactivate',      ['principal','design_principal']],
    ['users.reset_pw',        null],   // covered by 'Reset another user's password' in Governance
    ['clients.create',        ['principal','design_principal','finance_admin']],
    ['clients.edit',          ['principal','design_principal','finance_admin']],
    ['clients.bulk_upload',   ['principal','design_principal','finance_admin']],
    ['vendors.create',        null],   // covered by 'Create vendor master entry' in Admin (different label)
    ['vendors.bulk_upload',   ['principal','design_principal','pmc_head']],
    ['vendors.engage',        ['principal','design_principal','pmc_head']],
    ['projects.create',       ['principal','design_principal']],
    ['projects.edit',         ['principal','design_principal']],
    ['invoices.raise',        ['principal','design_principal','finance_admin']],
    ['payments.execute',      ['principal','design_principal','finance_admin']],
    ['gst.view',              ['principal','design_principal','finance_admin']],   // R access but can() still true
    ['boq.upload',            ['principal','design_principal','design_head','team_lead','services_head']],
    ['boq.map',               ['principal','design_principal','pmc_head']],
    ['budget.approve',        ['principal','design_principal']],
    ['mom.issue',             ['principal','design_principal','pmc_head']],
    ['mom.sign',              ['principal','design_principal','pmc_head']],
    ['reports.approve',       ['principal','design_principal','pmc_head','senior_site_manager']],
  ];

  const ALL_ROLES = ['principal','design_principal','pmc_head','design_head','services_head',
    'team_lead','jr_architect','detailing','site_manager','senior_site_manager',
    'finance_admin','coordinator','trainee','audit','it_admin'];

  let pass = 0, fail = 0;

  for (const [action, expectedRoles] of LEGACY_ACTIONS) {
    if (expectedRoles === null) {
      // Not directly covered; skip — already represented under a different label in sheet
      continue;
    }

    // Is action in DB at all?
    if (!perms.actionIsCovered(action)) {
      console.log(`  ✗ ${action} — NOT IN DB`);
      fail++;
      continue;
    }

    // Check every role
    for (const role of ALL_ROLES) {
      const shouldHave = expectedRoles.includes(role);
      const got = await perms.can(role, action);
      if (shouldHave === got) pass++;
      else {
        console.log(`  ✗ ${action} / ${role}  got:${got} expected:${shouldHave}`);
        fail++;
      }
    }
  }

  // Also check an action that does NOT exist — must deny (no legacy fallback)
  const phantomResult = await perms.can('principal', 'nonexistent.action');
  if (phantomResult === false) pass++;
  else { console.log('  ✗ nonexistent.action should deny but got:', phantomResult); fail++; }

  console.log(`\n${pass} passed  ${fail} failed`);
  console.log(fail === 0 ? '✓ SINGLE-BOSS VERIFIED' : '✗ FAILURES');

  await db.end().catch(()=>{});
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
