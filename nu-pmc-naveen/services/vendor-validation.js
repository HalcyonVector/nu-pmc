// services/vendor-validation.js
// GSTIN retry queue + TAN validation

const http = require('./http');

/**
 * Validate GSTIN with retry queue on failure
 * Returns { valid, data, queued }
 */
async function validateGSTIN(db, gstin, vendorId) {
  if (!gstin || gstin.length !== 15) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }

  try {
    // Call government GSTIN API
    const res = await http.get(
      'https://api.gstin.org/v1/validate/' + gstin,
      { headers: { 'Authorization': 'Bearer ' + (process.env.GSTIN_API_KEY||'') }, timeout: 5000 }
    );
    if (res.data?.status === 'Active') {
      return { valid: true, data: res.data, queued: false };
    }
    return { valid: false, error: 'GSTIN inactive or not found', queued: false };
  } catch (err) {
    // API down — queue for retry
    console.log('[GSTIN] API unavailable — queuing for retry:', gstin);
    try {
      await db.query(
        `INSERT INTO validation_retry_queue (entity_type, entity_id, validation_type, value, retry_count)
         VALUES ('vendor', ?, 'gstin', ?, 0)
         ON DUPLICATE KEY UPDATE retry_count=retry_count+1, updated_at=NOW()`,
        [vendorId, gstin]
      );
    } catch (_e) { /* non-blocking */ }
    return { valid: null, queued: true, message: 'GSTIN queued for validation — will retry automatically' };
  }
}

/**
 * Validate TAN for vendors above ₹30,000
 * TAN format: AAAA99999A (4 letters, 5 digits, 1 letter)
 */
async function validateTAN(tan) {
  if (!tan) return { valid: false, error: 'TAN not provided' };
  const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
  if (!tanRegex.test(tan.toUpperCase())) {
    return { valid: false, error: 'TAN format invalid — expected format: AAAA99999A' };
  }
  return { valid: true, tan: tan.toUpperCase() };
}

/**
 * Process retry queue — called by overdue-checker periodically
 */
async function processRetryQueue(db) {
  const [pending] = await db.query(
    "SELECT * FROM validation_retry_queue WHERE status='pending' AND retry_count < 5 ORDER BY created_at LIMIT 20"
  );

  for (const item of pending) {
    try {
      let result;
      if (item.validation_type === 'gstin') {
        result = await validateGSTIN(db, item.value, item.entity_id);
      }

      if (result?.valid === true) {
        await db.query(
          "UPDATE validation_retry_queue SET status='resolved', resolved_at=NOW() WHERE id=?",
          [item.id]
        );
        // Update vendor record
        await db.query(
          "UPDATE vendors SET gst_number=?, gstin_validated=1, gstin_validated_at=NOW() WHERE id=?",
          [item.value, item.entity_id]
        );
      } else if (result?.valid === false) {
        await db.query(
          "UPDATE validation_retry_queue SET status='failed', error=? WHERE id=?",
          [result.error, item.id]
        );
      } else {
        // Still unavailable — increment retry
        await db.query(
          "UPDATE validation_retry_queue SET retry_count=retry_count+1, updated_at=NOW() WHERE id=?",
          [item.id]
        );
      }
    } catch (_e) { /* non-blocking */ }
  }
}

module.exports = { validateGSTIN, validateTAN, processRetryQueue };
