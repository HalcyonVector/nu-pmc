// scripts/build-weekly-pdf.js
// ===========================================================
// Generates the client-facing PDF for an approved weekly report.
// Uses PDFKit so we can render on the server without a headless
// browser. Keeps it simple, branded, scannable on laptop/print.
//
// Note: this is the minimum-viable builder. nu associates
// letterhead, signature blocks, and richer layout can be added by
// Guru once he's got the plumbing working in production.
// ===========================================================

const db  = require('../middleware/db');
const fs  = require('fs');
const path= require('path');

let PDFDocument;
try { PDFDocument = require('pdfkit'); }
catch (_e) { PDFDocument = null; }  // Graceful fallback — logged in buildForReport

const NAVY = '#1a2e44';
const GOLD = '#c8a55a';
const DARK = '#1a1a1a';

async function buildForReport(reportId) {
  if (!PDFDocument) {
    console.warn('[PDF] pdfkit not installed — run: npm install pdfkit');
    return null;
  }

  // Load data
  const [[report]] = await db.query(
    `SELECT wr.*, p.name AS project_name, p.code AS project_code, p.client
     FROM weekly_reports wr JOIN projects p ON wr.project_id = p.id
     WHERE wr.id = ?`,
    [reportId]
  );
  if (!report) throw new Error('Report not found');

  const [photos] = await db.query(
    `SELECT pp.file_path, pt.caption, st.task_name
     FROM weekly_report_photos wrp
     JOIN project_photos pp ON wrp.photo_id = pp.id
     LEFT JOIN photo_tags pt ON pp.id = pt.photo_id AND pt.is_current = 1
     LEFT JOIN schedule_tasks st ON pt.task_id = st.id
     WHERE wrp.weekly_report_id = ? LIMIT 20`,
    [reportId]
  );

  // Output path
  const outDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
  const pdfDir = path.join(outDir, 'weekly-reports-pdf');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  const outPath = path.join(pdfDir, `${report.project_code}_week_${report.week_number}_${report.week_ending}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `Weekly Report — ${report.project_name} — Week ${report.week_number}`,
    Author: 'nu associates',
  }});
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // Header
  doc.font('Helvetica-Bold').fontSize(24).fillColor(NAVY).text('nu associates', 50, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#888').text('NU ASSOCIATES LLP', 50, 78);

  doc.rect(50, 100, 495, 2).fill(GOLD);

  doc.font('Helvetica-Bold').fontSize(18).fillColor(DARK).text(`${report.project_name}`, 50, 120);
  doc.font('Helvetica').fontSize(11).fillColor('#666').text(`Client: ${report.client || '—'}`, 50, 144);
  doc.font('Helvetica').fontSize(11).fillColor('#666').text(`Week ${report.week_number} · ending ${report.week_ending}`, 50, 160);

  let y = 200;

  const section = (title, content) => {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(title.toUpperCase(), 50, y, { characterSpacing: 1.2 });
    y += 20;
    doc.font('Helvetica').fontSize(10).fillColor(DARK).text(content || '—', 50, y, { width: 495, align: 'left' });
    y = doc.y + 20;
  };

  section('Project Summary',  report.summary || '');
  section('PMC — Site Progress', report.pmc_section || '');
  section('Design Update',       report.design_section || '');
  section('Services Update',     report.services_section || '');
  section('Issues for Client',   report.issues_for_client || '');

  // Photos page(s)
  if (photos.length) {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('SITE PHOTOS', 50, 50, { characterSpacing: 1.2 });
    let px = 50, py = 80;
    const tileW = 240, tileH = 180;

    for (const ph of photos.slice(0, 12)) {
      try {
        if (fs.existsSync(ph.file_path)) {
          doc.image(ph.file_path, px, py, { fit: [tileW, tileH], align: 'center', valign: 'center' });
          doc.font('Helvetica').fontSize(8).fillColor('#666').text(
            (ph.caption || ph.task_name || '').slice(0, 80),
            px, py + tileH + 4, { width: tileW }
          );
        }
      } catch (_e) {}

      if (px === 50) { px = 50 + tileW + 15; }
      else {
        px = 50;
        py += tileH + 30;
        if (py > 730) { doc.addPage(); py = 50; }
      }
    }
  }

  // Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#888')
      .text(`nu associates  ·  ${report.project_name}  ·  Week ${report.week_number}  ·  Page ${i+1} of ${range.count}`,
            50, 810, { width: 495, align: 'center' });
  }

  doc.end();

  // Wait for stream close
  await new Promise(resolve => stream.on('finish', resolve));

  await db.query('UPDATE weekly_reports SET pdf_path = ? WHERE id = ?', [outPath, reportId]);
  return outPath;
}

module.exports = { buildForReport };

// CLI usage — node scripts/build-weekly-pdf.js 42
if (require.main === module) {
  const id = parseInt(process.argv[2] || '0');
  if (!id) { console.error('Usage: node build-weekly-pdf.js <report_id>'); process.exit(1); }
  buildForReport(id).then(p => { console.log('PDF written:', p); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
