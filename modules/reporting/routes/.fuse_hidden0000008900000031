// routes/gantt.js — Gantt chart data endpoint
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// GET /api/gantt/:project_id — full Gantt data
router.get('/:project_id', requireAuth, asyncHandler(async (req, res) => {
    const pid = req.params.project_id;

    // Get current schedule version
    const [[version]] = await db.query(
      `SELECT * FROM schedule_versions
       WHERE project_id = ? AND is_current = 1`,
      [pid]
    );

    if (!version || !version.id) return res.json({ tasks: [], version: null, project: null, trades: [] });

    // Hydrate project fields used below
    const Onboarding = require('../../onboarding/contract');
    const proj = await Onboarding.functions.getProject(pid);
    version.r0_start_date = proj?.r0_start_date || null;
    version.r0_end_date   = proj?.r0_end_date   || null;
    version.project_name  = proj?.name || null;

    // Get all tasks with latest % complete
    const _tasksResult = await db.query(
      `SELECT
         st.id, st.task_name, st.trade, st.start_date, st.end_date,
         st.depends_on_task_id, st.display_order,
         COALESCE(MAX(tu.pct_complete), 0) AS pct_complete,
         -- Days from project start
         DATEDIFF(st.start_date, ?) AS start_day,
         DATEDIFF(st.end_date, ?) + 1 AS end_day,
         DATEDIFF(st.end_date, st.start_date) + 1 AS duration_days,
         -- Flag if task is overdue (end_date passed, not 100%)
         CASE
           WHEN st.end_date < CURDATE() AND COALESCE(MAX(tu.pct_complete),0) < 100 THEN 1
           ELSE 0
         END AS is_overdue
       FROM schedule_tasks st
       LEFT JOIN task_updates tu ON tu.task_id = st.id
       WHERE st.schedule_version_id = ?
       GROUP BY st.id
       ORDER BY st.trade, st.display_order`,
      [version.r0_start_date, version.r0_start_date, version.id]
    );
    const tasks = Array.isArray(_tasksResult[0]) ? _tasksResult[0] : [];

    // Project timeline in days
    const projectStart   = new Date(version.r0_start_date);
    const projectEnd     = new Date(version.r0_end_date);
    const projectDays    = Math.ceil((projectEnd - projectStart) / 86400000) + 1;
    const today          = new Date();
    const todayDay       = Math.ceil((today - projectStart) / 86400000);

    // Group by trade for trade summary bars
    const trades = {};
    tasks.forEach(t => {
      if (!trades[t.trade]) {
        trades[t.trade] = {
          trade:      t.trade,
          start_day:  t.start_day,
          end_day:    t.end_day,
          task_count: 0,
          done_count: 0,
        };
      }
      const tr = trades[t.trade];
      tr.start_day  = Math.min(tr.start_day, t.start_day);
      tr.end_day    = Math.max(tr.end_day,   t.end_day);
      tr.task_count++;
      if (t.pct_complete === 100) tr.done_count++;
    });

    res.json({
      version,
      project: {
        name:          version.project_name,
        start_date:    version.r0_start_date,
        end_date:      version.r0_end_date,
        total_days:    projectDays,
        today_day:     todayDay,
        drift_days:    version.drift_days,
      },
      tasks,
      trades: Object.values(trades),
    });

  }));

