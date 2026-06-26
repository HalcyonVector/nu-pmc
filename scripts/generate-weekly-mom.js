// generate-weekly-mom.js
// Called by the app when Principal/Design Principal approves a weekly report
// Produces a MOM PDF matching nu associates format
// Usage: node generate-weekly-mom.js <report_id>

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql   = require('mysql2/promise');
const path    = require('path');
const fs      = require('fs');
const { execSync } = require('child_process');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

async function generateWeeklyMOM(reportId) {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'nu_pmc',
    user: process.env.DB_USER || 'nu_app',
    password: process.env.DB_PASS || '',
  });

  // Get report data
  const [[report]] = await db.execute(
    `SELECT wr.*, p.name AS project_name, p.client, p.location, p.code,
       u.full_name AS drafted_by_name, a.full_name AS approved_by_name
     FROM weekly_reports wr
     JOIN projects p ON wr.project_id = p.id
     LEFT JOIN users u ON wr.drafted_by = u.id
     LEFT JOIN users a ON wr.approved_by = a.id
     WHERE wr.id = ?`,
    [reportId]
  );

  if (!report) throw new Error(`Report ${reportId} not found`);

  // Get MOM items for this report (open + newly closed)
  const [items] = await db.execute(
    `SELECT * FROM mom_items
     WHERE project_id = ? AND (status = 'open' OR (status = 'closed' AND updated_at >= ?))
     ORDER BY status ASC, created_at ASC`,
    [report.project_id, report.created_at]
  );

  // Get site visit participants this week
  const [visitors] = await db.execute(
    `SELECT DISTINCT u.full_name, u.role FROM meetings sv
     JOIN users u ON sv.visitor_id = u.id
     WHERE sv.project_id = ? AND sv.visit_date >= ?`,
    [report.project_id, report.week_ending]
  );

  // Build data object for Python generator
  const data = {
    mom_number: report.week_number,
    client:     report.client,
    project:    `${report.project_name} — Week ${report.week_number} Progress Report`,
    location:   report.location,
    date:       new Date(report.week_ending).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }),
    participants: [
      ...visitors.map(v => ({ name: v.full_name, company: 'NU Associates LLP' })),
      { name: report.approved_by_name || 'Principal', company: 'nu associates — Principal' },
    ],
    items: items.map((item, i) => ({
      sl:          i + 1,
      description: item.description,
      responsible: item.responsible,
      remarks:     item.status === 'closed'
                     ? `CLOSED — ${item.resolution_note}`
                     : item.remarks || '',
      status:      item.status === 'closed' ? 'Closed' : 'Open',
    })),
  };

  // Write data to temp JSON
  const tmpJson = path.join(UPLOAD_DIR, `mom_data_${reportId}.json`);
  fs.writeFileSync(tmpJson, JSON.stringify(data));

  // Call Python generator
  const outPdf = path.join(UPLOAD_DIR, `weekly-reports/MOM_Week${report.week_number}_${report.code}.pdf`);
  const outDir = path.dirname(outPdf);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const pyScript = path.join(__dirname, 'mom_pdf.py');
  execSync(`python3 "${pyScript}" "${tmpJson}" "${outPdf}"`);
  fs.unlinkSync(tmpJson);

  // Update report with PDF path
  await db.execute(
    'UPDATE weekly_reports SET pdf_path = ? WHERE id = ?',
    [outPdf, reportId]
  );

  await db.end();
  console.log(`✓ Weekly MOM PDF: ${outPdf}`);
  return outPdf;
}

const reportId = process.argv[2];
if (!reportId) { console.error('Usage: node generate-weekly-mom.js <report_id>'); process.exit(1); }
generateWeeklyMOM(parseInt(reportId, 10)).catch(err => { console.error(err); process.exit(1); });
