const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('uploaded file URL source discipline', () => {
  test('GRN route uses shared helper instead of /api/files basename links', () => {
    const src = read('modules/site/routes/grn.js');
    expect(src).toContain("require('../../../services/file-url')");
    expect(src).toContain('fileUrls.fileUrl(deliveryNotePath, { absolute: true })');
    expect(src).not.toMatch(/APP_BASE_URL.*\/api\/files\/.*basename/);
  });

  test('drawing view route uses shared helper for view_url', () => {
    const src = read('modules/design-services/routes/drawings.js');
    expect(src).toContain("require('../../../services/file-url')");
    expect(src).toContain("view_url:       fileUrls.fileUrl(dv.file_path, { defaultSubdir: 'drawings' })");
    expect(src).not.toMatch(/view_url:\s*`\/api\/files\/drawings\/\$\{/);
  });

  test('frontend upload renderers go through API.fileUrl', () => {
    const src = read('public/js/app.js');
    expect(src).not.toMatch(/replace\(\/^.*uploads/);
    expect(src).not.toMatch(/src="\/\$\{[^}]*file_path/);
    expect(src).not.toMatch(/href="\/\$\{[^}]*file_path/);
    expect(src).toContain('API.fileUrl(rep.pdf_url || rep.pdf_path');
    expect(src).toContain('API.fileUrl(p.file_url || p.file_path');
  });

  test('handover checklist route applies fileUrl() before sending to client', () => {
    const src = read('modules/site/routes/handover.js');
    // Must import the shared helper
    expect(src).toContain("require('../../../services/file-url')");
    // Must convert file_path → file_url for each item
    expect(src).toContain("item.file_url = fileUrls.fileUrl(item.file_path");
    // Must not send raw file_path to the client
    expect(src).toContain('delete item.file_path');
    // Must not hard-code /api/files/ inline (use the helper)
    expect(src).not.toMatch(/file_url\s*=\s*`\/api\/files\//);
  });

  test('issues RFI list converts drawing_file via fileUrl(), not raw file_path', () => {
    const src = read('modules/site/routes/issues.js');
    // Must import the shared helper
    expect(src).toContain("require('../../../services/file-url')");
    // drawing_file must go through the helper
    expect(src).toContain('drawing_file   = fileUrls.fileUrl(c?.file_path');
    // Must not assign raw c?.file_path directly
    expect(src).not.toMatch(/drawing_file\s*=\s*c\?\.[^\n]*file_path[^)]/);
  });

  test('server.js SPA catch-all does not exempt /uploads path', () => {
    const src = read('server.js');
    // The old guard must be gone — /uploads is never served statically
    expect(src).not.toContain("req.path.startsWith('/uploads')");
    // The explanatory comment must be present so the intent is clear
    expect(src).toContain('/uploads/ is intentionally NOT served statically');
  });

  test('no route file returns raw file_path as a top-level response field', () => {
    // Heuristic: catch res.json({ ..., file_path }) patterns that would
    // send a raw disk path to the client without going through fileUrls.fileUrl().
    // Only INSERT/UPDATE statements and internal server-to-server helpers are
    // allowed to hold the raw path. Add per-file cases above for nuance.
    const routeDirs = [
      'modules/site/routes',
      'modules/design-services/routes',
      'modules/reporting/routes',
      'modules/finance/routes',
      'modules/onboarding/routes',
    ];
    const forbidden = /res\.json\([^)]*\bfile_path\b/;
    for (const dir of routeDirs) {
      const fullDir = path.join(__dirname, '..', dir);
      if (!fs.existsSync(fullDir)) continue;
      for (const f of fs.readdirSync(fullDir).filter(n => n.endsWith('.js'))) {
        if (dir === 'modules/design-services/routes' && f === 'drawings.js') continue;
        if (dir === 'modules/finance/routes' && f === 'payments.js') continue;
        const src = fs.readFileSync(path.join(fullDir, f), 'utf8');
        if (forbidden.test(src)) {
          expect(`${dir}/${f}: contains res.json with raw file_path`).toBe('clean');
        }
      }
    }
  });
});
