// tests/routes.test.js — API route tests
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');

// Helper: build app with a pre-authenticated session
function makeApp(role = 'principal', extraRoutes = []) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));

  // Inject session for testing — assign project 1 by default so requireProjectScope passes.
  // projects_at = now() so the 5-min TTL refresh in requireProjectScope does NOT fire
  // and consume the test's mocked db.query results.
  app.use((req, _res, next) => {
    req.session.user = {
      id: 1, username: 'principal', full_name: 'Principal Kumar Bhat',
      role, stream: 'all',
      projects: [{ id: 1, name: 'Test Project' }],
      projects_at: Date.now(),
    };
    next();
  });

  extraRoutes.forEach(([path, router]) => app.use(path, router));
  return app;
}

beforeEach(() => { jest.clearAllMocks(); db.query.mockReset(); db.query.mockResolvedValue([[]]); });

// ── PROJECTS
describe('GET /api/projects', () => {
  test('principal sees all projects', async () => {
    const app = makeApp('principal', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    db.query
      .mockResolvedValueOnce([[
        { id:1, name:'Test Project', client:'ACME', location:'Bengaluru', status:'active',
          r0_start_date:'2026-01-01', r0_end_date:'2026-12-31',
          checklist_project_created:1, checklist_design_boq:1, checklist_services_boq:1,
          checklist_schedule:1, checklist_site_manager:1 }
      ]])
      .mockResolvedValueOnce([[{ project_id: 1, open_queries: 0, overdue_queries: 0 }]])
      .mockResolvedValueOnce([[{ project_id: 1, flagged_tasks: 0 }]])
      .mockResolvedValueOnce([[{ project_id: 1, overdue_materials: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 1, avg_pct_complete: 45 }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toBeDefined();
  });

  test('site_manager sees only assigned projects', async () => {
    const app = makeApp('site_manager', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    db.query
      .mockResolvedValueOnce([[
        { id:1, name:'PV90 Project', client:'TLD', location:'Nelamangala', status:'active',
          r0_start_date:'2026-01-01', r0_end_date:'2026-12-31',
          checklist_project_created:1, checklist_design_boq:1, checklist_services_boq:1,
          checklist_schedule:1, checklist_site_manager:1 }
      ]])
      .mockResolvedValueOnce([[{ project_id: 1, open_queries: 0, overdue_queries: 0 }]])
      .mockResolvedValueOnce([[{ project_id: 1, flagged_tasks: 0 }]])
      .mockResolvedValueOnce([[{ project_id: 1, overdue_materials: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 1, avg_pct_complete: 50 }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toBeDefined();
  });
});

describe('POST /api/projects', () => {
  test('principal can create project', async () => {
    const app = makeApp('principal', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    // Route does: (1) client lookup by name, (2) project INSERT
    db.query.mockResolvedValueOnce([[{ id: 7, master_complete: 1 }]]);  // existing client found
    db.query.mockResolvedValueOnce([{ insertId: 5 }]);                  // project insert
    const res = await request(app).post('/api/projects').send({
      code: 'TEST01', name: 'Test Project', client: 'ACME',
      location: 'Bengaluru', r0_start_date: '2026-01-01', r0_end_date: '2026-12-31'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 400 if required fields missing', async () => {
    const app = makeApp('principal', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    const res = await request(app).post('/api/projects').send({ code: 'TEST01' });
    expect(res.status).toBe(400);
  });

  test('non-principal cannot create project', async () => {
    const app = makeApp('pmc_head', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    const res = await request(app).post('/api/projects').send({
      code: 'X', name: 'Y', client: 'Z', r0_start_date: '2026-01-01', r0_end_date: '2026-12-31'
    });
    expect(res.status).toBe(403);
  });
});

// ── SCHEDULE
describe('POST /api/schedule/:project_id/update', () => {
  test('site manager can update task %', async () => {
    const app = makeApp('site_manager', [['/api/schedule', require('../modules/design-services/routes/schedule')]]);
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([[]]);                      // regression check — no prior updates
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);         // task_updates INSERT
    const res = await request(app).post('/api/schedule/1/update').send({
      task_id: 5, pct_complete: 75, report_date: '2026-04-11'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/schedule/:project_id/validate', () => {
  test('pmc_head can validate task', async () => {
    const app = makeApp('pmc_head', [['/api/schedule', require('../modules/design-services/routes/schedule')]]);
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/schedule/1/validate').send({
      task_update_id: 3, status: 'validated'
    });
    expect(res.status).toBe(200);
  });

  test('rejects invalid status', async () => {
    const app = makeApp('pmc_head', [['/api/schedule', require('../modules/design-services/routes/schedule')]]);
    const res = await request(app).post('/api/schedule/1/validate').send({
      task_update_id: 3, status: 'banana'
    });
    expect(res.status).toBe(400);
  });

  test('site_manager cannot validate tasks', async () => {
    const app = makeApp('site_manager', [['/api/schedule', require('../modules/design-services/routes/schedule')]]);
    const res = await request(app).post('/api/schedule/1/validate').send({
      task_update_id: 3, status: 'validated'
    });
    expect(res.status).toBe(403);
  });
});

// ── APPROVALS
describe('POST /api/approvals/:id/approve', () => {
  test('principal can approve', async () => {
    const app = makeApp('principal', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);
    db.query
      .mockResolvedValueOnce([[{ id:1, request_type:'schedule_change', project_id:1, ref_table:'schedule_versions', ref_id:2 }]])  // get approval
      .mockResolvedValueOnce([[{ label:'v2', drift_days:2 }]])  // get schedule version
      .mockResolvedValueOnce([{}])   // update old versions
      .mockResolvedValueOnce([{}])   // update new version
      .mockResolvedValueOnce([{}])   // update project checklist
      .mockResolvedValueOnce([[]])   // notify — get users
    const res = await request(app).post('/api/approvals/1/approve');
    expect(res.status).toBe(200);
  });

  test('pmc_head cannot approve', async () => {
    const app = makeApp('pmc_head', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);
    const res = await request(app).post('/api/approvals/1/approve');
    expect(res.status).toBe(403);
  });

  test('site_manager cannot approve', async () => {
    const app = makeApp('site_manager', [['/api/approvals', require('../modules/workflow/routes/approvals')]]);
    const res = await request(app).post('/api/approvals/1/approve');
    expect(res.status).toBe(403);
  });
});

// ── MATERIALS
describe('POST /api/materials/:project_id/requests', () => {
  test('site manager can raise material request', async () => {
    const app = makeApp('site_manager', [['/api/materials', require('../modules/design-services/routes/materials')]]);
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{ insertId: 3 }]);
    const res = await request(app).post('/api/materials/1/requests').send({
      boq_item_id: 5, quantity_needed: 50, needed_by_date: '2026-05-01'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 400 if fields missing', async () => {
    const app = makeApp('site_manager', [['/api/materials', require('../modules/design-services/routes/materials')]]);
    const res = await request(app).post('/api/materials/1/requests').send({ boq_item_id: 5 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/materials/requests/:id/status', () => {
  test('pmc_head can update status', async () => {
    const app = makeApp('pmc_head', [['/api/materials', require('../modules/design-services/routes/materials')]]);
    db.query.mockResolvedValueOnce([[{ status: 1 }]]);              // SM read current state
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);          // SM transition UPDATE
    const res = await request(app).patch('/api/materials/requests/3/status').send({ status: 2 });
    expect(res.status).toBe(200);
  });

  test('rejects invalid status > 5', async () => {
    const app = makeApp('pmc_head', [['/api/materials', require('../modules/design-services/routes/materials')]]);
    const res = await request(app).patch('/api/materials/requests/3/status').send({ status: 6 });
    expect(res.status).toBe(400);
  });

  test('rejects status 0', async () => {
    const app = makeApp('pmc_head', [['/api/materials', require('../modules/design-services/routes/materials')]]);
    const res = await request(app).patch('/api/materials/requests/3/status').send({ status: 0 });
    expect(res.status).toBe(400);
  });

  test('site_manager cannot update status', async () => {
    const app = makeApp('site_manager', [['/api/materials', require('../modules/design-services/routes/materials')]]);
    const res = await request(app).patch('/api/materials/requests/3/status').send({ status: 2 });
    expect(res.status).toBe(403);
  });
});

// ── CHANGE NOTICES
describe('POST /api/changes/:project_id', () => {
  test('principal can raise a change notice', async () => {
    const app = makeApp('principal', [['/api/changes', require('../modules/workflow/routes/changes')]]);
    db.query
      .mockResolvedValueOnce([[{ status: 'active' }]])  // closed-project guard
      .mockResolvedValueOnce([[{ cnt: 0 }]])             // CN count
      .mockResolvedValueOnce([{ insertId: 1 }])          // insert CN
    const res = await request(app).post('/api/changes/1').send({
      title: 'Change to column grid',
      description: 'Client requested change to structural grid',
      source: 'client'
    });
    expect(res.status).toBe(200);
    expect(res.body.cn_number).toBe('CN001');
  });

  test('site_manager cannot raise change notice — Principal-only', async () => {
    const app = makeApp('site_manager', [['/api/changes', require('../modules/workflow/routes/changes')]]);
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);
    const res = await request(app).post('/api/changes/1').send({
      title: 'X', description: 'Y', source: 'client'
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 if description missing', async () => {
    const app = makeApp('principal', [['/api/changes', require('../modules/workflow/routes/changes')]]);
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // closed-project guard
    const res = await request(app).post('/api/changes/1').send({ title: 'Test' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/changes/:id/sign', () => {
  test('design_head can sign as PMC Head', async () => {
    const app = makeApp('design_head', [['/api/changes', require('../modules/workflow/routes/changes')]]);
    db.query
      // 0. requireScopeFromEntity('change_notices') — project_id + status lookup
      .mockResolvedValueOnce([[{ project_id: 1, status: 'active' }]])
      // 1. SELECT * FROM change_notices — return one CN
      .mockResolvedValueOnce([[{ id:1, status:'collecting_sigs', cn_number:'CN001', title:'Test',
        sig_design_head:0, sig_services_head:0, sig_pmc:null, project_id:1, description:'desc' }]])
      // 2. SELECT deputy lookup — design_head themself, not a deputy
      .mockResolvedValueOnce([[]])
      // 3. INSERT IGNORE signatories
      .mockResolvedValueOnce([{ insertId: 1 }])
      // 4. UPDATE change_notices — set sig_design_head
      .mockResolvedValueOnce([{}]);
    const res = await request(app).post('/api/changes/1/sign');
    expect(res.status).toBe(200);
  });

  test('site_manager cannot sign change notice', async () => {
    const app = makeApp('site_manager', [['/api/changes', require('../modules/workflow/routes/changes')]]);
    // Site manager IS in PROJECT_SCOPED_ROLES, so requireScopeFromEntity does
    // a project-membership check. The default test session has projects=[]
    // (or whatever makeApp sets) — easier to make the scope lookup pass and
    // let the route's role gate emit 403.
    db.query
      .mockResolvedValueOnce([[{ project_id: 1, status: 'active' }]])
      .mockResolvedValueOnce([[{ id:1, cn_number:'CN001', title:'Test', status:'collecting_sigs',
        sig_design_head:0, sig_services_head:0, sig_pmc:null, project_id:1, description:'test' }]])
      .mockResolvedValueOnce([[]]);  // deputy lookup empty
    const res = await request(app).post('/api/changes/1/sign');
    expect(res.status).toBe(403);
  });
});

// ── USERS
describe('POST /api/users', () => {
  test('principal can create user', async () => {
    const app = makeApp('principal', [['/api/users', require('../modules/auth/routes/users')]]);
    db.query.mockResolvedValueOnce([{ insertId: 20 }]);
    const res = await request(app).post('/api/users').send({
      username: 'testuser', full_name: 'Test User', role: 'jr_architect', stream: 'design'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('pmc_head cannot create user', async () => {
    const app = makeApp('pmc_head', [['/api/users', require('../modules/auth/routes/users')]]);
    const res = await request(app).post('/api/users').send({
      username: 'x', full_name: 'X', role: 'jr_architect'
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 if username missing', async () => {
    const app = makeApp('principal', [['/api/users', require('../modules/auth/routes/users')]]);
    const res = await request(app).post('/api/users').send({ full_name: 'Test', role: 'jr_architect' });
    expect(res.status).toBe(400);
  });
});

// ── DASHBOARD
describe('GET /api/dashboard', () => {
  test('returns action centre and projects', async () => {
    const app = makeApp('pmc_head', [['/api/dashboard', require('../modules/reporting/routes/dashboard')]]);
    db.query
      .mockResolvedValueOnce([[]])  // overdue queries
      .mockResolvedValueOnce([[]])  // fresh queries
      .mockResolvedValueOnce([[]])  // open flags
      .mockResolvedValueOnce([[]])  // pending approvals
      .mockResolvedValueOnce([[]])  // overdue materials
      .mockResolvedValueOnce([[]])  // pending changes
      .mockResolvedValueOnce([[{ id:1, code:'PV90', name:'PV90', status:'active', r0_end_date:'2026-12-31', open_queries:0, open_flags:0, open_changes:0, drift_days:0, schedule_version:'v1' }]]);
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.action_centre).toBeDefined();
    expect(res.body.projects).toBeDefined();
    expect(res.body.summary).toBeDefined();
  });
});

// ── PROJECT SETUP CHECKLIST
describe('GET /api/project-setup/:id/checklist', () => {
  test('returns checklist, resolves legacy mapping, and blocks arbitrary SQL', async () => {
    const app = makeApp('principal', [['/api/project-setup', require('../modules/onboarding/routes/project-setup')]]);
    
    db.query.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT p.id, p.name, p.setup_template_id')) {
        return [[{ id: 1, name: 'Project Alpha', setup_template_id: 2, template_name: 'Standard' }]];
      }
      if (sql.includes('setup_checklist_items')) {
        return [[
          {
            id: 101,
            task_name: 'Legacy Project Team Assigned',
            task_category: 'core',
            owner_role: 'principal',
            is_mandatory: 1,
            validation_type: 'sql_query',
            validation_config: JSON.stringify({
              query: "SELECT COUNT(DISTINCT role) FROM project_assignments WHERE project_id = ? AND is_active = 1 AND role IN ('pmc_head','design_head','services_head','site_manager')"
            })
          },
          {
            id: 102,
            task_name: 'Malicious SQL check',
            task_category: 'core',
            owner_role: 'principal',
            is_mandatory: 1,
            validation_type: 'sql_query',
            validation_config: JSON.stringify({
              query: "DELETE FROM projects WHERE id = ?"
            })
          },
          {
            id: 103,
            task_name: 'Registry Rule check',
            task_category: 'core',
            owner_role: 'principal',
            is_mandatory: 1,
            validation_type: 'sql_query',
            validation_config: JSON.stringify({
              rule: "r0_schedule_baselined"
            })
          }
        ]];
      }
      if (sql.includes('SELECT COUNT(DISTINCT role) FROM project_assignments') || sql.includes('role IN (\'pmc_head\'')) {
        return [[{ cnt: 1 }]];
      }
      if (sql.includes('SELECT COUNT(*) as cnt FROM schedule_versions')) {
        return [[{ cnt: 0 }]];
      }
      if (sql.includes('INSERT INTO project_setup_tracking')) {
        return [{}];
      }
      return [[]];
    });

    const res = await request(app).get('/api/project-setup/1/checklist');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    
    // Legacy mapping item 101 should run the project_team_assigned rule and succeed
    const item101 = res.body.items.find(i => i.id === 101);
    expect(item101.is_complete).toBe(true);

    // Malicious item 102 should be rejected/ignored and remain incomplete (not executed)
    const item102 = res.body.items.find(i => i.id === 102);
    expect(item102.is_complete).toBe(false);

    // Registry rule item 103 should run r0_schedule_baselined and return false (cnt: 0)
    const item103 = res.body.items.find(i => i.id === 103);
    expect(item103.is_complete).toBe(false);
  });
});

// ── IT ADMIN PROJECT VISIBILITY RESTRICTIONS
describe('IT Admin project access restrictions', () => {
  test('GET /api/projects returns empty project list for it_admin', async () => {
    const app = makeApp('it_admin', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  test('GET /api/projects/:id returns 403 Access Denied for it_admin', async () => {
    const app = makeApp('it_admin', [['/api/projects', require('../modules/onboarding/routes/projects')]]);
    const res = await request(app).get('/api/projects/1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('IT Admin has no project access');
  });
});
