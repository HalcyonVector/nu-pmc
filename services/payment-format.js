// services/payment-format.js — Bank payment format abstraction
// Current bank: ICICI Corporate Net Banking
// Alternatives: HDFC, SBI, Axis — swap formats here only

const xl   = require('../middleware/excel');
const path = require('path');

// Bank chosen by env so we can swap providers (HDFC, SBI, Axis) without
// redeploy. Read at call time — same pattern as matrix-adapter._env().
function _bank() { return process.env.PAYMENT_BANK || 'icici'; }

// ── BANK FORMAT DEFINITIONS
const formats = {
  icici: {
    // ICICI Corporate Internet Banking — PAB bulk payment format
    // Verified against: 16042026_LLP_Vendors_Payment.xls
    headers: [
      'PYMT_PROD_TYPE_CODE','PYMT_MODE','DEBIT_ACC_NO','BNF_NAME',
      'BENE_ACC_NO','BENE_IFSC','AMOUNT','DEBIT_NARR','CREDIT_NARR',
      'MOBILE_NUM','EMAIL_ID','REMARK','PYMT_DATE','REF_NO',
      'ADDL_INFO1','ADDL_INFO2','ADDL_INFO3','ADDL_INFO4','ADDL_INFO5',
    ],

    buildRow: (idx, vendor, engagement, payment, projectCode, date, debitAcc) => {
      const ifsc = (vendor.bank_ifsc || '').toUpperCase();
      // FT = same-bank ICICI transfer; NEFT = all other banks
      const mode = ifsc.startsWith('ICIC') ? 'FT' : 'NEFT';
      if (!debitAcc) throw new Error('debitAcc is required — read from company_entities via the project entity_id');
      return [
        'PAB_VENDOR',          // PYMT_PROD_TYPE_CODE — fixed
        mode,                  // PYMT_MODE — auto from IFSC
        debitAcc,              // DEBIT_ACC_NO — nu associates LLP account
        vendor.vendor_name,    // BNF_NAME
        vendor.bank_account,   // BENE_ACC_NO
        ifsc,                  // BENE_IFSC
        payment.recommended_amount, // AMOUNT — number, no symbol
        '',                    // DEBIT_NARR — blank
        '',                    // CREDIT_NARR — blank
        '',                    // MOBILE_NUM
        '',                    // EMAIL_ID
        '',                    // REMARK
        date,                  // PYMT_DATE — DD-MM-YYYY
        '',                    // REF_NO
        '',                    // ADDL_INFO1
        '',                    // ADDL_INFO2
        '',                    // ADDL_INFO3
        '',                    // ADDL_INFO4
        '',                    // ADDL_INFO5
      ];
    },

    parseRows: (rows) => {
      // ICICI confirmation UTR report — varies by portal version
      const results = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const utr = String(row[13] || '').trim();
        // ICICI sets REF_NO (col 13) to the UTR once payment succeeds.
        // If UTR is present → success; if empty → failed/pending.
        const status = utr ? 'success' : 'pending';
        results.push({
          transaction_id:   String(row[0] || ''),
          beneficiary_name: String(row[3] || ''), // BNF_NAME
          account_number:   String(row[4] || ''), // BENE_ACC_NO
          amount:           parseFloat(String(row[6] || '0').replace(/,/g, '')) || 0,
          status,
          utr,
          payment_date:     String(row[12] || ''), // PYMT_DATE
        });
      }
      return results;
    },
  },
  // ── HDFC (future)
  // hdfc: { headers: [...], buildRow: ..., parseRows: ... },
};

/**
 * Generate bulk payment Excel for bank upload.
 * @param {Array}  payments     array of {vendor, engagement, payment}
 * @param {string} projectCode
 * @param {string} date         DD-MM-YYYY
 * @param {string} debitAccount nu associates bank account number — read from
 *                              company_entities.bank_account_no via project entity_id.
 *                              Never hardcoded; never has a default.
 * @returns {Promise<string>} file path
 */
async function generateBulkPaymentExcel(payments, projectCode, date, debitAccount) {
  if (!debitAccount) throw new Error('debitAccount required — fetch from company_entities');
  const fmt = formats[_bank()];
  if (!fmt) throw new Error(`Unknown bank format: ${_bank()}`);

  const data = [fmt.headers];
  payments.forEach((p, i) => {
    if (!p.payment.recommended_amount || p.payment.recommended_amount <= 0) return;
    data.push(fmt.buildRow(i + 1, p.vendor, p.engagement, p.payment, projectCode, date, debitAccount));
  });

  const outPath = path.join(process.env.UPLOAD_DIR || require('os').tmpdir(),
    `payment_${projectCode}_${Date.now()}.xlsx`);
  await xl.writeFile(data, outPath, 'Bulk Payment');
  return outPath;
}

/**
 * Parse bank confirmation report
 * @returns {Promise<Array>}
 */
async function parseConfirmationExcel(filePath) {
  const fmt = formats[_bank()];
  if (!fmt) throw new Error(`Unknown bank format: ${_bank()}`);
  const rows = await xl.readFile(filePath, { header: 1 });
  return fmt.parseRows(rows);
}

/**
 * Match confirmation results to vendor payments by account number
 */
function matchConfirmationsToVendors(confirmations, payments) {
  return confirmations.map(conf => {
    const matched = payments.find(p =>
      p.vendor.bank_account &&
      p.vendor.bank_account.replace(/\s/g, '') === conf.account_number.replace(/\s/g, '')
    );
    return {
      ...conf,
      vendor_id:     matched?.vendor?.id     || null,
      vendor_name:   matched?.vendor?.vendor_name || conf.beneficiary_name,
      engagement_id: matched?.engagement?.id || null,
      payment_id:    matched?.payment?.id    || null,
      matched:       !!matched,
    };
  });
}

// `currentBank` is exposed as a FUNCTION (was previously a string captured at
// module-load). No external callers as of this edit — if you add one, call it
// with parens: `payment.currentBank()`. The function form lets env changes to
// PAYMENT_BANK take effect without restart.
module.exports = { generateBulkPaymentExcel, parseConfirmationExcel, matchConfirmationsToVendors, currentBank: _bank };
