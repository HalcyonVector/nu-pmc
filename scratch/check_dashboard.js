const path = require('path');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const db = require(path.join(process.cwd(), 'middleware/db'));
(async () => {
  const projectId = 1;
  const today = '2026-06-05';

  const [[version]] = await db.query(
    'SELECT * FROM schedule_versions WHERE project_id = ? AND is_current = 1',
    [projectId]
  );
  console.log('Version:', version);

  if (version) {
    const [tasks] = await db.query(
      'SELECT COUNT(*) AS c FROM schedule_tasks WHERE schedule_version_id = ?',
      [version.id]
    );
    console.log('Total tasks in current version:', tasks[0].c);

    const [activeTasks] = await db.query(
      `SELECT COUNT(*) AS c
       FROM schedule_tasks st
       LEFT JOIN (
         SELECT tu1.task_id, tu1.pct_complete
         FROM task_updates tu1
         INNER JOIN (
           SELECT task_id, MAX(report_date) AS max_date
           FROM task_updates
           GROUP BY task_id
         ) tu2 ON tu1.task_id = tu2.task_id AND tu1.report_date = tu2.max_date
       ) tu ON tu.task_id = st.id
       WHERE st.schedule_version_id = ? AND st.start_date <= ? AND COALESCE(tu.pct_complete, 0) < 100`,
      [version.id, today]
    );
    console.log('Active tasks calculated:', activeTasks[0].c);
  }

  const [issues] = await db.query(
    "SELECT COUNT(*) AS c FROM issues WHERE project_id=? AND status IN ('open','in_progress')",
    [projectId]
  );
  console.log('Open issues count:', issues[0].c);

  const [grns] = await db.query(
    "SELECT COUNT(*) AS c FROM grns WHERE project_id=? AND status='pending'",
    [projectId]
  );
  console.log('Pending GRNs count:', grns[0].c);

  process.exit(0);
})().catch(console.error);
