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
});