// GET /api/gantt/:project_id/xlsx — download Gantt as Excel
// One sheet per project. Rows = tasks grouped by trade.
// Columns = task name, trade, start date, end date, duration, % complete, status.
// Cells D:E (date range) formatted as dates. Column widths set for readability.
// No formulas needed — pure data export for report embedding and printing.
router.get('/:project_id/xlsx', requireAuth, asyncHandler(async (req, res) => {
  const pid = req.params.project_id;

  const [[version]] = await db.query(
    `SELECT * FROM schedule_versions WHERE project_id = ? AND is_current = 1`,
    [pid]
  );
  if (!version) return res.status(404).json({ error: 'No current schedule found' });

  const Onboarding = require('../../onboarding/contract');
  const proj = await Onboarding.functions.getProject(pid);
  version.r0_start_date = proj?.r0_start_date || null;
  version.project_name  = proj?.name || null;
  const projectCode     = proj?.code || pid;

  const [tasks] = await db.query(
    `SELECT
       st.task_name, st.trade, st.start_date, st.end_date,
       DATEDIFF(st.end_date, st.start_date) + 1 AS duration_days,
       COALESCE(MAX(tu.pct_complete), 0) AS pct_complete,
       CASE
         WHEN st.end_date < CURDATE() AND COALESCE(MAX(tu.pct_complete),0) < 100 THEN 'Overdue'
         WHEN COALESCE(MAX(tu.pct_complete),0) = 100 THEN 'Complete'
         WHEN st.start_date <= CURDATE() THEN 'In Progress'
         ELSE 'Not Started'
       END AS status,
       st.display_order
     FROM schedule_tasks st
     LEFT JOIN task_updates tu ON tu.task_id = st.id
     WHERE st.schedule_version_id = ?
     GROUP BY st.id
     ORDER BY st.trade, st.display_order`,
    [version.id]
  );

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'nu PMC';
  wb.modified = new Date();

  const ws = wb.addWorksheet('Gantt', {
    pageSetup: {
      orientation:  'landscape',
      fitToPage:    true,
      fitToWidth:   1,
      fitToHeight:  0,
      paperSize:    9, // A4
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  });

  // ── Column definitions
  ws.columns = [
    { header: 'Trade',      key: 'trade',         width: 18 },
    { header: 'Task',       key: 'task_name',      width: 38 },
    { header: 'Start',      key: 'start_date',     width: 13 },
    { header: 'End',        key: 'end_date',       width: 13 },
    { header: 'Days',       key: 'duration_days',  width: 8  },
    { header: '% Done',     key: 'pct_complete',   width: 10 },
    { header: 'Status',     key: 'status',         width: 14 },
  ];

  // ── Styles
  const NAVY      = '1D3D62';
  const AMBER     = 'C8A55A';
  const GREEN_BG  = 'D6EFE0';
  const RED_BG    = 'FAD7D4';
  const AMBER_BG  = 'FFF3CD';
  const GRAY_BG   = 'F2F4F7';
  const WHITE     = 'FFFFFF';

  const headerFont  = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${WHITE}` } };
  const titleFont   = { name: 'Arial', size: 14, bold: true, color: { argb: `FF${NAVY}` } };
  const tradeFont   = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${NAVY}` } };
  const bodyFont    = { name: 'Arial', size: 11 };

  // ── Title row
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${version.project_name || projectCode} — Schedule (${version.label || 'R0'})  ·  Exported ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  titleCell.font  = titleFont;
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GRAY_BG}` } };
  titleCell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 28;

  // ── Header row
  const headerRow = ws.getRow(2);
  headerRow.height = 20;
  ws.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font  = headerFont;
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'center' : 'left' };
  });

  // ── Data rows
  let currentTrade = null;
  let rowNum = 3;

  tasks.forEach(task => {
    // Trade separator row when trade changes
    if (task.trade !== currentTrade) {
      currentTrade = task.trade;
      const tradeRow = ws.getRow(rowNum);
      tradeRow.height = 18;
      ws.mergeCells(`A${rowNum}:G${rowNum}`);
      const tc = tradeRow.getCell(1);
      tc.value = task.trade.toUpperCase();
      tc.font  = tradeFont;
      tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
      tc.alignment = { vertical: 'middle', indent: 1 };
      rowNum++;
    }

    const row = ws.getRow(rowNum);
    row.height = 17;

    row.getCell(1).value = task.trade;
    row.getCell(2).value = task.task_name;
    row.getCell(3).value = task.start_date ? new Date(task.start_date) : null;
    row.getCell(4).value = task.end_date   ? new Date(task.end_date)   : null;
    row.getCell(5).value = task.duration_days;
    row.getCell(6).value = task.pct_complete / 100;
    row.getCell(7).value = task.status;

    // Date formatting
    row.getCell(3).numFmt = 'dd-mmm-yy';
    row.getCell(4).numFmt = 'dd-mmm-yy';
    row.getCell(6).numFmt = '0%';

    // Status colour coding
    const statusColor = {
      'Complete':    GREEN_BG,
      'Overdue':     RED_BG,
      'In Progress': AMBER_BG,
      'Not Started': WHITE,
    }[task.status] || WHITE;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font      = bodyFont;
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${statusColor}` } };
      cell.alignment = { vertical: 'middle', horizontal: c >= 3 ? 'center' : 'left', indent: c === 2 ? 2 : 0 };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'FFE2E6EC' } } };
    }

    rowNum++;
  });

  // ── Freeze panes at row 3 (title + header always visible)
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  // ── Stream response
  const filename = `${projectCode}_Gantt_${new Date().toISOString().slice(0,10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}));

module.exports = router;
