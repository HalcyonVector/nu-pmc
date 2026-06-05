// tests/payment-confirmation-security.test.js — Security tests for payment confirmation file handling
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');
const perms   = require('../middleware/permissions');
const pf      = require('../services/payment-format');
const sm      = require('../services/state-machines');
const fs      = require('fs');
const path    = require('path');

jest.mock('../services/payment-format', () => ({
  parseConfirmationExcel: jest.fn(),
  matchConfirmationsToVendors: jest.fn(),
}));

jest.mock('../modules/onboarding/contract', () => ({
  functions: {
    getEngagementsByIds: jest.fn().mockResolvedValue(new Map([
      [123, { vendor_name: 'Vendor A', vendor_phone: '9876543210', scope: 'Scope A', bank_account: '12345' }]
    ]))
  }
}));

function makeApp(role = 'pmc_head', extraRoutes = []) {
  perms._setCacheForTests([
    { role: 'pmc_head', action: 'payments.confirm', level: 'A' }
  ]);

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  app.use((req, _res, next) => {
    req.session.user = {
      id: 99,
      username: 'test_pmc',
      full_name: 'Test PMC',
      role,
      stream: 'all',
      projects: [{ id: 1, name: 'Test Project' }],
      projects_at: Date.now(),
    };
    next();
  });

  extraRoutes.forEach(([path, router]) => app.use(path, router));
  return app;
}

describe('ICICI Payment Confirmation File Security', () => {
  let app;
  let tempFilePath;

  beforeAll(() => {
    tempFilePath = path.join(__dirname, 'dummy_confirmation.xlsx');
    fs.writeFileSync(tempFilePath, 'dummy excel content');
  });

  afterAll(() => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    
    // Set up a default mock implementation for database queries
    db.query.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT status FROM projects')) {
        return [[{ status: 'active' }]];
      }
      if (sql.includes('SELECT * FROM vendor_payments')) {
        return [[{ id: 1, engagement_id: 123, vendor_id: 456, phone: '9876543210', vendor_name: 'Vendor A' }]];
      }
      return [{ affectedRows: 1 }];
    });
  });

  test('POST /api/payments/:project_id/icici/confirm/preview generates token and conceals path, then confirm applies successfully and deletes token/file', async () => {
    app = makeApp('pmc_head', [['/api/payments', require('../modules/finance/routes/payments')]]);
    const agent = request.agent(app);

    const mockConfirmations = [{ payment_id: 1, amount: 500, utr: 'UTR123', status: 'Success' }];
    pf.parseConfirmationExcel.mockReturnValue(mockConfirmations);
    pf.matchConfirmationsToVendors.mockReturnValue(mockConfirmations);

    // Call preview
    const previewRes = await agent
      .post('/api/payments/1/icici/confirm/preview')
      .attach('confirmation', tempFilePath)
      .field('cycle_id', '123');

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.file_token).toBeDefined();
    expect(previewRes.body.file_path).toBeUndefined(); // Path must not be exposed!

    const fileToken = previewRes.body.file_token;

    // Create a dummy file that represents the uploaded file to satisfy fs.existsSync check in confirm
    const uploadDir = path.dirname(tempFilePath);
    // Since multer generated path is used, but we are mocking the upload, the route sees tempFilePath
    // because we uploaded tempFilePath. But we don't want tempFilePath to be deleted during first apply
    // so let's mock fs.existsSync and fs.unlinkSync.
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const confirmRes = await agent
      .post('/api/payments/1/icici/confirm')
      .send({
        confirmation: 'CONFIRM_PAID',
        file_token: fileToken,
        cycle_id: 123,
        expected_success_count: 1
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);

    // Verify it fails when trying to use the same token again (since it was deleted)
    const secondConfirmRes = await agent
      .post('/api/payments/1/icici/confirm')
      .send({
        confirmation: 'CONFIRM_PAID',
        file_token: fileToken,
        cycle_id: 123,
        expected_success_count: 1
      });

    expect(secondConfirmRes.status).toBe(400);
    expect(secondConfirmRes.body.error).toContain('Invalid or expired');

    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  test('POST /api/payments/:project_id/icici/confirm rejects invalid or expired tokens', async () => {
    app = makeApp('pmc_head', [['/api/payments', require('../modules/finance/routes/payments')]]);
    const agent = request.agent(app);

    const res = await agent
      .post('/api/payments/1/icici/confirm')
      .send({
        confirmation: 'CONFIRM_PAID',
        file_token: 'non-existent-token',
        cycle_id: 123
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or expired');
  });

  test('POST /api/payments/:project_id/icici/confirm rejects files that do not exist', async () => {
    app = makeApp('pmc_head', [['/api/payments', require('../modules/finance/routes/payments')]]);
    const agent = request.agent(app);

    pf.parseConfirmationExcel.mockReturnValue([]);
    pf.matchConfirmationsToVendors.mockReturnValue([]);

    const previewRes = await agent
      .post('/api/payments/1/icici/confirm/preview')
      .attach('confirmation', tempFilePath)
      .field('cycle_id', '123');

    const fileToken = previewRes.body.file_token;

    // Simulate file deletion before confirm is called
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const confirmRes = await agent
      .post('/api/payments/1/icici/confirm')
      .send({
        confirmation: 'CONFIRM_PAID',
        file_token: fileToken,
        cycle_id: 123
      });

    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.error).toContain('Confirmation file not found');

    existsSpy.mockRestore();
  });

  test('POST /api/payments/:project_id/icici/confirm/preview rejects invalid file extensions', async () => {
    app = makeApp('pmc_head', [['/api/payments', require('../modules/finance/routes/payments')]]);
    const agent = request.agent(app);

    // Create a dummy pdf file
    const pdfFilePath = path.join(__dirname, 'dummy_confirmation.pdf');
    fs.writeFileSync(pdfFilePath, 'dummy pdf content');

    const previewRes = await agent
      .post('/api/payments/1/icici/confirm/preview')
      .attach('confirmation', pdfFilePath)
      .field('cycle_id', '123');

    expect(previewRes.status).toBe(400);
    expect(previewRes.body.error).toContain('Invalid file type');

    fs.unlinkSync(pdfFilePath);
  });
});
