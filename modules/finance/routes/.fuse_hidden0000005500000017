// routes/invoices.js — Fee schedule + Proforma Invoices
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth, requirePMC, requirePrincipal, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const xl      = require('../../../middleware/excel');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const sequence = require('../../../services/sequence');
const router  = express.Router();

// GET /api/invoices/:project_id/fee-schedule
router.get('/:project_id/fee-schedule', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head','finance_admin'),
  asyncHandler(async (req, res) => {
    // Role gated by middleware above — no inline role check needed.
    const [items] = await db.query(
      `SELECT * FROM fee_schedule
       WHERE project_id = ? AND is_active = 1
       ORDER BY display_order`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(items.map(i => i.created_by).filter(Boolean));
    items.forEach(i => { i.created_by_name = users.get(i.created_by)?.full_name || null; });
    const total = items.reduce((s, i) => s + parseFloat(i.amount), 0);
    res.json({ items, total });
  }));

// POST /api/invoices/:project_id/fee-schedule/upload — upload Excel from appointment letter
router.post('/:project_id/fee-schedule/upload', requireAuth, requireProjectScope(), requirePrincipal,
  upload.single('fee_schedule'), asyncHandler(async (req, res) => {
    const pid  = req.params.project_id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = await xl.readFile(file.path);

    // Deactivate existing
    await db.query('UPDATE fee_schedule SET is_active = 0 WHERE project_id = ?', [pid]);

    // Optional: client posts contract_value_total to convert percentages to amounts
    const { parseIndianAmount, validateGSTRate } = require('../../../services/payment-validation');
    const contractTotal = parseIndianAmount(req.body.contract_value_total || 0) || 0;

    // Header accessor — strips asterisks, case insensitive
    const pick = (row, ...keys) => {
      for (const k of keys) {
        for (const actualKey of Object.keys(row)) {
          if (actualKey.toLowerCase().replace(/\s*\*/, '').trim() === k.toLowerCase()) {
            const v = row[actualKey];
            if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
          }
        }
      }
      return null;
    };

    let count = 0, skipped = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Accept 'Milestone', 'Milestone Description', 'Stage', 'Description'
      const name = pick(row, 'Milestone Description', 'Milestone', 'Description', 'Stage', 'milestone_name');
      if (!name || name.toLowerCase().startsWith('example:')) { skipped++; continue; }

      // Accept absolute Amount OR Percentage % (convert if contract total given)
      const amtRaw = pick(row, 'Amount', 'amount');
      const pctRaw = pick(row, 'Percentage %', 'Percentage', 'Percent', '%', 'pct');
      let amt = 0;
      if (amtRaw) {
        // parseIndianAmount handles "25,00,000", "₹25,00,000", "2500000", etc.
        amt = parseIndianAmount(amtRaw) || 0;
      } else if (pctRaw && contractTotal > 0) {
        const pct = parseFloat(String(pctRaw).replace(/[^0-9.]/g,''));
        if (!isNaN(pct) && pct >= 0 && pct <= 100) {
          amt = Math.round(contractTotal * pct / 100 * 100) / 100;
        }
      }
      if (!amt || !isFinite(amt) || amt <= 0) {
        skipped++;
        errors.push(`Row ${i+2}: '${name}' — missing or invalid Amount (or Percentage % with contract_value_total)`);
        continue;
      }

      const gstCheck = validateGSTRate(pick(row, 'GST %', 'gst_pct') || '18');
      const gstPct = gstCheck.ok ? gstCheck.pct : 18;

      await db.query(
        'INSERT INTO fee_schedule (project_id, milestone_name, amount, gst_pct, display_order, created_by) VALUES (?,?,?,?,?,?)',
        [pid, name, amt, gstPct, i, req.session.user.id]
      );
      count++;
    }

    audit.log({ userId: req.session.user.id, action: 'fee_schedule.upload',
      entityType: 'fee_schedule', entityId: null,
      details: { project_id: parseInt(pid), items_imported: count, skipped, error_count: errors.length, file_path: req.file?.path }, req });

    res.json({ success: true, items_imported: count, skipped, errors: errors.slice(0, 10) });
  }));

