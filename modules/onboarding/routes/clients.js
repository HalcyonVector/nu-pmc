// routes/clients.js — Client master (Finance Admin/finance manages)
const express = require('express');
const db      = require('../../../middleware/db');
const path    = require('path');
const fs      = require('fs');
const { requireAuth } = require('../../../middleware/auth');
const { validators } = require('../../../middleware/validate');
const dateUtil = require('../../../services/date-util');
const router   = express.Router();
const fuzzy    = require('../../../services/fuzzy-match');
const xl       = require('../../../middleware/excel');
const { upload } = require('../../../middleware/upload');
const users   = require('../../../services/users-lookup');

// Only Principal, Design Principal, and Finance Admin (finance role) can access
const { can } = require('../../../middleware/permissions');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const sequence = require('../../../services/sequence');

// XML-escape user-controlled strings before interpolating into the Tally
// envelope. Without this, a discipline like "Civil & Plumbing" or an
// item_name containing < > " breaks the XML parse on Tally's side.
function escapeXml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Restrict a string to safe filename characters. Used when constructing a
// path from user-controlled fields (project_code, ra_bill_number) — without
// this a "../" sequence would let the path escape the upload directory.
function safeFileSegment(s) {
  return String(s || '').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 50);
}

// GET /api/clients — list all clients
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    // Audit role has universal read access; everyone else must hold clients.read
    // (design/services/PMC/finance/principals can see the master list to pick
    // a client when starting a project. Editing the master is a separate gate.)
    const canSee = me.role === 'audit' || (await can(me.role, 'clients.read'));
    if (!canSee) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const [clients] = await db.query(
      'SELECT * FROM clients WHERE is_active = 1 ORDER BY client_name'
    );
    res.json({ clients });
  }));

