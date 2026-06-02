// tests/validation.test.js — Input validation middleware tests
const { makeValidator, isPositiveNumber, isPositiveInteger,
        isPercentage, isValidDate, isValidGSTIN, isValidPAN,
        isValidHSN, validators } = require('../middleware/validate');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
const next = jest.fn();
beforeEach(() => jest.clearAllMocks());

// ── PRIMITIVE VALIDATORS
describe('isPositiveNumber', () => {
  test('accepts valid numbers',    () => { expect(isPositiveNumber(100)).toBe(true); });
  test('accepts decimal numbers',  () => { expect(isPositiveNumber(32.5)).toBe(true); });
  test('accepts zero',             () => { expect(isPositiveNumber(0)).toBe(true); });
  test('accepts string number',    () => { expect(isPositiveNumber('4200')).toBe(true); });
  test('rejects text',             () => { expect(isPositiveNumber('abc')).toBe(false); });
  test('rejects empty string',     () => { expect(isPositiveNumber('')).toBe(false); });
  test('rejects null',             () => { expect(isPositiveNumber(null)).toBe(false); });
  test('rejects NaN',              () => { expect(isPositiveNumber(NaN)).toBe(false); });
  test('rejects Infinity',         () => { expect(isPositiveNumber(Infinity)).toBe(false); });
  test('rejects mixed text+num',   () => { expect(isPositiveNumber('32abc')).toBe(false); });
});

describe('isPositiveInteger', () => {
  test('accepts integer', () => { expect(isPositiveInteger(5)).toBe(true); });
  test('accepts string integer', () => { expect(isPositiveInteger('5')).toBe(true); });
  test('rejects zero',    () => { expect(isPositiveInteger(0)).toBe(false); });
  test('rejects decimal', () => { expect(isPositiveInteger(3.5)).toBe(false); });
  test('rejects text',    () => { expect(isPositiveInteger('abc')).toBe(false); });
  test('rejects negative',() => { expect(isPositiveInteger(-1)).toBe(false); });
});

describe('isPercentage', () => {
  test('accepts 0',     () => { expect(isPercentage(0)).toBe(true); });
  test('accepts 100',   () => { expect(isPercentage(100)).toBe(true); });
  test('accepts 74.5',  () => { expect(isPercentage(74.5)).toBe(true); });
  test('rejects -1',    () => { expect(isPercentage(-1)).toBe(false); });
  test('rejects 101',   () => { expect(isPercentage(101)).toBe(false); });
  test('rejects 150',   () => { expect(isPercentage(150)).toBe(false); });
  test('rejects text',  () => { expect(isPercentage('abc')).toBe(false); });
  test('rejects empty', () => { expect(isPercentage('')).toBe(false); });
});

describe('isValidDate', () => {
  test('accepts valid date',        () => { expect(isValidDate('2026-04-12')).toBe(true); });
  test('accepts leap day',          () => { expect(isValidDate('2024-02-29')).toBe(true); });
  test('rejects invalid leap day',  () => { expect(isValidDate('2023-02-29')).toBe(false); });
  test('rejects wrong format',      () => { expect(isValidDate('12/04/2026')).toBe(false); });
  test('rejects text',              () => { expect(isValidDate('abc')).toBe(false); });
  test('rejects month 13',          () => { expect(isValidDate('2026-13-01')).toBe(false); });
  test('rejects day 32',            () => { expect(isValidDate('2026-04-32')).toBe(false); });
  test('rejects empty',             () => { expect(isValidDate('')).toBe(false); });
});

describe('isValidGSTIN', () => {
  test('accepts valid GSTIN',       () => { expect(isValidGSTIN('29AAVFN2055K1ZM')).toBe(true); });
  test('accepts valid GSTIN lower', () => { expect(isValidGSTIN('29aavfn2055k1zm')).toBe(true); });
  test('rejects short GSTIN',       () => { expect(isValidGSTIN('29AAVFN')).toBe(false); });
  test('rejects empty',             () => { expect(isValidGSTIN('')).toBe(false); });
  test('rejects null',              () => { expect(isValidGSTIN(null)).toBe(false); });
  test('rejects wrong state code',  () => { expect(isValidGSTIN('99AAVFN2055K1ZM')).toBe(false); });
  test('rejects without Z',         () => { expect(isValidGSTIN('29AAVFN2055K1AM')).toBe(false); });
});