// GET /api/invoices/:project_id/pi — list proforma invoices
router.get('/:project_id/pi', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head','finance_admin'),
  asyncHandler(async (req, res) => {
    // Role gated by middleware above — no inline role check needed.
    const [invoices] = await db.query(
      `SELECT pi.*, fs.milestone_name
       FROM proforma_invoices pi
       JOIN fee_schedule fs ON pi.fee_schedule_id = fs.id
       WHERE pi.project_id = ?
       ORDER BY pi.raised_at DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(invoices.map(i => i.raised_by).filter(Boolean));
    invoices.forEach(i => { i.raised_by_name = users.get(i.raised_by)?.full_name || null; });
    res.json({ invoices });
  }));

// POST /api/invoices/:project_id/pi — raise proforma invoice when payment milestone reached
router.post('/:project_id/pi', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const pid = req.params.project_id;
    const { PICreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(PICreate, req, res);
    if (!body) return;

    // ── CLIENT MASTER GUARD — refuse if client incomplete or missing
    const Onboarding = require('../../onboarding/contract');
    const proj = await Onboarding.functions.getProject(pid);
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    const client = await Onboarding.functions.getClient(pid);
    // Attach fields the rest of the handler expects on `proj`
    proj.master_complete = client?.master_complete ?? null;
    proj.gstin           = client?.gstin || null;
    proj.master_name     = client?.client_name || null;
    if (!proj.client_id) {
      return res.status(400).json({
        error: `Project "${proj.name}" has no client master linked. Ask Finance Admin (finance) to add client "${proj.client}" first.`,
        code: 'CLIENT_NOT_LINKED'
      });
    }
    if (proj.master_complete === 0 || !proj.gstin) {
      return res.status(400).json({
        error: `Client "${proj.master_name}" master is incomplete — GSTIN and Tally ledger not yet set. Finance Admin must complete client master before PI can be raised.`,
        code: 'CLIENT_INCOMPLETE',
        client_id: proj.client_id
      });
    }

    // Get fee schedule item
    const [[fs]] = await db.query('SELECT * FROM fee_schedule WHERE id = ? AND project_id = ?', [body.fee_schedule_id, pid]);
    if (!fs) return res.status(404).json({ error: 'Fee schedule item not found' });

    // Generate PI number atomically — regen on ER_DUP_ENTRY (uq_pi_number UNIQUE already in v3)
    const year = new Date().getFullYear();
    let piNum, result;
    const amtEx  = parseFloat(fs.amount);
    const gstPct = parseFloat(fs.gst_pct);
    const amtGST = Math.round(amtEx * gstPct / 100 * 100) / 100;
    const amtTot = Math.round((amtEx + amtGST) * 100) / 100;

    await sequence.insertWithRetry(async () => {
      piNum = await sequence.generate({
        table: 'proforma_invoices', numberCol: 'pi_number', projectId: pid,
        prefix: `PI/${proj.code}/${year}/`, pad: 3,
      });
      const [r] = await db.query(
        `INSERT INTO proforma_invoices
         (project_id, pi_number, fee_schedule_id, schedule_task_id, amount_ex_gst, gst_pct, amount_gst, amount_total, raised_by, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [pid, piNum, body.fee_schedule_id, body.schedule_task_id, amtEx, gstPct, amtGST, amtTot, req.session.user.id, body.notes]
      );
      result = r;
    });

    // Notify recipients per Decision Event 6 (May 2026):
    // principals (sign off on what's billed to the client)
    // + finance_admins (track invoices/cash)
    // + pmc_heads (run the project being billed)
    try {
      const notif = require('../../../services/notifications');
      const piMsg = `nu PMC: PI ${piNum} raised for ₹${amtTot.toLocaleString('en-IN')} — your acknowledgement needed.`;
      const recipients = [
        ...await users.usersByRole('principal',        'id'),
        ...await users.usersByRole('design_principal', 'id'),
        ...await users.usersByRole('finance_admin',    'id'),
        ...await users.usersByRole('pmc_head',         'id'),
      ];
      // Dedupe — defensive in case a future user holds multiple roles
      const seen = new Set();
      for (const u of recipients) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        await notif.notify(u.id, 'pi_raised', piMsg);
      }
    } catch(_e) { /* notification non-critical */ }

    audit.log({ userId: req.session.user.id, action: 'invoice.pi_raise',
      entityType: 'proforma_invoices', entityId: result.insertId,
      details: { project_id: parseInt(pid), pi_number: piNum, fee_schedule_id: body.fee_schedule_id, schedule_task_id: body.schedule_task_id || null, amount_ex_gst: amtEx, gst_pct: gstPct, amount_total: amtTot }, req });

    res.json({
      success: true,
      id: result.insertId,
      pi_number: piNum,
      amount_total: amtTot,
      message: `PI ${piNum} raised for ₹${amtTot.toLocaleString('en-IN')} — Principal/Design Principal notified.`
    });

  }));

// PATCH /api/invoices/pi/:id/status — update PI status
router.patch('/pi/:id/status', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['draft','sent','acknowledged','paid'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    // Map each status to the single timestamp column it should set.
    // We update only status + that one column, preserving prior timestamps.
    // (Previously this wrote all three timestamp columns every call,
    // NULLing the ones that didn't match the new status — see FinanceAudit 1.2.)
    const TIMESTAMP_COL = { sent: 'sent_at', acknowledged: 'acknowledged_at', paid: 'paid_at' };
    const tsCol = TIMESTAMP_COL[status]; // undefined for 'draft' — intentional

    const [[cur]] = await db.query('SELECT status FROM proforma_invoices WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Proforma invoice not found' });
    if (cur.status === status) return res.json({ success: true });   // idempotent

    const sm = require('../../../services/state-machines').proformaInvoice;
    const extraCols = tsCol ? { [tsCol]: new Date() } : {};
    try {
      await sm.transition({
        id: parseInt(req.params.id), from: cur.status, to: status, extraCols,
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    audit.log({ userId: req.session.user.id, action: 'invoice.pi_status',
      entityType: 'proforma_invoices', entityId: parseInt(req.params.id),
      details: { new_status: status }, req });

    res.json({ success: true });
  }));

module.exports = router;