// POST /api/clients — create client master
router.post('/', requireAuth, validators.clientMaster, asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!(await can(me.role, 'clients.create'))) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const {
      client_name, display_name, gstin, pan,
      gst_treatment,
      tally_party_ledger, tally_income_ledger,
      invoice_prefix, payment_terms_days,
      registered_address, address,
      contact_person, contact_phone, phone, contact_whatsapp, whatsapp,
      contact_email, email,
    } = req.body;
    let { state_name, state_code } = req.body;

    if (!client_name || !gstin) {
      return res.status(400).json({ error: 'Client name and GSTIN required' });
    }
    if (String(gstin).length !== 15) {
      return res.status(400).json({ error: 'GSTIN must be 15 characters' });
    }

    // Auto-derive state from GSTIN prefix if not explicitly provided
    const STATE_MAP = {
      '01':['Jammu & Kashmir',1],'02':['Himachal Pradesh',2],'03':['Punjab',3],'04':['Chandigarh',4],
      '05':['Uttarakhand',5],'06':['Haryana',6],'07':['Delhi',7],'08':['Rajasthan',8],'09':['Uttar Pradesh',9],
      '10':['Bihar',10],'11':['Sikkim',11],'12':['Arunachal Pradesh',12],'13':['Nagaland',13],'14':['Manipur',14],
      '15':['Mizoram',15],'16':['Tripura',16],'17':['Meghalaya',17],'18':['Assam',18],'19':['West Bengal',19],
      '20':['Jharkhand',20],'21':['Odisha',21],'22':['Chhattisgarh',22],'23':['Madhya Pradesh',23],'24':['Gujarat',24],
      '27':['Maharashtra',27],'29':['Karnataka',29],'30':['Goa',30],'32':['Kerala',32],'33':['Tamil Nadu',33],
      '34':['Puducherry',34],'36':['Telangana',36],'37':['Andhra Pradesh',37],
    };
    if (!state_code || !state_name) {
      const prefix = String(gstin).substring(0,2);
      const map = STATE_MAP[prefix];
      if (map) { state_name = state_name || map[0]; state_code = state_code || map[1]; }
      else     { state_name = state_name || 'Unknown'; state_code = state_code || parseInt(prefix) || 0; }
    }

    // Determine if IGST or CGST/SGST applies (LLP is in Karnataka, state 29)
    const is_interstate = parseInt(state_code) !== 29;

    const [result] = await db.query(
      `INSERT INTO clients
         (client_name, display_name, gstin, pan, state_name, state_code,
          gst_treatment, tally_party_ledger, tally_income_ledger,
          invoice_prefix, payment_terms_days, registered_address, address,
          contact_person, contact_phone, contact_whatsapp, contact_email,
          is_interstate, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [client_name, display_name || client_name, gstin, pan || null,
       state_name, state_code, gst_treatment || 'regular',
       tally_party_ledger || client_name, tally_income_ledger || 'Construction Works Income',
       invoice_prefix || 'NUALL/26-27/', payment_terms_days || 30,
       registered_address || null, address || null,
       contact_person || null, contact_phone || phone || null,
       contact_whatsapp || whatsapp || contact_phone || phone || null,
       contact_email || email || null,
       is_interstate ? 1 : 0, me.id]
    );

    audit.log({ userId: me.id, action: 'client.create',
      entityType: 'clients', entityId: result.insertId,
      details: { client_name, gstin, state_code, is_interstate, gst_treatment: gst_treatment || 'regular' }, req });

    res.json({ success: true, id: result.insertId });
  }));

// PATCH /api/clients/:id — update client
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!(await can(me.role, 'clients.create'))) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const fields = ['display_name','gstin','pan','state_name','state_code',
                    'gst_treatment','tally_party_ledger','tally_income_ledger',
                    'invoice_prefix','payment_terms_days','registered_address',
                    'address','contact_person','contact_phone','contact_whatsapp','contact_email'];
    const updates = [];
    const values  = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    // Recalculate is_interstate if state_code changes
    if (req.body.state_code) {
      updates.push('is_interstate = ?');
      values.push(parseInt(req.body.state_code) !== 29 ? 1 : 0);
    }

    values.push(req.params.id);
    await db.query(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, values);
    audit.log({ userId: me.id, action: 'client.update', entityType: 'clients', entityId: req.params.id, details: { fields: updates.map(u => u.split(' ')[0]) }, req });
    res.json({ success: true });
  }));

// POST /api/clients/:id/tally-xml/:claim_id — generate Tally Prime XML for a claim
router.post('/:id/tally-xml/:claim_id', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!(await can(me.role, 'clients.create'))) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    // Get client master
    const [[client]] = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Get claim details
    const [[claim]] = await db.query(
      `SELECT cl.*, p.name AS project_name, p.code AS project_code
       FROM client_claims cl
       JOIN projects p ON cl.project_id = p.id
       WHERE cl.id = ? AND cl.status IN ('approved','invoiced')`,
      [req.params.claim_id]
    );
    if (!claim) return res.status(404).json({ error: 'Approved claim not found' });

    // Get claim line items with client rates and HSN
    const [items] = await db.query(
      `SELECT cli.claimed_qty, cb.item_name, cb.unit, cb.client_rate, cb.hsn_code, cb.trade,
         (cli.claimed_qty * cb.client_rate) AS line_amount
       FROM claim_items cli
       JOIN client_boq_items cb ON cli.client_boq_item_id = cb.id
       WHERE cli.claim_id = ?
       ORDER BY cb.trade`,
      [req.params.claim_id]
    );

    if (!items.length) return res.status(400).json({ error: 'No items in claim' });

    // Calculate totals — these don't depend on the invoice number, so do once.
    const subtotal   = items.reduce((s,i) => s + parseFloat(i.line_amount||0), 0);
    const gstRate    = 18;
    const gstAmount  = Math.round(subtotal * gstRate / 100 * 100) / 100;
    const total      = subtotal + gstAmount;
    const invDate    = dateUtil.yyyymmddIST();

    // Ensure sequential, unique, concurrency-safe invoice generation
    // using transaction-safe row-level locking on the clients table.
    let seq, invNum;
    await db.tx(async (conn) => {
      const [[clientRow]] = await conn.query(
        "SELECT invoice_sequence, invoice_prefix FROM clients WHERE id = ? FOR UPDATE",
        [client.id]
      );
      seq = (clientRow?.invoice_sequence || 0) + 1;
      invNum = `${clientRow?.invoice_prefix || client.invoice_prefix}${String(seq).padStart(3, '0')}`;

      // Increment client table's sequence
      await conn.query(
        "UPDATE clients SET invoice_sequence = ? WHERE id = ?",
        [seq, client.id]
      );

      // Update the client claim with the generated sequence and number
      await conn.query(
        "UPDATE client_claims SET invoice_number = ?, invoice_sequence = ? WHERE id = ?",
        [invNum, seq, claim.id]
      );
    });

    // Build Tally Prime XML — every user-controlled value goes through escapeXml.
    const gstLedgers = client.is_interstate
      ? `<ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>IGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-${gstAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
      : `<ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-${(gstAmount/2).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-${(gstAmount/2).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

    const inventoryLines = items.map(item => `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.item_name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <HSNDETAILS.LIST>
                <APPLICABLEFROM>${escapeXml(invDate)}</APPLICABLEFROM>
                <HSNCODE>${escapeXml(item.hsn_code || '9954')}</HSNCODE>
                <TAXABILITY>Taxable</TAXABILITY>
                <GSTRATE>${gstRate}</GSTRATE>
              </HSNDETAILS.LIST>
              <ACTUALQTY>${parseFloat(item.claimed_qty).toFixed(3)} ${escapeXml(item.unit)}</ACTUALQTY>
              <BILLEDQTY>${parseFloat(item.claimed_qty).toFixed(3)} ${escapeXml(item.unit)}</BILLEDQTY>
              <RATE>${parseFloat(item.client_rate).toFixed(2)}/${escapeXml(item.unit)}</RATE>
              <AMOUNT>-${parseFloat(item.line_amount).toFixed(2)}</AMOUNT>
            </ALLINVENTORYENTRIES.LIST>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>NU ASSOCIATES LLP</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${escapeXml(invDate)}</DATE>
            <VOUCHERNUMBER>${escapeXml(invNum)}</VOUCHERNUMBER>
            <NARRATION>RA Bill ${escapeXml(claim.ra_bill_number)} — ${escapeXml(claim.discipline)} — ${escapeXml(claim.project_name)}</NARRATION>
            <PARTYLEDGERNAME>${escapeXml(client.tally_party_ledger)}</PARTYLEDGERNAME>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PLACEOFSUPPLY>${escapeXml(client.state_name)}</PLACEOFSUPPLY>
            <ISSERVICETAX>Yes</ISSERVICETAX>
            ${inventoryLines}
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(client.tally_income_ledger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-${subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${gstLedgers}
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(client.tally_party_ledger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>${total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    // Save XML file. Path uses sanitised project_code + ra_bill_number to
    // prevent traversal via "../"-style attacks (B15).
    const { UPLOAD_DIR } = require('../../../middleware/upload');
    const safeProjectCode = safeFileSegment(claim.project_code);
    const safeRaBill      = safeFileSegment(claim.ra_bill_number);
    const fileName = `tally_${safeProjectCode}_RA${safeRaBill}_${Date.now()}.xml`;
    const outPath  = path.join(UPLOAD_DIR, 'documents', fileName);
    fs.writeFileSync(outPath, xml, 'utf8');

    // Notify finance admins via WhatsApp (role-based — was hardcoded username='finance_admin')
    try {
      const { notify } = require('../../../services/notifications');
      const recipients = await users.financeAdmins('id');
      if (recipients.length) {
        const msg = `nu PMC — Tally XML ready\nProject: ${claim.project_name}\nRA Bill: ${claim.ra_bill_number} — ${claim.discipline}\nInvoice: ${invNum}\nTotal (incl GST): ₹${total.toLocaleString('en-IN')}\n\nPlease import XML into Tally Prime.`;
        for (const r of recipients) {
          await notify(r.id, 'tally_xml_ready', msg);
        }
      }
    } catch(_e) { /* notification failure — non-blocking */ }

    audit.log({ userId: me.id, action: 'tally_xml.generate',
      entityType: 'client_claims', entityId: parseInt(req.params.claim_id),
      details: { client_id: parseInt(req.params.id), invoice_number: invNum, project_code: claim.project_code, ra_bill: claim.ra_bill_number, total }, req });

    res.json({
      success:        true,
      invoice_number: invNum,
      subtotal:       subtotal,
      gst_amount:     gstAmount,
      total:          total,
      gst_type:       client.is_interstate ? 'IGST' : 'CGST+SGST',
      file_name:      fileName,
      message:        `Tally XML generated — ${invNum}. Import into Tally Prime: Gateway → Import Data → Vouchers.`
    });

  }));

// GET /api/clients/check?name=X — fuzzy duplicate check
router.get('/check', requireAuth, asyncHandler(async (req, res) => {
    if (!(await can(req.session.user.role, 'clients.create'))) return res.status(403).json({ error: 'Not authorised' });
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = await fuzzy.checkClientDuplicate(db, name);
    res.json(result);
  }));

// POST /api/clients/bulk-upload — upload client master from Excel
router.post('/bulk-upload', requireAuth, upload.single('clients'), asyncHandler(async (req, res) => {
    if (!(await can(req.session.user.role, 'clients.bulk_upload'))) return res.status(403).json({ error: 'Not authorised' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const rows = await xl.readFile(req.file.path);
    let added = 0, skipped = 0, errors = [];

    // Indian state lookup by GSTIN prefix (first 2 digits)
    const STATE_MAP = {
      '01':['Jammu & Kashmir',1],'02':['Himachal Pradesh',2],'03':['Punjab',3],'04':['Chandigarh',4],
      '05':['Uttarakhand',5],'06':['Haryana',6],'07':['Delhi',7],'08':['Rajasthan',8],'09':['Uttar Pradesh',9],
      '10':['Bihar',10],'11':['Sikkim',11],'12':['Arunachal Pradesh',12],'13':['Nagaland',13],'14':['Manipur',14],
      '15':['Mizoram',15],'16':['Tripura',16],'17':['Meghalaya',17],'18':['Assam',18],'19':['West Bengal',19],
      '20':['Jharkhand',20],'21':['Odisha',21],'22':['Chhattisgarh',22],'23':['Madhya Pradesh',23],'24':['Gujarat',24],
      '27':['Maharashtra',27],'29':['Karnataka',29],'30':['Goa',30],'32':['Kerala',32],'33':['Tamil Nadu',33],
      '34':['Puducherry',34],'36':['Telangana',36],'37':['Andhra Pradesh',37],
    };

    for (const row of rows) {
      const name = (row['Client Name'] || row['client_name'] || '').toString().trim();
      if (!name) { skipped++; continue; }
      if (name.toLowerCase().startsWith('example:')) { skipped++; continue; }

      const gstin = (row['GSTIN'] || row['gstin'] || '').toString().trim().toUpperCase();
      if (!gstin || gstin.length !== 15) {
        skipped++;
        if (!errors) errors = [];
        errors.push(`${name}: GSTIN missing or invalid length (15 chars required)`);
        continue;
      }

      // Derive state from GSTIN prefix
      const statePrefix = gstin.substring(0,2);
      const [stateName, stateCode] = STATE_MAP[statePrefix] || ['Unknown', parseInt(statePrefix) || 0];

      const [[ex]] = await db.query('SELECT id FROM clients WHERE client_name=?', [name]);
      if (ex) { skipped++; continue; }
      const dup = await fuzzy.checkClientDuplicate(db, name);
      if (dup.isDuplicate && dup.suggestions[0]?.similarity > 0.90) { skipped++; continue; }

      const displayName = name.length <= 100 ? name : name.substring(0,100);
      const phone       = (row['Phone'] || row['phone'] || '').toString().trim();
      const whatsapp    = (row['WhatsApp'] || row['whatsapp'] || row['Phone'] || '').toString().trim();
      const email       = (row['Email'] || row['email'] || '').toString().trim() || null;
      const address     = (row['Address'] || row['address'] || '').toString().trim() || null;
      const contactPerson = (row['Contact Person'] || row['contact_person'] || '').toString().trim() || null;
      const tallyLedger = (row['Tally Ledger'] || row['tally_ledger'] || name).toString().trim();

      await db.query(
        `INSERT INTO clients (client_name, display_name, gstin, state_name, state_code,
         contact_person, contact_phone, contact_whatsapp, contact_email, address,
         tally_party_ledger, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [name, displayName, gstin, stateName, stateCode,
         contactPerson, phone||null, whatsapp||phone||null,
         email, address, tallyLedger,
         req.session.user.id]
      );
      added++;
    }
    audit.log({ userId: req.session.user.id, action: 'clients.bulk_upload',
      entityType: 'clients', entityId: null,
      details: { added, skipped, file_path: req.file.path }, req });
    res.json({ success: true, added, skipped, message: `${added} clients added` });
  }));

// GET /api/clients/incomplete — stubs awaiting finance master completion (finance_admin dashboard)
router.get('/incomplete', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canSee = me.role === 'audit' || (await can(me.role, 'clients.edit'));
    if (!canSee) return res.status(403).json({ error: 'Not authorised' });
    const [stubs] = await db.query(
      `SELECT c.id, c.client_name, c.stub_reason, c.created_at, c.created_by,
              (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count,
              (SELECT GROUP_CONCAT(p.code SEPARATOR ', ') FROM projects p WHERE p.client_id = c.id) AS project_codes
       FROM clients c
       WHERE c.master_complete = 0 AND c.is_active = 1
       ORDER BY c.created_at ASC`
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(stubs.map(s => s.created_by).filter(Boolean));
    stubs.forEach(s => { s.created_by_name = users.get(s.created_by)?.full_name || null; });
    res.json({ clients: stubs });
  }));

// PATCH /api/clients/:id/complete — fill in stub master data (finance_admin)
router.patch('/:id/complete', requireAuth, validators.clientMaster, asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!(await can(me.role, 'clients.edit'))) return res.status(403).json({ error: 'Not authorised' });

    const [[existing]] = await db.query('SELECT id, master_complete FROM clients WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client not found' });
    if (existing.master_complete === 1) return res.status(400).json({ error: 'Client master already complete', code: 'ALREADY_COMPLETE' });

    const {
      client_name, display_name, gstin, pan,
      state_name, state_code, gst_treatment,
      tally_party_ledger, tally_income_ledger,
      invoice_prefix, payment_terms_days,
      registered_address, address,
      contact_person, contact_phone, contact_whatsapp, contact_email
    } = req.body;

    // Derive state from GSTIN if not supplied
    let stName = state_name, stCode = state_code;
    if ((!stName || !stCode) && gstin && gstin.length >= 2) {
      const codeFromGstin = parseInt(gstin.substring(0, 2), 10);
      if (!isNaN(codeFromGstin)) stCode = codeFromGstin;
    }

    // Check for GSTIN collision before update
    const [[dupe]] = await db.query('SELECT id FROM clients WHERE gstin = ? AND id <> ?', [gstin, req.params.id]);
    if (dupe) return res.status(400).json({ error: 'GSTIN already exists for another client', code: 'GSTIN_COLLISION' });

    const interstate = stCode && stCode !== 29 ? 1 : 0;   // 29 = Karnataka (nu associates' home state)

    await db.query(
      `UPDATE clients SET
         client_name = ?, display_name = COALESCE(?, client_name),
         gstin = ?, pan = ?, state_name = ?, state_code = ?,
         gst_treatment = ?, tally_party_ledger = COALESCE(?, client_name),
         tally_income_ledger = COALESCE(?, 'Construction Works Income'),
         invoice_prefix = COALESCE(?, 'NUALL/26-27/'),
         payment_terms_days = COALESCE(?, 30),
         registered_address = ?, address = ?,
         contact_person = ?, contact_phone = ?, contact_whatsapp = ?, contact_email = ?,
         is_interstate = ?,
         master_complete = 1, completed_by = ?, completed_at = NOW()
       WHERE id = ?`,
      [client_name, display_name || null,
       gstin, pan || null, stName || null, stCode || null,
       gst_treatment || 'regular',
       tally_party_ledger || null, tally_income_ledger || null,
       invoice_prefix || null, payment_terms_days || null,
       registered_address || null, address || null,
       contact_person || null, contact_phone || null, contact_whatsapp || contact_phone || null, contact_email || null,
       interstate, me.id, req.params.id]
    );

    audit.log({ userId: me.id, action: 'client_master_completed', entityType: 'clients', entityId: req.params.id, req });

    res.json({ success: true, message: 'Client master completed — ready for PI generation' });
  }));

module.exports = router;