describe('isValidPAN', () => {
  test('accepts valid PAN',   () => { expect(isValidPAN('AAVFN2055K')).toBe(true); });
  test('rejects lowercase',   () => { expect(isValidPAN('aavfn2055k')).toBe(false); });
  test('rejects short PAN',   () => { expect(isValidPAN('AAVFN')).toBe(false); });
  test('rejects with space',  () => { expect(isValidPAN('AAVFN 2055K')).toBe(false); });
});

describe('isValidHSN', () => {
  test('accepts 4-digit HSN',  () => { expect(isValidHSN('9954')).toBe(true); });
  test('accepts 8-digit HSN',  () => { expect(isValidHSN('99540000')).toBe(true); });
  test('accepts empty string', () => { expect(isValidHSN('')).toBe(true); }); // optional
  test('accepts undefined',    () => { expect(isValidHSN(undefined)).toBe(true); });
  test('rejects 3-digit HSN',  () => { expect(isValidHSN('999')).toBe(false); });
  test('rejects letters',      () => { expect(isValidHSN('ABCD')).toBe(false); });
  test('rejects alphanumeric', () => { expect(isValidHSN('9954AB')).toBe(false); });
});

// ── VALIDATOR MIDDLEWARE
describe('validators.taskUpdate', () => {
  test('passes valid task update', () => {
    const req = { body: { task_id: 5, pct_complete: 75, report_date: '2026-04-12' } };
    validators.taskUpdate(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects missing task_id', () => {
    const res = mockRes();
    validators.taskUpdate({ body: { pct_complete: 75, report_date: '2026-04-12' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects pct_complete > 100', () => {
    const res = mockRes();
    validators.taskUpdate({ body: { task_id: 5, pct_complete: 150, report_date: '2026-04-12' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
  });

  test('rejects negative pct_complete', () => {
    const res = mockRes();
    validators.taskUpdate({ body: { task_id: 5, pct_complete: -5, report_date: '2026-04-12' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects text in pct_complete', () => {
    const res = mockRes();
    validators.taskUpdate({ body: { task_id: 5, pct_complete: 'done', report_date: '2026-04-12' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects invalid date format', () => {
    const res = mockRes();
    validators.taskUpdate({ body: { task_id: 5, pct_complete: 75, report_date: '12/04/2026' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects text in task_id', () => {
    const res = mockRes();
    validators.taskUpdate({ body: { task_id: 'five', pct_complete: 75, report_date: '2026-04-12' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validators.materialRequest', () => {
  test('passes valid request', () => {
    const req = { body: { boq_item_id: 5, quantity_needed: 50, needed_by_date: '2026-04-20' } };
    validators.materialRequest(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects zero quantity', () => {
    const res = mockRes();
    validators.materialRequest({ body: { boq_item_id: 5, quantity_needed: 0, needed_by_date: '2026-04-20' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects text in quantity', () => {
    const res = mockRes();
    validators.materialRequest({ body: { boq_item_id: 5, quantity_needed: 'fifty', needed_by_date: '2026-04-20' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects negative quantity', () => {
    const res = mockRes();
    validators.materialRequest({ body: { boq_item_id: 5, quantity_needed: -10, needed_by_date: '2026-04-20' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validators.clientMaster', () => {
  const validClient = {
    client_name: 'TLD MAINI GSE Pvt Ltd',
    gstin: '27AAACT1234F1Z5',
    state_code: 27,
    state_name: 'Maharashtra'
  };

  test('passes valid client', () => {
    validators.clientMaster({ body: validClient }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects invalid GSTIN', () => {
    const res = mockRes();
    validators.clientMaster({ body: { ...validClient, gstin: 'BADGSTIN' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.arrayContaining([expect.stringContaining('gstin')])
    }));
  });

  test('rejects missing client_name', () => {
    const res = mockRes();
    const { client_name, ...body } = validClient;
    validators.clientMaster({ body }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects state_code 0', () => {
    const res = mockRes();
    validators.clientMaster({ body: { ...validClient, state_code: 0 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects state_code 99 (out of range)', () => {
    const res = mockRes();
    validators.clientMaster({ body: { ...validClient, state_code: 99 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validators.paymentRequest', () => {
  test('passes valid payment', () => {
    const req = { body: {
      payment_type: 'running_account_bill',
      amount_requested: 555000,
      week_ending: '2026-04-12'
    }};
    validators.paymentRequest(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects invalid payment type', () => {
    const res = mockRes();
    validators.paymentRequest({ body: {
      payment_type: 'cheque', amount_requested: 100000, week_ending: '2026-04-12'
    }}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects zero amount', () => {
    const res = mockRes();
    validators.paymentRequest({ body: {
      payment_type: 'advance', amount_requested: 0, week_ending: '2026-04-12'
    }}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects text in amount', () => {
    const res = mockRes();
    validators.paymentRequest({ body: {
      payment_type: 'advance', amount_requested: 'lots', week_ending: '2026-04-12'
    }}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validators.drawingQuery', () => {
  test('passes valid query', () => {
    validators.drawingQuery(
      { body: { question: 'What is the slab thickness at grid C3?' } },
      mockRes(), next
    );
    expect(next).toHaveBeenCalled();
  });

  test('rejects empty question', () => {
    const res = mockRes();
    validators.drawingQuery({ body: { question: '' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects question too short (< 10 chars)', () => {
    const res = mockRes();
    validators.drawingQuery({ body: { question: 'Slab?' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validators.changeNotice', () => {
  test('passes valid CN', () => {
    validators.changeNotice({ body: {
      title: 'Cable tray route change',
      description: 'Client requested cable tray to be re-routed below mezzanine slab',
      source: 'client'
    }}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects invalid source', () => {
    const res = mockRes();
    validators.changeNotice({ body: {
      title: 'Test', description: 'Some description here',
      source: 'consultant'
    }}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects negative schedule impact', () => {
    const res = mockRes();
    validators.changeNotice({ body: {
      title: 'Test', description: 'Some description here',
      schedule_impact_days: -5
    }}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validators.hsnCode', () => {
  test('passes 4-digit HSN', () => {
    validators.hsnCode({ body: { hsn_code: '9954' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('passes empty HSN (optional)', () => {
    validators.hsnCode({ body: { hsn_code: '' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('passes missing HSN (optional)', () => {
    validators.hsnCode({ body: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects 3-digit HSN', () => {
    const res = mockRes();
    validators.hsnCode({ body: { hsn_code: '999' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects letters in HSN', () => {
    const res = mockRes();
    validators.hsnCode({ body: { hsn_code: 'ABCD' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── EDGE CASES — IDIOT PROOFING
describe('Edge cases — idiot proofing', () => {
  test('percentage: string "75%" rejected (no % symbol allowed)', () => {
    expect(isPercentage('75%')).toBe(false);
  });

  test('number: "1,000" rejected (Indian comma format in input not allowed)', () => {
    expect(isPositiveNumber('1,000')).toBe(false); // use raw number, not formatted
  });

  test('date: "April 12 2026" rejected (must be YYYY-MM-DD)', () => {
    expect(isValidDate('April 12 2026')).toBe(false);
  });

  test('GSTIN: spaces are trimmed and normalised', () => {
    expect(isValidGSTIN(' 29AAVFN2055K1ZM ')).toBe(true);
  });

  test('task_id: floating point rejected as non-integer', () => {
    expect(isPositiveInteger(5.5)).toBe(false);
  });

  test('quantity: very small decimal accepted (0.001)', () => {
    expect(isPositiveNumber(0.001)).toBe(true);
  });

  test('amount: very large crore amount accepted', () => {
    expect(isPositiveNumber(100000000)).toBe(true); // 10 crore
  });
});
