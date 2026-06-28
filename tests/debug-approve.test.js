jest.mock('sharp', () => jest.fn(() => ({})));
jest.mock('../services/approvals', () => ({
  open: jest.fn(), pendingForUser: jest.fn(), vote: jest.fn(), cancel: jest.fn(), get: jest.fn(),
  ApprovalError: class ApprovalError extends Error {}
}));

const db = require('../middleware/db');

test('approve route debug', async () => {
  const request = require('supertest');
  const express = require('express');
  const session = require('express-session');
  const router = require('../modules/workflow/routes/approvals');

  const routes = router.stack
    .filter(l => l.route)
    .map(l => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
  console.log('Routes:', routes);

  db.query.mockReset();
  db.query.mockResolvedValueOnce([[{ id:1, request_type:'sc', project_id:1, ref_table:'other', ref_id:2 }]]);
  db.query.mockResolvedValueOnce([[]]); // users

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = { id: 1, role: 'principal', stream: 'all', projects: [], projects_at: Date.now() };
    next();
  });
  app.use('/api/approvals', router);

  const res = await request(app).post('/api/approvals/1/approve');
  console.log('Status:', res.status, 'Body:', JSON.stringify(res.body));
  console.log('db.query call count:', db.query.mock.calls.length);
  db.query.mock.calls.forEach((c, i) => console.log(`  [${i}]:`, c[0].slice(0, 70)));
});
