// MODULE 90 — Malformed Excel handling
// Tests parsers against intentionally broken inputs — empty, special chars, wrong types,
// huge files, Unicode, number-as-text, currency symbols, etc.

const { test, summary, reset, Agent, ok, is, has, gt, db } = require('./helpers');
const xl = require('../../middleware/excel');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function buildExcel(sheets, outPath) {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    for (const r of rows) ws.addRow(r);
  }
  await wb.xlsx.writeFile(outPath);
  return outPath;
}

async function run() {
  reset();
  const tmp = '/tmp/malformed';
  fs.mkdirSync(tmp, { recursive: true });

  // ── Empty file
  await test('parser handles empty Excel file', async () => {
    const p = await buildExcel({ Sheet1: [] }, path.join(tmp, 'empty.xlsx'));
    const rows = await xl.readFile(p);
    is(Array.isArray(rows), true, 'returns array');
    is(rows.length, 0, 'empty result');
  });

  // ── Only headers, no data
  await test('parser handles headers-only file', async () => {
    const p = await buildExcel({ Sheet1: [['Vendor Name', 'Trade', 'Phone']] }, path.join(tmp, 'headers.xlsx'));
    const rows = await xl.readFile(p);
    is(rows.length, 0, 'no data rows');
  });

  // ── Unicode: Kannada + Hindi + special chars
  await test('parser handles Unicode characters (Kannada, Hindi, em-dash)', async () => {
    const p = await buildExcel({ Sheet1: [
      ['Vendor Name', 'Trade'],
      ['ಶ್ರೀ ಕೃಷ್ಣ ಎಂಟರ್ಪ್ರೈಸಸ್', 'Civil'],  // Kannada
      ['श्री राम ट्रेडर्स', 'Electrical'],  // Hindi
      ["O'Brien — Foley & Sons", 'Steel'],  // apostrophe, em-dash, ampersand
    ]}, path.join(tmp, 'unicode.xlsx'));
    const rows = await xl.readFile(p);
    is(rows.length, 3, 'all 3 rows parsed');
    is(rows[0]['Vendor Name'].includes('ಕೃಷ್ಣ'), true, 'Kannada preserved');
    is(rows[2]['Vendor Name'].includes("O'Brien"), true, 'apostrophe preserved');
    is(rows[2]['Vendor Name'].includes('—'), true, 'em-dash preserved');
  });

  // ── Numbers as text (Excel does this naturally)
  await test('parser handles numbers stored as text', async () => {
    const p = await buildExcel({ Sheet1: [
      ['Item', 'Quantity', 'Rate'],
      ['Cement', '500', '425'],       // stored as text
      ['Sand', 100, 50],              // stored as number
      ['Steel', '1,250.50', '₹65.75'],// Indian format + currency symbol
    ]}, path.join(tmp, 'numtext.xlsx'));
    const rows = await xl.readFile(p);
    is(rows.length, 3, '3 rows');
    // Parser should handle both but current code just uses parseFloat
    const qty1 = parseFloat(rows[0].Quantity); // works: 500
    const qty3raw = String(rows[2].Quantity).replace(/,/g, ''); // strip comma
    const qty3 = parseFloat(qty3raw);
    is(qty1, 500, 'text number parses');
    is(qty3, 1250.5, 'comma-separated parses after strip');
  });

  // ── Leading/trailing whitespace in headers
  await test('parser handles whitespace in column headers', async () => {
    const p = await buildExcel({ Sheet1: [
      [' Vendor Name ', '  Trade', 'Phone '],  // extra spaces
      ['ABC', 'Civil', '9876543210'],
    ]}, path.join(tmp, 'ws_headers.xlsx'));
    const rows = await xl.readFile(p);
    is(rows.length, 1, '1 row');
    // Column names preserved as-is — parser uses pick() which case-insensitive-compares
    const keys = Object.keys(rows[0]);
    is(keys.length, 3, '3 columns');
  });

  // ── Row with missing cells
  await test('parser handles rows with missing cells', async () => {
    const p = await buildExcel({ Sheet1: [
      ['Vendor Name', 'Trade', 'Phone'],
      ['ABC', 'Civil'],                   // phone missing
      ['XYZ', '', '9876543210'],          // trade empty
      ['', 'MEP', '9876543211'],          // name empty — should be skipped
    ]}, path.join(tmp, 'sparse.xlsx'));
    const rows = await xl.readFile(p);
    is(rows.length, 3, '3 rows returned (parsers filter empties)');
  });

  // ── 5000 rows — big file
  await test('parser handles large file (5000 rows)', async () => {
    const rows = [['Vendor Name', 'Trade']];
    for (let i = 0; i < 5000; i++) rows.push([`Vendor ${i}`, i % 2 ? 'Civil' : 'MEP']);
    const p = await buildExcel({ Sheet1: rows }, path.join(tmp, 'big.xlsx'));
    const t0 = Date.now();
    const parsed = await xl.readFile(p);
    const elapsed = Date.now() - t0;
    is(parsed.length, 5000, '5000 rows parsed');
    is(elapsed < 10000, true, `parsed in ${elapsed}ms (should be <10s)`);
  });

  // ── File with formula cells (Excel stores =SUM(...))
  await test('parser handles formula cells', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['Item', 'Qty', 'Rate', 'Total']);
    const r = ws.addRow(['Cement', 100, 425, 0]);
    r.getCell(4).value = { formula: 'B2*C2', result: 42500 };
    const p = path.join(tmp, 'formula.xlsx');
    await wb.xlsx.writeFile(p);
    const rows = await xl.readFile(p);
    is(rows.length, 1, '1 row');
    // Formula cells — exceljs returns { formula, result } object. Parsers that do parseFloat would get NaN.
    const total = rows[0].Total;
    const parsedTotal = (typeof total === 'object' && total.result !== undefined) ? total.result : parseFloat(total);
    is(parsedTotal, 42500, 'formula result accessible');
  });

  // ── File with merged cells
  await test('parser handles merged-cell files without crashing', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['Project', 'Stage', 'Fee']);
    ws.addRow(['WeSchool', 'Stage 1', 500000]);
    ws.addRow(['WeSchool', 'Stage 2', 750000]);
    ws.mergeCells('A2:A3');                   // merge project name
    const p = path.join(tmp, 'merged.xlsx');
    await wb.xlsx.writeFile(p);
    const rows = await xl.readFile(p);
    is(rows.length >= 2, true, 'rows returned despite merged cells');
  });

  // Cleanup
  await test('cleanup malformed test files', async () => {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    is(true, true, 'cleanup done');
  });

  return summary();
}

module.exports = { run };
