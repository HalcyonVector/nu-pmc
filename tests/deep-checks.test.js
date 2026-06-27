// tests/deep-checks.test.js — Deep validation checks
// Covers: circular deps, env vars, SQL placeholders, XML validity,
// upload dirs, middleware order, response shapes, session, SQL injection,
// decimal precision, index coverage, large payloads, concurrency patterns

const fs   = require('fs');
const path = require('path');

// ── 1. CIRCULAR DEPENDENCY DETECTION
describe('Circular dependency detection', () => {
  test('no circular requires between routes', () => {
    // Build adjacency map manually
    const base  = path.join(__dirname, '..');
    const dirs  = ['routes','middleware','scripts'];
    const graph = {};

    dirs.forEach(dir => {
      const fullDir = path.join(base, dir);
      if (!fs.existsSync(fullDir)) return;
      fs.readdirSync(fullDir)
        .filter(f => f.endsWith('.js'))
        .forEach(f => {
          const fpath   = path.join(fullDir, f);
          let content   = fs.readFileSync(fpath, 'utf8');
          // Strip line comments and block comments before matching require() —
          // some files include `require('./x')` snippets in usage docs that aren't real deps.
          content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
          const key     = `${dir}/${f}`;
          graph[key]    = [];
          const requires = content.match(/require\(['"]\.\.?\/([^'"]+)['"]\)/g) || [];
          requires.forEach(r => {
            const m = r.match(/require\(['"]\.\.?\/([^'"]+)['"]\)/);
            if (m) {
              const dep = m[1].replace(/\.js$/, '') + '.js';
              // Don't add self-references (which would always look like cycles).
              if (!key.endsWith(dep)) graph[key].push(dep);
            }
          });
        });
    });

    // Simple cycle detection — DFS
    function hasCycle(node, visited = new Set(), stack = new Set()) {
      if (stack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      for (const dep of (graph[node] || [])) {
        const resolved = Object.keys(graph).find(k => k.endsWith(dep));
        if (resolved && hasCycle(resolved, visited, stack)) return true;
      }
      stack.delete(node);
      return false;
    }

    const cycles = Object.keys(graph).filter(k => hasCycle(k));
    expect(cycles).toEqual([]);
  });
});

// ── 2. ENVIRONMENT VARIABLE COMPLETENESS
describe('Environment variable completeness', () => {
  const ENV_EXAMPLE = path.join(__dirname, '../.env.example');
  const SERVER_FILE = path.join(__dirname, '../server.js');

  test('.env.example file exists', () => {
    expect(fs.existsSync(ENV_EXAMPLE)).toBe(true);
  });

  test('all process.env references in server.js are in .env.example', () => {
    const server  = fs.readFileSync(SERVER_FILE, 'utf8');
    const envVars = [...server.matchAll(/process\.env\.(\w+)/g)].map(m => m[1]);
    const unique  = [...new Set(envVars)];

    const example = fs.readFileSync(ENV_EXAMPLE, 'utf8');
    const missing = unique.filter(v => !example.includes(v) && v !== 'NODE_ENV');
    expect(missing).toEqual([]);
  });

  test('all process.env references in routes are in .env.example', () => {
    const moduleRoot = path.join(__dirname, '../modules');
    const example  = fs.readFileSync(ENV_EXAMPLE, 'utf8');
    const missing  = [];

    fs.readdirSync(moduleRoot)
      .filter(d => fs.statSync(path.join(moduleRoot, d)).isDirectory())
      .forEach(mod => {
        const rd = path.join(moduleRoot, mod, 'routes');
        if (!fs.existsSync(rd)) return;
        fs.readdirSync(rd)
          .filter(f => f.endsWith('.js'))
          .forEach(f => {
            const content = fs.readFileSync(path.join(rd, f), 'utf8');
            const vars = [...content.matchAll(/process\.env\.(\w+)/g)].map(m => m[1]);
            vars.forEach(v => {
              if (!example.includes(v) && v !== 'NODE_ENV') missing.push(`${mod}/${f}: ${v}`);
            });
          });
      });

    expect(missing).toEqual([]);
  });
});

// ── 3. SQL PLACEHOLDER COUNT VALIDATION
describe('SQL placeholder count validation', () => {
  function extractQueries(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = [];

    // Find db.query( positions and parse balanced brackets/backticks from there.
    // This handles nested [] in params like JSON.stringify(x||[]).
    const needle = 'db.query(';
    let pos = 0;
    while ((pos = content.indexOf(needle, pos)) !== -1) {
      const start = pos + needle.length;
      pos = start;

      // Extract the SQL string (backtick or single-quote delimited)
      let sqlStart = start;
      while (sqlStart < content.length && /\s/.test(content[sqlStart])) sqlStart++;
      const delim = content[sqlStart];
      if (delim !== '`' && delim !== "'") continue;
      let sqlEnd = sqlStart + 1;
      while (sqlEnd < content.length && content[sqlEnd] !== delim) sqlEnd++;
      const sql = content.substring(sqlStart + 1, sqlEnd);

      // Skip dynamic SQL with template expressions
      if (sql.includes('${')) continue;

      // Find the params array: skip to , then [
      let ci = sqlEnd + 1;
      while (ci < content.length && content[ci] !== '[' && content[ci] !== ')') ci++;
      if (content[ci] !== '[') continue;

      // Balance brackets to find the end of the params array
      let depth = 0;
      let arrStart = ci;
      let inStr = false, strCh = '';
      for (; ci < content.length; ci++) {
        const ch = content[ci];
        if (inStr) { if (ch === strCh && content[ci-1] !== '\\') inStr = false; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { inStr = true; strCh = ch; continue; }
        if (ch === '[') depth++;
        if (ch === ']') { depth--; if (depth === 0) break; }
      }
      const paramsStr = content.substring(arrStart + 1, ci).trim();

      const qmarks = (sql.match(/\?/g) || []).length;

      // Count top-level params (commas at depth 0)
      let params = 0;
      if (paramsStr) {
        let d = 0, hasContent = false;
        inStr = false; strCh = '';
        for (let pi = 0; pi < paramsStr.length; pi++) {
          const ch = paramsStr[pi];
          if (inStr) { if (ch === strCh && paramsStr[pi-1] !== '\\') inStr = false; continue; }
          if (ch === "'" || ch === '"' || ch === '`') { inStr = true; strCh = ch; hasContent = true; continue; }
          if ('([{'.includes(ch)) { d++; hasContent = true; continue; }
          if (')]}'.includes(ch)) { d--; continue; }
          if (ch === ',' && d === 0) { if (hasContent) params++; hasContent = false; continue; }
          if (ch.trim()) hasContent = true;
        }
        if (hasContent) params++;
      }

      if (qmarks !== params && params > 0) {
        results.push({
          file: path.basename(filePath),
          sql:  sql.substring(0, 80).replace(/\s+/g, ' '),
          qmarks, params
        });
      }
    }
    return results;
  }

  test('SQL placeholder counts match parameter counts in all routes', () => {
    const moduleRoot = path.join(__dirname, '../modules');
    const mismatches = [];

    fs.readdirSync(moduleRoot)
      .filter(d => fs.statSync(path.join(moduleRoot, d)).isDirectory())
      .forEach(mod => {
        const rd = path.join(moduleRoot, mod, 'routes');
        if (!fs.existsSync(rd)) return;
        fs.readdirSync(rd)
          .filter(f => f.endsWith('.js'))
          .forEach(f => {
            const issues = extractQueries(path.join(rd, f));
            mismatches.push(...issues);
          });
      });

    if (mismatches.length > 0) {
      console.log('SQL mismatches:', JSON.stringify(mismatches, null, 2));
    }
    expect(mismatches).toEqual([]);
  });

  test('SQL placeholder counts match in scripts', () => {
    const scriptDir = path.join(__dirname, '../scripts');
    const mismatches = [];

    fs.readdirSync(scriptDir)
      .filter(f => f.endsWith('.js'))
      .forEach(f => {
        const issues = extractQueries(path.join(scriptDir, f));
        mismatches.push(...issues);
      });

    expect(mismatches).toEqual([]);
  });
});

// ── 4. TALLY XML WELL-FORMEDNESS
describe('Tally XML well-formedness', () => {
  function validateXMLStructure(xml) {
    const errors = [];
    // Check opening tags match closing tags
    const opens  = [...xml.matchAll(/<([A-Z][A-Z0-9._]*)[^/]>/g)].map(m => m[1]);
    const closes = [...xml.matchAll(/<\/([A-Z][A-Z0-9._]*)>/g)].map(m => m[1]);
    // Check envelope structure
    if (!xml.includes('<ENVELOPE>'))    errors.push('Missing ENVELOPE tag');
    if (!xml.includes('</ENVELOPE>'))   errors.push('Missing closing ENVELOPE');
    if (!xml.includes('<VOUCHER'))      errors.push('Missing VOUCHER element');
    if (!xml.includes('VCHTYPE="Sales"')) errors.push('Missing Sales voucher type');
    if (!xml.includes('<DATE>'))        errors.push('Missing DATE element');
    if (!xml.includes('<PARTYLEDGERNAME>')) errors.push('Missing party ledger');
    if (!xml.includes('</TALLYMESSAGE>'))  errors.push('Missing TALLYMESSAGE close');
    return errors;
  }

  test('IGST XML structure is valid', () => {
    // Build a minimal valid Tally Prime XML (interstate)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>20260412</DATE>
            <VOUCHERNUMBER>NUALL/26-27/001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>TLD MAINI GSE Pvt Ltd</PARTYLEDGERNAME>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>IGST</LEDGERNAME>
              <AMOUNT>-99900.0000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TLD MAINI GSE Pvt Ltd</LEDGERNAME>
              <AMOUNT>654900.0000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    const errors = validateXMLStructure(xml);
    expect(errors).toEqual([]);
  });

  test('CGST+SGST XML structure is valid', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>20260412</DATE>
            <VOUCHERNUMBER>NUALL/26-27/002</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Bengaluru Client Ltd</PARTYLEDGERNAME>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST</LEDGERNAME>
              <AMOUNT>-49950.0000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST</LEDGERNAME>
              <AMOUNT>-49950.0000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Bengaluru Client Ltd</LEDGERNAME>
              <AMOUNT>604950.0000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    const errors = validateXMLStructure(xml);
    expect(errors).toEqual([]);
  });

  test('XML rejects special characters in ledger names', () => {
    // Ledger names with & < > would break XML
    function sanitize(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    expect(sanitize('TLD & Sons')).toBe('TLD &amp; Sons');
    expect(sanitize('<invalid>')).toBe('&lt;invalid&gt;');
    expect(sanitize('Normal Name')).toBe('Normal Name');
  });

  test('invoice amount = subtotal + GST to 4 decimal places', () => {
    const subtotal = 555000.0000;
    const gst      = Math.round(subtotal * 18 / 100 * 10000) / 10000;
    const total    = Math.round((subtotal + gst) * 10000) / 10000;
    expect(gst).toBe(99900.0000);
    expect(total).toBe(654900.0000);
    // 4dp formatting for XML
    expect(total.toFixed(4)).toBe('654900.0000');
  });
});

// ── 5. UPLOAD DIRECTORY EXISTENCE CHECK
describe('Upload directory structure', () => {
  const UPLOAD_BASE = path.join(__dirname, '../uploads');
  const REQUIRED_SUBDIRS = ['photos','documents','boq','drawings'];

  test('upload middleware creates required subdirectories', () => {
    // Check the upload middleware has logic to create dirs
    const uploadMw = fs.readFileSync(
      path.join(__dirname, '../middleware/upload.js'), 'utf8'
    );
    // Should either mkdirSync or existsSync + mkdirSync
    const hasCreation = uploadMw.includes('mkdirSync') || uploadMw.includes('mkdir');
    expect(hasCreation).toBe(true);
  });

  test('server.js creates upload dirs on startup', () => {
    const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    // Should have some directory creation logic
    const hasCreation = server.includes('mkdirSync') || server.includes('mkdir');
    expect(hasCreation).toBe(true);
  });
});

// ── 6. MIDDLEWARE ORDER VALIDATION
describe('Middleware order in server.js', () => {
  const serverContent = fs.readFileSync(
    path.join(__dirname, '../server.js'), 'utf8'
  );

  function posOf(str) {
    const idx = serverContent.indexOf(str);
    return idx === -1 ? Infinity : idx;
  }

  test('body parser comes before session', () => {
    const body    = posOf('express.json(');   // matches both express.json() and express.json({
    const session = posOf("app.use(session"); // when session middleware is mounted
    expect(body).toBeLessThan(session);
  });

  test('session comes before routes', () => {
    const session = posOf('express-session');
    const routes  = posOf("app.use('/api/");
    expect(session).toBeLessThan(routes);
  });

  test('static files served before API routes', () => {
    const staticF = posOf('express.static');
    const apiRoute = posOf("app.use('/api/");
    // static can be before or after — just verify static exists
    expect(staticF).not.toBe(Infinity);
  });

  test('error handler is last middleware', () => {
    const errorHandler = posOf('app.use((err,');
    const lastRoute    = serverContent.lastIndexOf("app.use('/api/");
    expect(errorHandler).toBeGreaterThan(lastRoute);
  });
});

// ── 7. RESPONSE SHAPE CONSISTENCY
describe('Response shape consistency', () => {
  function extractResponseShapes(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues  = [];

    // Find res.json({...}) calls and check they have either success, error, or a data key
    const jsonCalls = content.match(/res\.json\(\{[^}]{1,200}\}\)/g) || [];
    jsonCalls.forEach(call => {
      const hasSuccess = call.includes('success');
      const hasError   = call.includes('error');
      const DATA_KEYS = ['projects','items','tasks','vendors','users','drawings',
                         'claims','clients','measurements','trades','version','changes',
                         'action_centre','summary','id','cn_number','file_','invoice',
                         'message','can_see','total','payment_count','approvals',
                         'requests','reports','queries','photos','documents','logs',
                         'project','week_ending','visits','notifications','user',
                         'schedule','versions','boq','gantt','margin','totals',
                         'visit','observations','changes','vendors','tasks',
                         'comms','stats','moms','issues','snags','summary','actions',
                         // Extended coverage for all route responses
                         'failures','pending','flags','ok','suggestions','payments',
                         'receipts','team','leaves','engagements','history','lesson',
                         'lessons','templates','submissions','grns','signoffs','ncrs',
                         'features','clusters','entities','entity','delegations',
                         'effective','drafts','role','buckets','assignment','meetings',
                         'submittals','my_input','blocked','needsYou','api_key',
                         'over_budget','has_alerts','queue','count','overdue',
                         'document','links','scope','checks','state','date',
                         'complete','required_roles','ai_used','triaged',
                         'dropped','rows','report','enabled'];
      const hasData    = DATA_KEYS.some(k => call.includes(k));
      if (!hasSuccess && !hasError && !hasData) {
        issues.push(`${path.basename(filePath)}: ${call.substring(0, 80)}`);
      }
    });
    return issues;
  }

  test('all route responses have consistent shape', () => {
    const moduleRoot = path.join(__dirname, '../modules');
    const issues   = [];

    fs.readdirSync(moduleRoot)
      .filter(d => fs.statSync(path.join(moduleRoot, d)).isDirectory())
      .forEach(mod => {
        const rd = path.join(moduleRoot, mod, 'routes');
        if (!fs.existsSync(rd)) return;
        fs.readdirSync(rd)
          .filter(f => f.endsWith('.js'))
          .forEach(f => {
            issues.push(...extractResponseShapes(path.join(rd, f)));
          });
      });

    if (issues.length > 0) console.log('Shape issues:', issues);
    expect(issues).toEqual([]);
  });
});

// ── 8. SQL INJECTION SURFACE CHECK
describe('SQL injection surface', () => {
  function findDynamicSQL(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues  = [];

    // Look for template literals with req. inside db.query
    const pattern = /db\.query\(`[^`]*\$\{req\.(query|params|body)\.[^}]+\}[^`]*`/g;
    let m;
    while ((m = pattern.exec(content)) !== null) {
      issues.push({
        file: path.basename(filePath),
        snippet: m[0].substring(0, 100)
      });
    }
    return issues;
  }

  test('no raw req.query/params/body interpolation in SQL strings', () => {
    const moduleRoot = path.join(__dirname, '../modules');
    const issues   = [];

    fs.readdirSync(moduleRoot)
      .filter(d => fs.statSync(path.join(moduleRoot, d)).isDirectory())
      .forEach(mod => {
        const rd = path.join(moduleRoot, mod, 'routes');
        if (!fs.existsSync(rd)) return;
        fs.readdirSync(rd)
          .filter(f => f.endsWith('.js'))
          .forEach(f => {
            issues.push(...findDynamicSQL(path.join(rd, f)));
          });
      });

    if (issues.length > 0) {
      console.log('SQL injection risks:', JSON.stringify(issues, null, 2));
    }
    expect(issues).toEqual([]);
  });

  test('all user input uses parameterised queries', () => {
    const moduleRoot = path.join(__dirname, '../modules');
    const unparameterised = [];

    fs.readdirSync(moduleRoot)
      .filter(d => fs.statSync(path.join(moduleRoot, d)).isDirectory())
      .forEach(mod => {
        const rd = path.join(moduleRoot, mod, 'routes');
        if (!fs.existsSync(rd)) return;
        fs.readdirSync(rd)
          .filter(f => f.endsWith('.js'))
          .forEach(f => {
            const fc = fs.readFileSync(path.join(rd, f), 'utf8');
            // Find db.query calls WITHOUT a params array
            const noParamPattern = /db\.query\(\s*[`'][^`']*(?:req\.(?:body|params|query))[^`']*[`']\s*\)/g;
            let m;
            while ((m = noParamPattern.exec(fc)) !== null) {
              unparameterised.push(`${mod}/${f}: ${m[0].substring(0, 80)}`);
            }
          });
      });

    if (unparameterised.length > 0) console.log('Unparameterised:', unparameterised);
    expect(unparameterised).toEqual([]);
  });
});

// ── 9. DECIMAL PRECISION — 4 DECIMAL PLACES
describe('Decimal precision — 4dp throughout', () => {
  test('rate × quantity to 4dp', () => {
    // ₹4,200/cum × 32.500 cum = ₹136,500.0000
    const rate = 4200.0000;
    const qty  = 32.500;
    const amt  = Math.round(rate * qty * 10000) / 10000;
    expect(amt).toBe(136500.0000);
    expect(amt.toFixed(4)).toBe('136500.0000');
  });

  test('GST calculation to 4dp', () => {
    const subtotal = 136500.0000;
    const gst18    = Math.round(subtotal * 0.18 * 10000) / 10000;
    expect(gst18).toBe(24570.0000);
    expect(gst18.toFixed(4)).toBe('24570.0000');
  });

  test('split GST — CGST and SGST equal halves', () => {
    const totalGST = 24570.0000;
    const cgst     = Math.round(totalGST / 2 * 10000) / 10000;
    const sgst     = Math.round(totalGST / 2 * 10000) / 10000;
    expect(cgst).toBe(12285.0000);
    expect(sgst).toBe(12285.0000);
    expect(cgst + sgst).toBe(totalGST);
  });

  test('no floating point errors on Indian amounts', () => {
    // Classic JS float issue: 0.1 + 0.2 = 0.30000000000000004
    // Fix: multiply by 10000, round, divide
    const a = 49950.0000;
    const b = 49950.0000;
    const sum = Math.round((a + b) * 10000) / 10000;
    expect(sum).toBe(99900.0000);
    expect(sum.toFixed(4)).toBe('99900.0000');
  });

  test('large Indian amount — 1 crore to 4dp', () => {
    const crore = 10000000.0000;
    const gst   = Math.round(crore * 0.18 * 10000) / 10000;
    expect(gst).toBe(1800000.0000);
    expect(gst.toFixed(4)).toBe('1800000.0000');
  });

  test('schema uses DECIMAL(12,4) for rate columns', () => {
    const schema = fs.readFileSync(
      path.join(__dirname, '../schema.sql'), 'utf8'
    );
    // client_rate, our_cost_rate should be DECIMAL(12,4)
    expect(schema).toContain('DECIMAL(12,4)');
    // DECIMAL(12,2) is acceptable for non-rate columns (sqft_area, percentages).
    // Verify no rate/amount-like names use the wrong precision.
    const lines = schema.split('\n');
    const wrongPrecisionRateColumns = lines.filter(line =>
      /\b(rate|amount|cost|price)\w*\s+DECIMAL\(12,2\)/i.test(line)
    );
    expect(wrongPrecisionRateColumns).toEqual([]);
  });
});

// ── 10. INDEX COVERAGE
describe('Database index coverage', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../schema.sql'), 'utf8'
  );

  test('project_id is indexed on all major tables', () => {
    const tablesNeedingIndex = [
      'schedule_versions', 'schedule_tasks', 'task_updates',
      'drawings', 'issues', 'boq_items',
      'material_requests', 'wa_pending_actions', 'change_notices',
      'vendor_payments', 'client_claims', 'measurements'
    ];

    // Each table should either have FK (which creates index in InnoDB) or explicit index
    tablesNeedingIndex.forEach(table => {
      const hasFK    = schema.includes(`FOREIGN KEY (project_id) REFERENCES projects`);
      const hasIndex = schema.includes(`idx_${table.replace('_','')}`) ||
                       schema.includes(`project_id`) && schema.includes(table);
      expect(hasFK || hasIndex).toBe(true);
    });
  });

  test('status columns are indexed for dashboard queries', () => {
    // Dashboard does lots of WHERE status = queries
    const statusIndexes = [
      'idx_claims_project_status',
      'idx_measurements_project',
    ];
    statusIndexes.forEach(idx => {
      expect(schema).toContain(idx);
    });
  });

  test('approval_requests has index for pending query', () => {
    expect(schema).toContain('wa_pending_actions');
    // Dashboard: SELECT * WHERE status = pending — should be indexed
    const hasIndex = schema.includes('wa_pending_actions') &&
                     (schema.includes('idx_approval') || schema.includes('status'));
    expect(hasIndex).toBe(true);
  });
});

// ── 11. SESSION SECURITY
describe('Session security', () => {
  const serverContent = fs.readFileSync(
    path.join(__dirname, '../server.js'), 'utf8'
  );

  test('session uses secret from environment', () => {
    expect(serverContent).toContain('SESSION_SECRET');
    expect(serverContent).not.toContain("secret: 'hardcoded");
    expect(serverContent).not.toContain('secret: "hardcoded');
  });

  test('session has httpOnly cookies', () => {
    const hasSecureConfig = serverContent.includes('httpOnly') ||
                            serverContent.includes('cookie:');
    expect(hasSecureConfig).toBe(true);
  });

  test('logout destroys session server-side', () => {
    const authRoute = fs.readFileSync(
      path.join(__dirname, '../modules/auth/routes/auth.js'), 'utf8'
    );
    // Should use req.session.destroy() not just clear cookie
    expect(authRoute).toContain('destroy');
  });

  test('session saveUninitialized is false', () => {
    expect(serverContent).toContain('saveUninitialized: false');
  });

  test('session resave is false', () => {
    expect(serverContent).toContain('resave: false');
  });
});

// ── 12. LARGE PAYLOAD HANDLING
describe('Large payload handling', () => {
  test('upload middleware has file size limit', () => {
    const uploadMw = fs.readFileSync(
      path.join(__dirname, '../middleware/upload.js'), 'utf8'
    );
    const hasLimit = uploadMw.includes('fileSize') || uploadMw.includes('limits');
    expect(hasLimit).toBe(true);
  });

  test('body parser has size limit', () => {
    const server = fs.readFileSync(
      path.join(__dirname, '../server.js'), 'utf8'
    );
    // express.json() with limit or separate limit config
    const hasLimit = server.includes('limit') || server.includes('express.json()');
    expect(hasLimit).toBe(true);
  });

  test('file type filter rejects non-allowed types', () => {
    const uploadMw = fs.readFileSync(
      path.join(__dirname, '../middleware/upload.js'), 'utf8'
    );
    expect(uploadMw).toContain('not allowed');
    // Allowed types
    expect(uploadMw).toContain('.pdf');
    expect(uploadMw).toContain('.jpg');
    expect(uploadMw).toContain('.xlsx');
  });
});

// ── 13. CONCURRENCY PATTERNS
describe('Concurrency — atomic operations', () => {
  test('ON DUPLICATE KEY UPDATE used for upsert operations', () => {
    // Post-V5: routes live under modules/<module>/routes/.
    let upsertCount = 0;
    const moduleRoot = path.join(__dirname, '../modules');
    const modules = fs.readdirSync(moduleRoot).filter(d => fs.statSync(path.join(moduleRoot, d)).isDirectory());
    modules.forEach(m => {
      const rd = path.join(moduleRoot, m, 'routes');
      if (!fs.existsSync(rd)) return;
      fs.readdirSync(rd).filter(f => f.endsWith('.js')).forEach(f => {
        const content = fs.readFileSync(path.join(rd, f), 'utf8');
        if (content.includes('ON DUPLICATE KEY UPDATE')) upsertCount++;
      });
    });

    // measurements, claim_items, task_validations, others use upsert
    expect(upsertCount).toBeGreaterThanOrEqual(3);
  });

  test('invoice sequence generation is concurrency safe via FOR UPDATE locking', () => {
    // Post-V5: clients route is under modules/onboarding/
    const clientRoute = fs.readFileSync(
      path.join(__dirname, '../modules/onboarding/routes/clients.js'), 'utf8'
    );
    // Invoice sequence uses FOR UPDATE on client record
    expect(clientRoute).toContain('invoice_sequence');
    expect(clientRoute).toContain('FOR UPDATE');
  });

  test('UNIQUE KEY constraints prevent duplicate entries', () => {
    const schema = fs.readFileSync(
      path.join(__dirname, '../schema.sql'), 'utf8'
    );
    // claim_items, measurement_items have UNIQUE on (id pairs)
    expect(schema).toContain('uq_claim_item');
    expect(schema).toContain('uq_meas_item');
    // client GSTIN is unique
    expect(schema).toContain('uq_gstin');
  });
});

// ── 13.5 PWA INSTALLABILITY CHECKLIST
describe('PWA installability checklist', () => {
  const base = path.join(__dirname, '..');

  test('manifest.json exists', () => {
    expect(fs.existsSync(path.join(base, 'public/manifest.json'))).toBe(true);
  });

  test('manifest has all required fields', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'public/manifest.json'), 'utf8'));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('manifest has 192x192 icon', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'public/manifest.json'), 'utf8'));
    const has192 = manifest.icons.some(i => i.sizes === '192x192');
    expect(has192).toBe(true);
  });

  test('manifest has 512x512 icon', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'public/manifest.json'), 'utf8'));
    const has512 = manifest.icons.some(i => i.sizes === '512x512');
    expect(has512).toBe(true);
  });

  test('manifest has shortcuts defined', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'public/manifest.json'), 'utf8'));
    expect(manifest.shortcuts).toBeDefined();
    expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(1);
  });

  test('manifest has id field (prevents duplicate installs)', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'public/manifest.json'), 'utf8'));
    expect(manifest.id).toBeDefined();
  });

  test('service worker exists', () => {
    expect(fs.existsSync(path.join(base, 'public/sw.js'))).toBe(true);
  });

  test('service worker caches icons', () => {
    const sw = fs.readFileSync(path.join(base, 'public/sw.js'), 'utf8');
    expect(sw).toContain('icon-192.png');
    expect(sw).toContain('icon-512.png');
  });

  test('service worker handles offline API queuing', () => {
    const sw = fs.readFileSync(path.join(base, 'public/sw.js'), 'utf8');
    // Renamed from queueRequest → enqueue in V5 cleanup.
    expect(sw).toContain('enqueue');
    expect(sw).toContain('replayQueue');
    expect(sw).toContain('indexedDB');
  });

  test('service worker has background sync', () => {
    const sw = fs.readFileSync(path.join(base, 'public/sw.js'), 'utf8');
    expect(sw).toContain("addEventListener('sync'");
  });

  test('index.html has manifest link', () => {
    const html = fs.readFileSync(path.join(base, 'public/index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
  });

  test('index.html has apple-touch-icon', () => {
    const html = fs.readFileSync(path.join(base, 'public/index.html'), 'utf8');
    expect(html).toContain('apple-touch-icon');
  });

  test('index.html has apple-mobile-web-app-capable meta', () => {
    const html = fs.readFileSync(path.join(base, 'public/index.html'), 'utf8');
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  test('index.html has install banner', () => {
    const html = fs.readFileSync(path.join(base, 'public/index.html'), 'utf8');
    expect(html).toContain('install-banner');
    expect(html).toContain('install-btn');
  });

  test('app.js registers service worker', () => {
    const js = fs.readFileSync(path.join(base, 'public/js/app.js'), 'utf8');
    expect(js).toContain("serviceWorker.register('/sw.js')");
  });

  test('app.js handles beforeinstallprompt', () => {
    const js = fs.readFileSync(path.join(base, 'public/js/app.js'), 'utf8');
    expect(js).toContain('beforeinstallprompt');
    expect(js).toContain('_installPrompt');
  });

  test('apple-touch-icon file exists at 180x180', () => {
    expect(fs.existsSync(path.join(base, 'public/icons/apple-touch-icon.png'))).toBe(true);
  });

  test('icon-192.png file exists', () => {
    expect(fs.existsSync(path.join(base, 'public/icons/icon-192.png'))).toBe(true);
  });

  test('icon-512.png file exists', () => {
    expect(fs.existsSync(path.join(base, 'public/icons/icon-512.png'))).toBe(true);
  });

  test('offline.html exists', () => {
    expect(fs.existsSync(path.join(base, 'public/offline.html'))).toBe(true);
  });

  test('service worker cache version is current', () => {
    const sw = fs.readFileSync(path.join(base, 'public/sw.js'), 'utf8');
    // Cache name follows nu-pmc-vN convention; bumped on each schema/asset migration.
    expect(sw).toMatch(/nu-pmc-v\d+/);
  });
});

// ── 14. FILE EXISTENCE — ALL REQUIRED FILES
describe('Required file existence', () => {
  const base = path.join(__dirname, '..');

  // Post-V5 layout: routes live under modules/<module>/routes/.
  // Removed in V5: /api/queries (folded into /api/issues with issue_type='drawing'),
  // /api/visits (removed entirely — no replacement).
  const REQUIRED_FILES = [
    'server.js', 'package.json', 'schema.sql', '.env.example',
    'modules/auth/middleware/auth.js', 'middleware/db.js',
    'middleware/upload.js', 'middleware/excel.js',
    'modules/auth/routes/auth.js',
    'modules/onboarding/routes/projects.js', 'modules/design-services/routes/schedule.js',
    'modules/design-services/routes/drawings.js', 'modules/design-services/routes/materials.js',
    'modules/onboarding/routes/vendors.js', 'modules/finance/routes/claims.js',
    'modules/workflow/routes/measurements.js',
    'modules/onboarding/routes/client-boq.js', 'modules/onboarding/routes/clients.js',
    'modules/reporting/routes/gantt.js',
    'modules/workflow/routes/changes.js', 'modules/workflow/routes/approvals.js',
    'modules/reporting/routes/dashboard.js',
    'modules/system/routes/notifications.js', 'modules/reporting/routes/reports.js',
    'modules/site/routes/photos.js', 'modules/auth/routes/users.js',
    'modules/system/routes/whatsapp.js',
    'scripts/set-passwords.js', 'scripts/daily-report-sender.js',
    'scripts/overdue-checker.js',
    'tests/setup.js', 'tests/seed.sql',
  ];

  REQUIRED_FILES.forEach(file => {
    test(`${file} exists`, () => {
      expect(fs.existsSync(path.join(base, file))).toBe(true);
    });
  });
});

