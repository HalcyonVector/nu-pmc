// tests/middleware.test.js
const { requireAuth, requireRole, requirePrincipal, requirePMC,
        canApproveDrawing, canApproveSchedule } = require('../middleware/auth');

function mockReq(role, stream='all') {
  return { session: { user: { id: 1, role, stream, username: 'test' } } };
}
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
const next = jest.fn();

describe('requireAuth', () => {
  beforeEach(() => jest.clearAllMocks());

  test('passes with valid session', () => {
    requireAuth(mockReq('principal'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks with no session', () => {
    const res = mockRes();
    requireAuth({ session: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks with null session', () => {
    const res = mockRes();
    requireAuth({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requirePrincipal', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows principal', () => {
    requirePrincipal(mockReq('principal'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('allows design_principal', () => {
    requirePrincipal(mockReq('design_principal'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks pmc_head', () => {
    const res = mockRes();
    requirePrincipal(mockReq('pmc_head'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks site_manager', () => {
    const res = mockRes();
    requirePrincipal(mockReq('site_manager'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('blocks design_head', () => {
    const res = mockRes();
    requirePrincipal(mockReq('design_head'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requirePMC', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows principal', () => {
    requirePMC(mockReq('principal'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('allows pmc_head', () => {
    requirePMC(mockReq('pmc_head'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks site_manager', () => {
    const res = mockRes();
    requirePMC(mockReq('site_manager'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('blocks detailing', () => {
    const res = mockRes();
    requirePMC(mockReq('detailing'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('canApproveDrawing', () => {
  test('principal can approve anything at any level', () => {
    expect(canApproveDrawing({ role:'principal' }, { stream:'design', status:'pending_l1' })).toBe(true);
    expect(canApproveDrawing({ role:'principal' }, { stream:'services', status:'pending_l2' })).toBe(true);
  });

  test('design_head can approve design at L2', () => {
    expect(canApproveDrawing({ role:'design_head' }, { stream:'design', status:'pending_l2' })).toBe(true);
  });

  test('design_head cannot approve design at L1', () => {
    expect(canApproveDrawing({ role:'design_head' }, { stream:'design', status:'pending_l1' })).toBe(false);
  });

  test('team_lead can approve design at L1', () => {
    expect(canApproveDrawing({ role:'team_lead' }, { stream:'design', status:'pending_l1' })).toBe(true);
  });

  test('team_lead cannot approve services', () => {
    expect(canApproveDrawing({ role:'team_lead' }, { stream:'services', status:'pending_l1' })).toBe(false);
  });

  test('services_head can approve services at L1', () => {
    expect(canApproveDrawing({ role:'services_head' }, { stream:'services', status:'pending_l1' })).toBe(true);
  });

  test('services_head cannot approve design stream', () => {
    expect(canApproveDrawing({ role:'services_head' }, { stream:'design', status:'pending_l1' })).toBe(false);
  });

  test('site_manager cannot approve anything', () => {
    expect(canApproveDrawing({ role:'site_manager' }, { stream:'design', status:'pending_l1' })).toBe(false);
  });

  test('pmc_head cannot approve drawings', () => {
    expect(canApproveDrawing({ role:'pmc_head' }, { stream:'design', status:'pending_l1' })).toBe(false);
  });
});

describe('canApproveSchedule', () => {
  test('principal can approve any drift', () => {
    expect(canApproveSchedule({ role:'principal' }, 10)).toBe(true);
    expect(canApproveSchedule({ role:'principal' }, 0)).toBe(true);
  });

  test('design_principal cannot approve schedule (Principal only)', () => {
    expect(canApproveSchedule({ role:'design_principal' }, 2)).toBe(false);
  });

  test('pmc_head cannot approve any drift', () => {
    expect(canApproveSchedule({ role:'pmc_head' }, 0)).toBe(false);
    expect(canApproveSchedule({ role:'pmc_head' }, 3)).toBe(false);
    expect(canApproveSchedule({ role:'pmc_head' }, 4)).toBe(false);
  });

  test('site_manager cannot approve any drift', () => {
    expect(canApproveSchedule({ role:'site_manager' }, 1)).toBe(false);
  });

  test('design_head cannot approve schedule changes', () => {
    expect(canApproveSchedule({ role:'design_head' }, 2)).toBe(false);
  });
});

describe('requireRole', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows matching role', () => {
    requireRole('principal', 'design_principal')(mockReq('principal'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks non-matching role', () => {
    const res = mockRes();
    requireRole('principal')(mockReq('site_manager'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
