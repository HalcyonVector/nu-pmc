// scripts/append-demo-scenarios.js
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
    // 1. Fetch reference IDs
    console.log('Fetching reference users, projects, and vendors...');
    
    // Get the first project
    const [[project]] = await connection.query('SELECT id, code FROM projects LIMIT 1');
    if (!project) {
      console.error('No project found in database. Please initialize the database schema first.');
      return;
    }
    console.log(`Using Project: ${project.code} (ID: ${project.id})`);

    // Get users for various roles
    const [users] = await connection.query('SELECT id, username, role FROM users');
    const getUser = (role, defaultUser) => {
      const u = users.find(x => x.role === role || x.username === defaultUser);
      return u ? u.id : 1; // Fallback to ID 1 if not found
    };

    const principalId = getUser('principal', 'admin1');
    const designHeadId = getUser('design_head', 'design_head1');
    const pmcHeadId = getUser('pmc_head', 'pmc_head1');
    const siteMgrId = getUser('site_manager', 'site_mgr1');
    const teamLeadId = getUser('team_lead', 'team_lead1');

    console.log(`Mapped Roles -> Principal: ${principalId}, Design Head: ${designHeadId}, PMC Head: ${pmcHeadId}, Site Manager: ${siteMgrId}, Team Lead: ${teamLeadId}`);

    // Get the first vendor
    const [[vendor]] = await connection.query('SELECT id, vendor_name FROM vendors LIMIT 1');
    const vendorId = vendor ? vendor.id : 1;
    if (vendor) {
      console.log(`Using Vendor: ${vendor.vendor_name} (ID: ${vendor.id})`);
    } else {
      console.log('No vendor found, using fallback ID 1');
    }

    // 2. Insert Drawings & Drawing Versions
    console.log('\nAppending drawings...');
    const drawingsToInsert = [
      { number: 'DEMO-DRW-001', name: 'Foundation Plan Block A', cat: 'Structural', stream: 'design', revision: 'R0', status: 'pending_l1', uploaded_by: teamLeadId },
      { number: 'DEMO-DRW-002', name: 'Electrical Duct Layout v1', cat: 'Electrical', stream: 'services', revision: 'R0', status: 'issued', uploaded_by: teamLeadId, l1: designHeadId, l2: pmcHeadId }
    ];

    for (const d of drawingsToInsert) {
      const [existing] = await connection.query('SELECT id FROM drawings WHERE project_id = ? AND drawing_number = ?', [project.id, d.number]);
      let drawingId;
      if (existing.length === 0) {
        const [res] = await connection.query(
          'INSERT INTO drawings (project_id, drawing_number, drawing_name, category, stream, drawing_type) VALUES (?, ?, ?, ?, ?, "main")',
          [project.id, d.number, d.name, d.cat, d.stream]
        );
        drawingId = res.insertId;
        console.log(`✓ Inserted drawing: ${d.number}`);
      } else {
        drawingId = existing[0].id;
        console.log(`- Drawing ${d.number} already exists`);
      }

      // Add revision
      const [existingVer] = await connection.query('SELECT id FROM drawing_versions WHERE drawing_id = ? AND revision = ?', [drawingId, d.revision]);
      if (existingVer.length === 0) {
        await connection.query(
          `INSERT INTO drawing_versions 
           (drawing_id, revision, revision_number, file_path, file_size_kb, notes, status, uploaded_by, l1_reviewed_by, l1_reviewed_at, l2_approved_by, l2_approved_at, issued_at, is_current) 
           VALUES (?, ?, 0, ?, 1240, "Initial release for testing", ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            drawingId, 
            d.revision, 
            `uploads/drawings/${d.number}_${d.revision}.pdf`, 
            d.status, 
            d.uploaded_by,
            d.l1 || null, d.l1 ? new Date() : null,
            d.l2 || null, d.l2 ? new Date() : null,
            d.status === 'issued' ? new Date() : null
          ]
        );
        console.log(`  ✓ Inserted version ${d.revision} with status ${d.status}`);
      } else {
        console.log(`  - Version ${d.revision} already exists`);
      }
    }

    // 3. Insert RFIs (Issues)
    console.log('\nAppending RFIs...');
    const rfisToInsert = [
      { 
        number: 'DEMO-RFI-001', 
        title: 'Rebar spacing mismatch in column C3', 
        desc: 'Structural drawing R0 specifies 150mm spacing while detailing sheet shows 200mm spacing. Please clarify.', 
        status: 'open', 
        raised_by: siteMgrId, 
        assigned_to: teamLeadId 
      },
      { 
        number: 'DEMO-RFI-002', 
        title: 'HVAC piping clash with fire duct', 
        desc: 'Plumbing line at grid line B-5 clashes with fire water main pipe.', 
        status: 'closed', 
        raised_by: siteMgrId, 
        assigned_to: teamLeadId,
        response: 'Plumbing line rerouted 100mm lower. Fire main remains unchanged.',
        responded_by: designHeadId
      }
    ];

    for (const r of rfisToInsert) {
      const [existing] = await connection.query('SELECT id FROM issues WHERE project_id = ? AND issue_number = ?', [project.id, r.number]);
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO issues 
           (project_id, issue_number, issue_type, title, description, raised_by, assigned_to, status, rfi_response, rfi_responded_by, rfi_responded_at, query_stream) 
           VALUES (?, ?, "rfi", ?, ?, ?, ?, ?, ?, ?, ?, "design")`,
          [
            project.id, r.number, r.title, r.desc, r.raised_by, r.assigned_to, r.status,
            r.response || null, r.responded_by || null, r.response ? new Date() : null
          ]
        );
        console.log(`✓ Inserted RFI: ${r.number}`);
      } else {
        console.log(`- RFI ${r.number} already exists`);
      }
    }

    // 4. Insert Payment Requests
    console.log('\nAppending payment requests...');
    const paymentsToInsert = [
      { amount: 150000.00, reason: 'Labour payments for block A brickwork', type: 'labour', status: 'pending_pmc', requested_by: siteMgrId },
      { amount: 250000.00, reason: 'Ultratech Cement invoice #4229', type: 'site_material', status: 'pending_principal', requested_by: siteMgrId, pmc_amount: 250000.00, pmc_reviewed_by: pmcHeadId },
      { amount: 80000.00, reason: 'Safety shoes and helmets', type: 'other', status: 'paid', requested_by: siteMgrId, pmc_amount: 80000.00, pmc_reviewed_by: pmcHeadId, actual_paid: 80000.00, utr: 'UTR1234567890', paid_by: principalId }
    ];

    for (const p of paymentsToInsert) {
      // Check if duplicate amount and reason exists to avoid multiple insertions
      const [existing] = await connection.query('SELECT id FROM payment_requests WHERE project_id = ? AND amount_requested = ? AND reason = ?', [project.id, p.amount, p.reason]);
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO payment_requests 
           (project_id, vendor_id, requested_by, amount_requested, reason, payment_type, status, pmc_amount, pmc_reviewed_by, pmc_reviewed_at, actual_paid, payment_date, utr_number, paid_by, payment_lane) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "icici_bulk")`,
          [
            project.id, vendorId, p.requested_by, p.amount, p.reason, p.type, p.status,
            p.pmc_amount || null, p.pmc_reviewed_by || null, p.pmc_reviewed_by ? new Date() : null,
            p.actual_paid || null, p.actual_paid ? new Date() : null, p.utr || null, p.paid_by || null
          ]
        );
        console.log(`✓ Inserted payment request: ${p.amount} (${p.status})`);
      } else {
        console.log(`- Payment request of ${p.amount} for "${p.reason}" already exists`);
      }
    }

    console.log('\n=========================================================');
    console.log('Test scenarios appended successfully!');
    console.log('=========================================================');

  } catch (error) {
    console.error('Failed to append test data:', error);
  } finally {
    await connection.end();
  }
}

main();
