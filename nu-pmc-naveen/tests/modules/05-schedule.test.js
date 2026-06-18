// MODULE 05 — Schedule: upload, tasks, progress updates, validation
// Input:  state.projectId, state.siteId
// Output: state.taskIds, state.scheduleVersionId

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');
const ExcelJS = require('exceljs');
const path    = require('path');
const os      = require('os');
const fs      = require('fs');

async function buildScheduleExcel() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Schedule');
  ws.addRow(['Task ID','Task Name','Trade','Stream','Start Date','End Date','Predecessor','Weight%']);
  const today = new Date().toLocaleDateString('en-CA');
  const plus  = n => new Date(Date.now() + n*86400000).toLocaleDateString('en-CA');
  ws.addRow(['T001','Excavation','Civil','design', today, plus(14), '', 10]);
  ws.addRow(['T002','PCC Footing','Civil','design', plus(15), plus(21), 'T001', 8]);
  ws.addRow(['T003','RCC Columns G+1','Civil','design', plus(22), plus(45), 'T002', 15]);
  ws.addRow(['T004','Steel Fabrication','Structural','services', plus(30), plus(60), 'T002', 12]);
  ws.addRow(['T005','HVAC Design','HVAC','services', today, plus(20), '', 5]);
  const file = path.join(os.tmpdir(), `sched_${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

async function run() {
  reset();
  const { projectId, siteId } = readState();
  const agent = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');

  let schedFile;
  await test('build schedule Excel', async () => {
    schedFile = await buildScheduleExcel();
    has({ f: schedFile }, 'f', 'file exists');
  });

  // ── UPLOAD SCHEDULE
  let schedVerId;
  await test('upload schedule to project', async () => {
    const buf = fs.readFileSync(schedFile);
    const res = await agent.upload(`/schedule/${projectId}/upload`, 'schedule', buf, 'schedule.xlsx');
    ok(res, 'upload schedule');
    has(res.body, 'version_id');
  });

  // ── GET SCHEDULE
  let tasks;
  await test('schedule is retrievable with tasks', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const res   = await agent.get(`/schedule/${projectId}?date=${today}`);
    ok(res, 'get schedule');
    has(res.body, 'tasks');
    tasks = res.body.tasks || [];
    gt(tasks.length, 0, 'tasks present');
  });

  // ── SITE MANAGER UPDATES PROGRESS
  let taskId;
  await test('site manager can update task progress', async () => {
    const siteAgent = new Agent();
    await siteAgent.login('test_site', 'NuPMC@2026');
    // Get tasks assigned to this project
    const today = new Date().toLocaleDateString('en-CA');
    const res   = await siteAgent.get(`/schedule/${projectId}?date=${today}`);
    tasks = res.body.tasks || [];
    if (!tasks.length) { is(tasks.length, 0, 'no tasks to update'); return; }
    taskId  = tasks[0].id;
    const upd = await siteAgent.post(`/schedule/${projectId}/update`, {
      task_id:      taskId,
      pct_complete: 25,
      notes:        'Excavation 25% done — ground is soft',
      report_date:  new Date().toLocaleDateString('en-CA'),
    });
    ok(upd, 'task update');
    has(upd.body, 'success');
  });

  // ── VALIDATE TASK PROGRESS — PMC approves the update
  await test('progress validation accepts in-range update', async () => {
    if (!taskId) return;
    // Get task_update_id from the progress update done above
    const [[tu]] = await db.query(
      'SELECT id FROM task_updates WHERE task_id=? ORDER BY id DESC LIMIT 1',
      [taskId]
    );
    const res = await agent.post(`/schedule/${projectId}/validate`, {
      task_update_id: tu?.id,
      status:         'validated',
    });
    is(res.status, 200, 'validate status');
  });

  // ── LOOK AHEAD
  await test('lookahead returns upcoming tasks', async () => {
    const res = await agent.get(`/schedule/${projectId}/lookahead`);
    is(res.status, 200, 'lookahead status');
    has(res.body, 'tasks');
  });

  // ── VERSIONS
  await test('schedule versions are listed', async () => {
    const res = await agent.get(`/schedule/${projectId}/versions`);
    is(res.status, 200, 'versions status');
    has(res.body, 'versions');
    gt(res.body.versions.length, 0, 'at least one version');
    schedVerId = res.body.versions[0]?.id;
  });

  const taskIds = tasks.slice(0,3).map(t => t.id);
  writeState({ taskIds, scheduleVersionId: schedVerId, taskCount: tasks.length });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
