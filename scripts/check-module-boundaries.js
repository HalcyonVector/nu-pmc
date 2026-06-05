// scripts/check-module-boundaries.js
// ═══════════════════════════════════════════════════════════════════════════
// MODULE BOUNDARY LINT
// ═══════════════════════════════════════════════════════════════════════════
// Enforces: code OUTSIDE /modules/<name>/ may only import from
//   - /modules/<name>/contract.js
//   - /modules/<name>/index.js (if present)
// ...NOT from /modules/<name>/routes/, /middleware/, /services/, etc.
//
// Code INSIDE /modules/<name>/ may freely use its own sub-directories.
//
// server.js is allowed to mount `require('./modules/<name>/routes/<file>')`
// during the migration phase. Once everyone is on contract-mount, we'll
// tighten this.
//
// Usage:
//   node scripts/check-module-boundaries.js
// Exits 0 if clean, 1 with a list of violations if not.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT, 'modules');

// Whitelist exceptions are restricted using precise, purpose-specific rules directly in the validation loop.

function isInModule(filePath, moduleName) {
  const rel = path.relative(MODULES_DIR, filePath);
  return rel.startsWith(moduleName + path.sep);
}

function listModules() {
  if (!fs.existsSync(MODULES_DIR)) return [];
  return fs.readdirSync(MODULES_DIR)
    .filter(d => fs.statSync(path.join(MODULES_DIR, d)).isDirectory());
}

function findJsFiles(dir, exclude = []) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (exclude.some(e => p.includes(e))) continue;
    if (entry.isDirectory()) out.push(...findJsFiles(p, exclude));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function extractRequires(src) {
  const refs = [];
  const re = /require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = re.exec(src))) refs.push(m[1]);
  return refs;
}

function resolveRelative(fromFile, importPath) {
  if (!importPath.startsWith('.')) return null;
  return path.resolve(path.dirname(fromFile), importPath);
}

function main() {
  const modules = listModules();
  if (modules.length === 0) {
    console.log('No modules found — nothing to check.');
    return 0;
  }

  const allFiles = findJsFiles(ROOT, ['node_modules', '.git', 'uploads', '/public/', 'tests']);
  const violations = [];

  for (const file of allFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const reqs = extractRequires(src);

    for (const req of reqs) {
      const resolved = resolveRelative(file, req);
      if (!resolved) continue;
      if (!resolved.startsWith(MODULES_DIR)) continue;

      // Which module is being imported from?
      const relFromMods = path.relative(MODULES_DIR, resolved);
      const moduleName = relFromMods.split(path.sep)[0];
      if (!modules.includes(moduleName)) continue;

      // Is the IMPORTER inside the same module? If so, allowed.
      if (isInModule(file, moduleName)) continue;

      // Is this a contract.js or index.js import? Allowed.
      const rest = relFromMods.split(path.sep).slice(1).join(path.sep);
      if (rest === 'contract.js' || rest === 'contract'
          || rest === 'index.js'   || rest === 'index') continue;

      const relFile = path.relative(ROOT, file).replace(/\\/g, '/');
      const normalizedVia = rest.replace(/\\/g, '/');

      // Narrow purpose-specific allowances:
      // 1. middleware/auth.js is only allowed to import the auth module middleware
      if (relFile === 'middleware/auth.js' && moduleName === 'auth' && normalizedVia.startsWith('middleware/auth')) continue;

      violations.push({
        file: relFile,
        imports: req,
        into: moduleName,
        via: rest,
      });
    }
  }

  if (violations.length === 0) {
    console.log(`✓ Module boundaries clean. Checked ${allFiles.length} files across ${modules.length} module(s).`);
    return 0;
  }

  console.log(`✗ ${violations.length} boundary violation(s):\n`);
  violations.forEach(v => {
    console.log(`  ${v.file}`);
    console.log(`    reaches into /modules/${v.into}/${v.via}`);
    console.log(`    via: require('${v.imports}')`);
    console.log(`    → should import from /modules/${v.into}/contract.js instead\n`);
  });
  return 1;
}

process.exit(main());
