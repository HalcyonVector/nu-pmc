const fs = require('fs');
const path = require('path');

describe('server route ordering', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  test('/api/files handler is registered before SPA catch-all', () => {
    const fileRoute = src.indexOf("app.get('/api/files/:subdir/:filename'");
    const spaCatchAll = src.indexOf("app.get('*'");

    expect(fileRoute).toBeGreaterThan(-1);
    expect(spaCatchAll).toBeGreaterThan(-1);
    expect(fileRoute).toBeLessThan(spaCatchAll);
  });

  test('SPA catch-all still serves non-API frontend routes only', () => {
    expect(src).toContain("!req.path.startsWith('/api')");
    expect(src).toContain("res.sendFile(path.join(__dirname, 'public', 'index.html'))");
  });
});
