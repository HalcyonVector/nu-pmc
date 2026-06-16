// scripts/append-kitchen-sink.js
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
    // 1. Fetch references
    const [[project]] = await connection.query('SELECT id, code FROM projects LIMIT 1');
    if (!project) {
      console.error('No project found in database.');
      return;
    }
    console.log(`Using Project: ${project.code} (ID: ${project.id})`);

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

    const [[boqItem]] = await connection.query('SELECT id, item_name FROM boq_items WHERE project_id = ? LIMIT 1', [project.id]);
    if (!boqItem) {
      console.log('No BOQ item found, cannot insert material request.');
    }

    const [[engagement]] = await connection.query('SELECT id FROM vendor_engagements LIMIT 1');
    const engagementId = engagement ? engagement.id : 1;

    // 2. Append Material Requests
    if (boqItem) {
      console.log('\nAppending material requests...');
      const [existing] = await connection.query('SELECT id FROM material_requests WHERE project_id = ? AND boq_item_id = ?', [project.id, boqItem.id]);
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO material_requests 
           (project_id, boq_item_id, quantity_needed, needed_by_date, status, notes, raised_by) 
           VALUES (?, ?, 100.00, "2026-07-01", 1, "Urgent cement order for foundations", ?)`,
          [project.id, boqItem.id, siteMgrId]
        );
        console.log(`✓ Inserted Material Request for: ${boqItem.item_name}`);
      } else {
        console.log('- Material Request already exists');
      }
    }

    // 3. Append Submittals
    console.log('\nAppending submittals...');
    const [existingSubmittal] = await connection.query('SELECT id FROM submittals WHERE project_id = ? AND title = ?', [project.id, 'Concrete Strength Test Report']);
    if (existingSubmittal.length === 0) {
      await connection.query(
        `INSERT INTO submittals 
         (project_id, submittal_number, engagement_id, title, submittal_type, status, submitted_by, reviewed_by, file_path) 
         VALUES (?, "SUB-001", ?, "Concrete Strength Test Report", "test_report", "under_review", ?, ?, "uploads/documents/concrete_test_m30.pdf")`,
        [project.id, engagementId, siteMgrId, teamLeadId]
      );
      console.log('✓ Inserted Submittal: Concrete Strength Test Report');
    } else {
      console.log('- Submittal already exists');
    }

    // 4. Append Change Notices
    console.log('\nAppending Change Notices...');
    const [existingCN] = await connection.query('SELECT id FROM change_notices WHERE project_id = ? AND title = ?', [project.id, 'CN-001: Column shift grid B']);
    if (existingCN.length === 0) {
      await connection.query(
        `INSERT INTO change_notices 
         (project_id, cn_number, title, description, source, raised_by, status, schedule_impact_days) 
         VALUES (?, "CN001", "CN-001: Column shift grid B", "Shift column C3 by 150mm east to clear structural overlap.", "design", ?, "pending_approval", 3)`,
        [project.id, teamLeadId]
      );
      console.log('✓ Inserted Change Notice: CN-001');
    } else {
      console.log('- Change Notice already exists');
    }

    // 5. Append Meetings (MOMs / Site Visits)
    console.log('\nAppending meetings...');
    const [existingMeeting] = await connection.query('SELECT id FROM meetings WHERE project_id = ? AND title = ?', [project.id, 'Weekly Site Coordination Meeting']);
    if (existingMeeting.length === 0) {
      await connection.query(
        `INSERT INTO meetings 
         (project_id, title, meeting_date, location, visibility, drafted_by, notes) 
         VALUES (?, "Weekly Site Coordination Meeting", "2026-06-15", "Main Conference Cabin", "internal", ?, "Review weekly civil and MEP progress.")`,
        [project.id, pmcHeadId]
      );
      console.log('✓ Inserted Meeting: Weekly Site Coordination Meeting');
    } else {
      console.log('- Meeting already exists');
    }

    // 6. Append Daily Site Reports & Labour Register
    console.log('\nAppending daily reports & labour register...');
    const reportDate = '2026-06-15';
    const [existingReport] = await connection.query('SELECT id FROM daily_reports WHERE project_id = ? AND report_date = ? AND site_manager_id = ?', [project.id, reportDate, siteMgrId]);
    if (existingReport.length === 0) {
      await connection.query(
        `INSERT INTO daily_reports 
         (project_id, report_date, site_manager_id, overall_notes, status) 
         VALUES (?, ?, ?, "Completed Column casting of 4 columns on Grid A.", "pending_review")`,
        [project.id, reportDate, siteMgrId]
      );
      console.log(`✓ Inserted Daily Report for ${reportDate}`);
    } else {
      console.log(`- Daily Report for ${reportDate} already exists`);
    }

    if (engagementId) {
      const [existingLabour] = await connection.query('SELECT id FROM labour_register WHERE project_id = ? AND register_date = ? AND trade = ?', [project.id, reportDate, 'Bar Bender']);
      if (existingLabour.length === 0) {
        await connection.query(
          `INSERT INTO labour_register 
           (project_id, engagement_id, register_date, trade, headcount, recorded_by) 
           VALUES (?, ?, ?, "Bar Bender", 8, ?)`,
          [project.id, engagementId, reportDate, siteMgrId]
        );
        console.log('✓ Inserted Labour Register entry: Bar Bender');
      } else {
        console.log('- Labour Register entry already exists');
      }
    }

    // 7. Append Goods Receipt Notes (GRN)
    console.log('\nAppending GRNs...');
    const [existingGRN] = await connection.query('SELECT id FROM grns WHERE project_id = ? AND grn_number = ?', [project.id, 'GRN-001']);
    if (existingGRN.length === 0) {
      await connection.query(
        `INSERT INTO grns 
         (project_id, grn_number, engagement_id, delivery_date, description, quantity_received, unit, status, raised_by) 
         VALUES (?, "GRN-001", ?, "2026-06-15", "Ultratech Cement 43 Grade", 500.00, "Bags", "pending", ?)`,
        [project.id, engagementId, siteMgrId]
      );
      console.log('✓ Inserted Goods Receipt Note: GRN-001');
    } else {
      console.log('- GRN already exists');
    }

    console.log('\n=========================================================');
    console.log('Kitchen sink test scenarios populated successfully!');
    console.log('=========================================================');

  } catch (error) {
    console.error('Failed to append kitchen sink scenarios:', error);
  } finally {
    await connection.end();
  }
}

main();
