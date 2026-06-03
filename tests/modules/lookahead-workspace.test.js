const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');

async function run() {
  reset();
  const { projectId } = readState();
  const agent = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');

  // Verify lookahead workspace endpoint GET
  await test('GET lookahead workspace returns data', async () => {
    const res = await agent.get(`/schedule/${projectId}/lookahead/workspace`);
    is(res.status, 200, 'Workspace GET status is 200');
    has(res.body, 'metrics', 'has metrics');
    has(res.body, 'tasks', 'has tasks');
    has(res.body, 'assignees', 'has assignees');
  });

  // Verify task scheduling POST
  await test('POST create task schedules a planning task', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const res = await agent.post(`/schedule/${projectId}/tasks`, {
      task_name: 'Ad-hoc Planning Task',
      description: 'Scheduled from Look Ahead workspace test',
      planned_date: today,
      priority: 'high',
      trade: 'Civil'
    });
    is(res.status, 200, 'Task creation POST status is 200');
    is(res.body.success, true, 'creation returns success=true');
    has(res.body, 'task_id', 'returns task_id');

    // Retrieve and verify task insertion
    const check = await agent.get(`/schedule/${projectId}/lookahead/workspace`);
    const createdTask = check.body.tasks.find(t => t.id === res.body.task_id);
    const { assert } = require('./helpers');
    assert.ok(createdTask, 'Task was successfully added to list');
    is(createdTask.task_name, 'Ad-hoc Planning Task', 'Task name matches');
    is(createdTask.priority, 'high', 'Priority matches');
    is(createdTask.trade, 'Civil', 'Trade matches');
  });

  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
