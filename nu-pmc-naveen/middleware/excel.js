// middleware/excel.js — ExcelJS wrapper with xlsx-compatible API
// Replaces xlsx (abandoned, high severity CVE) with exceljs (actively maintained)
const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');

/**
 * Read an Excel file and return array of row objects (like XLSX.utils.sheet_to_json)
 * @param {string} filePath
 * @param {object} options — { header: 1 } for array mode
 */
async function readFile(filePath, options = {}) {
  const wb = new ExcelJS.Workbook();
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    await wb.csv.readFile(filePath);
  } else {
    await wb.xlsx.readFile(filePath);
  }
  const ws = wb.worksheets[0];
  if (!ws) return [];

  if (options.header === 1) {
    // Array mode — return array of arrays
    const rows = [];
    ws.eachRow((row) => {
      rows.push(row.values.slice(1)); // slice(1) removes ExcelJS 1-indexed gap
    });
    return rows;
  }

  // Object mode — first row as headers
  const headers = [];
  const rows    = [];
  let first     = true;
  ws.eachRow((row) => {
    const vals = row.values.slice(1);
    if (first) {
      vals.forEach(h => headers.push(String(h || '')));
      first = false;
      return;
    }
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = vals[i] !== undefined ? vals[i] : null;
    });
    rows.push(obj);
  });
  return rows;
}

/**
 * Write a 2D array to an xlsx file (like XLSX.utils.aoa_to_sheet + writeFile)
 * @param {Array[]} data — 2D array
 * @param {string} outPath — output file path
 * @param {string} sheetName
 */
async function writeFile(data, outPath, sheetName = 'Sheet1') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  data.forEach(row => {
    ws.addRow(Array.isArray(row) ? row : [row]);
  });
  await wb.xlsx.writeFile(outPath);
}

/**
 * Write multiple sheets to an xlsx file
 * @param {object} sheets — { sheetName: [[row]] }
 * @param {string} outPath
 */
async function writeMultiSheet(sheets, outPath) {
  const wb = new ExcelJS.Workbook();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    data.forEach((row, i) => {
      if (!row || (Array.isArray(row) && row.length === 0)) {
        ws.addRow([]);
        return;
      }
      const r = ws.addRow(Array.isArray(row) ? row : [row]);
      // Header row (first non-empty)
      if (i === 0) {
        r.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3D62' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        r.height = 20;
      }
      // Totals row
      if (Array.isArray(row) && String(row[0]).toUpperCase().startsWith('TOTAL')) {
        r.eachCell(cell => {
          cell.font = { bold: true, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } };
        });
      }
    });
    // Auto-width columns
    ws.columns.forEach(col => {
      let max = 10;
      col.eachCell({ includeEmpty: false }, cell => {
        const len = String(cell.value || '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 40);
    });
  }
  await wb.xlsx.writeFile(outPath);
}

module.exports = { readFile, writeFile, writeMultiSheet, ExcelJS };
