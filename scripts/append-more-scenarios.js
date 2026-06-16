// scripts/append-more-scenarios.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  console.log('Connecting to database...');
  const dbName = process.env.DB_NAME || 'nu_pmc';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: dbName,
  });

  try {
    // 1. Fetch user IDs
    const [users] = await connection.query('SELECT id, username, role FROM users');
    const getUser = (role, defaultUser) => {
      const u = users.find(x => x.role === role || x.username === defaultUser);
      return u ? u.id : 1;
    };
    const principalId = getUser('principal', 'admin1');
    const designHeadId = getUser('design_head', 'design_head1');
    const pmcHeadId = getUser('pmc_head', 'pmc_head1');
    const siteMgrId = getUser('site_manager', 'site_mgr1');
    const teamLeadId = getUser('team_lead', 'team_lead1');

    // Get a vendor
    const [[vendor]] = await connection.query('SELECT id, vendor_name FROM vendors LIMIT 1');
    const vendorId = vendor ? vendor.id : 1;

    // 2. Create New Projects (PROJ-IND and PROJ-RES)
    console.log('\nCreating/Checking new projects...');
    const projectsToInsert = [
      {
        code: 'PROJ-IND',
        name: 'Industrial Warehouse Complex',
        client: 'Reliance Logistics',
        location: 'KIADB Industrial Area, Bangalore',
        type: 'industrial',
        status: 'active'
      },
      {
        code: 'PROJ-RES',
        name: 'Residential Green Villa Complex',
        client: 'Greenfield Developers',
        location: 'Whitefield, Bangalore',
        type: 'residential',
        status: 'active'
      }
    ];

    const projectIds = {};

    for (const p of projectsToInsert) {
      const [existing] = await connection.query('SELECT id FROM projects WHERE code = ?', [p.code]);
      if (existing.length === 0) {
        const [res] = await connection.query(
          `INSERT INTO projects 
           (entity_id, billing_account, code, name, client, location, project_type, r0_start_date, r0_end_date, status, created_by) 
           VALUES (2, "primary", ?, ?, ?, ?, ?, "2026-06-01", "2027-06-01", ?, ?)`,
          [p.code, p.name, p.client, p.location, p.type, p.status, principalId]
        );
        projectIds[p.code] = res.insertId;
        console.log(`✓ Created Project: ${p.code} (ID: ${res.insertId})`);
      } else {
        projectIds[p.code] = existing[0].id;
        console.log(`- Project ${p.code} already exists (ID: ${existing[0].id})`);
      }

      // Add project assignment for site manager and pmc head to see the project
      const [existingAssignSite] = await connection.query('SELECT id FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectIds[p.code], siteMgrId]);
      if (existingAssignSite.length === 0) {
        await connection.query('INSERT INTO project_assignments (project_id, user_id, assigned_by, is_active) VALUES (?, ?, ?, 1)', [projectIds[p.code], siteMgrId, principalId]);
      }
      const [existingAssignPmc] = await connection.query('SELECT id FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectIds[p.code], pmcHeadId]);
      if (existingAssignPmc.length === 0) {
        await connection.query('INSERT INTO project_assignments (project_id, user_id, assigned_by, is_active) VALUES (?, ?, ?, 1)', [projectIds[p.code], pmcHeadId, principalId]);
      }
      const [existingAssignTeam] = await connection.query('SELECT id FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectIds[p.code], teamLeadId]);
      if (existingAssignTeam.length === 0) {
        await connection.query('INSERT INTO project_assignments (project_id, user_id, assigned_by, is_active) VALUES (?, ?, ?, 1)', [projectIds[p.code], teamLeadId, principalId]);
      }
    }

    // 3. Insert Drawings with PDF and JPG attachments
    console.log('\nAppending drawings with PDF and JPG attachments...');
    const drawingsToInsert = [
      {
        projCode: 'PROJ-IND',
        number: 'IND-ARCH-001',
        name: 'Warehouse Layout Plan',
        cat: 'Architectural',
        stream: 'design',
        revision: 'R0',
        file: 'uploads/drawings/ind-arch-001.pdf',
        status: 'pending_l1'
      },
      {
        projCode: 'PROJ-IND',
        number: 'IND-STR-002',
        name: 'Foundation Reinforcement Detail',
        cat: 'Structural',
        stream: 'design',
        revision: 'R0',
        file: 'uploads/drawings/ind-str-002.jpg',
        status: 'issued',
        l1: designHeadId,
        l2: pmcHeadId
      },
      {
        projCode: 'PROJ-RES',
        number: 'RES-HVAC-001',
        name: 'Villa A HVAC Ducting Plan',
        cat: 'HVAC',
        stream: 'services',
        revision: 'R0',
        file: 'uploads/drawings/res-hvac-001.pdf',
        status: 'pending_l2',
        l1: teamLeadId
      },
      {
        projCode: 'PROJ-RES',
        number: 'RES-PLUM-002',
        name: 'Villa A Plumbing Layout',
        cat: 'Plumbing',
        stream: 'services',
        revision: 'R0',
        file: 'uploads/drawings/res-plum-002.jpg',
        status: 'rejected',
        l1: teamLeadId,
        rejection_note: 'Piping coordinates clash with columns at Grid 2.'
      }
    ];

    for (const d of drawingsToInsert) {
      const pId = projectIds[d.projCode];
      const [existing] = await connection.query('SELECT id FROM drawings WHERE project_id = ? AND drawing_number = ?', [pId, d.number]);
      let drawingId;
      if (existing.length === 0) {
        const [res] = await connection.query(
          'INSERT INTO drawings (project_id, drawing_number, drawing_name, category, stream, drawing_type) VALUES (?, ?, ?, ?, ?, "main")',
          [pId, d.number, d.name, d.cat, d.stream]
        );
        drawingId = res.insertId;
        console.log(`✓ Inserted Drawing: ${d.number}`);
      } else {
        drawingId = existing[0].id;
        console.log(`- Drawing ${d.number} already exists`);
      }

      const [existingVer] = await connection.query('SELECT id FROM drawing_versions WHERE drawing_id = ? AND revision = ?', [drawingId, d.revision]);
      if (existingVer.length === 0) {
        await connection.query(
          `INSERT INTO drawing_versions 
           (drawing_id, revision, revision_number, file_path, file_size_kb, notes, status, uploaded_by, l1_reviewed_by, l1_reviewed_at, l1_rejection_note, l2_approved_by, l2_approved_at, l2_rejection_note, issued_at, is_current) 
           VALUES (?, ?, 0, ?, 1850, "Auto-seeded for testing", ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            drawingId, d.revision, d.file, d.status, teamLeadId,
            d.l1 || null, d.l1 ? new Date() : null, d.status === 'rejected' ? d.rejection_note : null,
            d.l2 || null, d.l2 ? new Date() : null, d.status === 'rejected' ? d.rejection_note : null,
            d.status === 'issued' ? new Date() : null
          ]
        );
        console.log(`  ✓ Inserted Version: ${d.revision} (${d.status}) File: ${d.file}`);
      } else {
        console.log(`  - Version ${d.revision} already exists`);
      }
    }

    // 4. Create BOQ versions and items (some verified, some whatever)
    console.log('\nCreating BOQ items with various verification states...');
    for (const code of ['PROJ-IND', 'PROJ-RES']) {
      const pId = projectIds[code];
      
      // Insert BOQ version
      const [existingBoqVer] = await connection.query('SELECT id FROM boq_versions WHERE project_id = ? AND is_current = 1', [pId]);
      let boqVerId;
      if (existingBoqVer.length === 0) {
        const [res] = await connection.query(
          'INSERT INTO boq_versions (project_id, stream, version_number, label, is_current, uploaded_by) VALUES (?, "design", 1, "v1", 1, ?)',
          [pId, teamLeadId]
        );
        boqVerId = res.insertId;
        console.log(`✓ Created BOQ Version v1 for ${code}`);
      } else {
        boqVerId = existingBoqVer[0].id;
        console.log(`- BOQ Version for ${code} already exists`);
      }

      // Insert BOQ items
      const boqItems = [
        { code: 'CIV-101', name: 'Earth excavation and sorting', unit: 'CUM', qty: 250.0, verified: 1 }, // Verified
        { code: 'CIV-102', name: 'PCC Foundation layer M15', unit: 'CUM', qty: 50.0, verified: 0 },   // Unverified
        { code: 'CIV-103', name: 'RCC Columns and beams', unit: 'CUM', qty: 120.0, verified: 1 }      // Verified
      ];

      for (const item of boqItems) {
        const [existingItem] = await connection.query('SELECT id FROM boq_items WHERE boq_version_id = ? AND item_code = ?', [boqVerId, item.code]);
        if (existingItem.length === 0) {
          await connection.query(
            `INSERT INTO boq_items 
             (boq_version_id, project_id, trade, item_code, item_name, unit, quantity, bank_verified, bank_verification_sent_at) 
             VALUES (?, ?, "Civil", ?, ?, ?, ?, ?, ?)`,
            [boqVerId, pId, item.code, item.name, item.unit, item.qty, item.verified, item.verified ? new Date() : null]
          );
          console.log(`  ✓ Inserted BOQ Item ${item.code} (Verified: ${item.verified})`);
        } else {
          console.log(`  - BOQ Item ${item.code} already exists`);
        }
      }
    }

    // 5. Insert Payment Requests with PDF / JPG attachment mockups
    console.log('\nAppending payment requests with mock PDF/JPG file attachments...');
    const paymentsToInsert = [
      {
        projCode: 'PROJ-IND',
        amount: 320000.00,
        reason: 'Warehouse structural steel mobilization advance',
        type: 'mobilisation_advance',
        status: 'pmc_approved',
        evidence: 'uploads/urgent-payments/invoice_ind_320k.pdf'
      },
      {
        projCode: 'PROJ-RES',
        amount: 125000.00,
        reason: 'Premium marble supply for main lounge',
        type: 'design_material',
        status: 'paid',
        evidence: 'uploads/urgent-payments/receipt_res_125k.jpg',
        utr: 'UTR778899112233'
      }
    ];

    for (const p of paymentsToInsert) {
      const pId = projectIds[p.projCode];
      const [existing] = await connection.query('SELECT id FROM payment_requests WHERE project_id = ? AND amount_requested = ? AND reason = ?', [pId, p.amount, p.reason]);
      let prId;
      if (existing.length === 0) {
        const [res] = await connection.query(
          `INSERT INTO payment_requests 
           (project_id, vendor_id, requested_by, amount_requested, reason, payment_type, status, pmc_amount, pmc_reviewed_by, pmc_reviewed_at, actual_paid, payment_date, utr_number, paid_by, payment_lane) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "bank")`,
          [
            pId, vendorId, siteMgrId, p.amount, p.reason, p.type, p.status,
            p.amount, pmcHeadId, new Date(),
            p.status === 'paid' ? p.amount : null, p.status === 'paid' ? new Date() : null, p.utr || null, p.status === 'paid' ? principalId : null
          ]
        );
        prId = res.insertId;
        console.log(`✓ Inserted Payment Request of ${p.amount} on ${p.projCode}`);
      } else {
        prId = existing[0].id;
        console.log(`- Payment Request already exists`);
      }

      // Add attachment evidence
      const [existingEvidence] = await connection.query('SELECT id FROM payment_request_evidence WHERE payment_request_id = ?', [prId]);
      if (existingEvidence.length === 0) {
        const fileType = p.evidence.endsWith('.pdf') ? 'ra_bill' : 'photo';
        await connection.query(
          'INSERT INTO payment_request_evidence (payment_request_id, file_path, file_type, uploaded_by) VALUES (?, ?, ?, ?)',
          [prId, p.evidence, fileType, siteMgrId]
        );
        console.log(`  ✓ Added attachment evidence file: ${p.evidence} (Type: ${fileType})`);
      } else {
        console.log(`  - Attachment evidence already exists`);
      }
    }

    console.log('\n=========================================================');
    console.log('Additional JPG/PDF and verified scenarios appended successfully!');
    console.log('=========================================================');

  } catch (error) {
    console.error('Failed to append scenarios:', error);
  } finally {
    await connection.end();
  }
}

main();
