require('dotenv').config();
const db = require('./middleware/db');

async function main() {
  // Check 1: roles with nav but no test user
  const [navRoles] = await db.query('SELECT DISTINCT role FROM role_nav WHERE is_visible=1');
  const [users] = await db.query('SELECT DISTINCT role FROM users');
  const navSet = new Set(navRoles.map(r => r.role));
  const userSet = new Set(users.map(r => r.role));
  const noUser = [...navSet].filter(r => !userSet.has(r));
  console.log('Roles with nav but no user:', noUser.length ? noUser : 'None — all good ✅');

  // Check 2: project-scoped users with no assignment
  const projectScopedRoles = ['site_manager','senior_site_manager','team_lead','detailing_head',
    'jr_architect','services_engineer','coordinator','detailing','trainee'];
  const [unassigned] = await db.query(
    `SELECT u.username, u.role FROM users u
     WHERE u.role IN (${projectScopedRoles.map(() => '?').join(',')})
     AND u.id NOT IN (SELECT DISTINCT user_id FROM project_assignments WHERE is_active=1)`,
    projectScopedRoles
  );
  console.log('Project-scoped users with no assignment:', unassigned.length ? unassigned : 'None — all good ✅');

  // Check 3: active projects count
  const [[{ cnt }]] = await db.query('SELECT COUNT(*) as cnt FROM projects WHERE status=?', ['active']);
  console.log('Active projects:', cnt);

  // Check 4: users with no role
  const [badUsers] = await db.query('SELECT id, username FROM users WHERE role IS NULL OR role = ""');
  console.log('Users with no role:', badUsers.length ? badUsers : 'None — all good ✅');

  // Check 5: nav config — any role missing a dashboard tab?
  const [noDash] = await db.query(
    `SELECT DISTINCT role FROM role_nav
     WHERE is_visible=1
     AND role NOT IN (SELECT role FROM role_nav WHERE tab_key='dashboard' AND is_visible=1)
     AND role NOT IN ('detailing','trainee','it_admin')`
  );
  console.log('Roles with nav but no dashboard tab (unexpected):', noDash.length ? noDash : 'None — all good ✅');

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
