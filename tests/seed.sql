-- ============================================================
-- nu associates PMC — Dummy Data Seed
-- For sanity testing only — NOT for production
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data (preserve schema)
TRUNCATE TABLE whatsapp_notifications;
TRUNCATE TABLE vendor_payments;
TRUNCATE TABLE vendor_boq_items;
TRUNCATE TABLE vendors;
TRUNCATE TABLE weekly_report_photos;
TRUNCATE TABLE weekly_reports;
TRUNCATE TABLE site_visit_photos;
TRUNCATE TABLE site_visit_observations;
TRUNCATE TABLE site_visits;
TRUNCATE TABLE change_notice_signatories;
TRUNCATE TABLE change_notices;
TRUNCATE TABLE approval_requests;
TRUNCATE TABLE material_requests;
TRUNCATE TABLE boq_items;
TRUNCATE TABLE boq_versions;
TRUNCATE TABLE drawing_queries;
TRUNCATE TABLE drawing_versions;
TRUNCATE TABLE drawings;
TRUNCATE TABLE daily_report_tasks;
TRUNCATE TABLE daily_reports;
TRUNCATE TABLE project_documents;
TRUNCATE TABLE project_photos;
TRUNCATE TABLE task_validations;
TRUNCATE TABLE task_updates;
TRUNCATE TABLE schedule_tasks;
TRUNCATE TABLE schedule_versions;
TRUNCATE TABLE project_assignments;
TRUNCATE TABLE projects;

SET FOREIGN_KEY_CHECKS = 1;

-- ── PROJECT (PV90 — TLD MAINI)
INSERT INTO projects (id, code, name, client, location, project_type, r0_start_date, r0_end_date,
  status, checklist_project_created, checklist_design_boq, checklist_services_boq,
  checklist_schedule, checklist_site_manager, created_by) VALUES
(1, 'PV90', 'PV 90 Production Line', 'TLD MAINI GSE Pvt Ltd', 'Nelamangala, Bengaluru',
  'industrial', '2026-03-23', '2026-05-25',
  'active', 1, 1, 1, 1, 1, 1);

-- ── PROJECT ASSIGNMENT (Anjaneya → PV90)
INSERT INTO project_assignments (project_id, user_id, assigned_by) VALUES
(1, 16, 3),  -- Anjaneya assigned by PMC Head
(1, 17, 3);  -- Suleman also assigned

-- ── SCHEDULE VERSION R0
INSERT INTO schedule_versions (id, project_id, version_number, label, end_date, drift_days,
  status, reason, uploaded_by, approved_by, approved_at, is_current) VALUES
(1, 1, 0, 'R0', '2026-05-25', 0, 'approved', 'Baseline schedule', 3, 1, '2026-03-23 09:00:00', 1);

-- ── SCHEDULE TASKS (8 trades — realistic PV90 scope)
INSERT INTO schedule_tasks (id, project_id, schedule_version_id, trade, task_name, start_date, end_date, display_order) VALUES
-- Civil
(1,  1, 1, 'Civil', 'Basement slab waterproofing', '2026-03-23', '2026-04-05', 1),
(2,  1, 1, 'Civil', 'Mezzanine floor slab pour', '2026-04-06', '2026-04-20', 2),
(3,  1, 1, 'Civil', 'Internal brick partition walls', '2026-04-10', '2026-04-25', 3),
-- Electrical
(4,  1, 1, 'Electrical', 'Main LT panel installation', '2026-04-01', '2026-04-10', 4),
(5,  1, 1, 'Electrical', 'Cable tray and conduit works', '2026-04-08', '2026-04-22', 5),
(6,  1, 1, 'Electrical', 'DB installation and wiring', '2026-04-20', '2026-05-05', 6),
-- HVAC
(7,  1, 1, 'HVAC', 'AHU installation — Ground floor', '2026-04-05', '2026-04-18', 7),
(8,  1, 1, 'HVAC', 'Ducting works — Main hall', '2026-04-15', '2026-05-01', 8),
-- Plumbing
(9,  1, 1, 'Plumbing', 'UG plumbing and drainage', '2026-03-25', '2026-04-08', 9),
(10, 1, 1, 'Plumbing', 'Sanitary fixtures and fittings', '2026-04-25', '2026-05-10', 10),
-- Fire
(11, 1, 1, 'Fire / Suppression', 'Sprinkler pipe network', '2026-04-10', '2026-04-28', 11),
(12, 1, 1, 'Fire / Suppression', 'Fire hydrant system', '2026-04-20', '2026-05-05', 12),
-- IT
(13, 1, 1, 'IT / Networking', 'Server room setup', '2026-04-15', '2026-04-30', 13),
(14, 1, 1, 'IT / Networking', 'Structured cabling — floors 1-3', '2026-04-28', '2026-05-15', 14),
-- Interior
(15, 1, 1, 'Interior', 'False ceiling — offices', '2026-04-22', '2026-05-08', 15),
(16, 1, 1, 'Interior', 'Flooring — production area', '2026-05-01', '2026-05-18', 16),
-- Handover
(17, 1, 1, 'Handover', 'Commissioning and testing', '2026-05-15', '2026-05-22', 17),
(18, 1, 1, 'Handover', 'Snag list and rectification', '2026-05-22', '2026-05-25', 18);

-- ── TASK UPDATES (site manager updates — Anjaneya, user id 16)
-- Simulate real progress as of today (April 12 2026)
INSERT INTO task_updates (task_id, project_id, report_date, pct_complete, notes, is_flagged, flag_note, updated_by) VALUES
(1,  1, '2026-04-11', 100, 'Waterproofing complete, 72hr cure done', 0, NULL, 16),
(2,  1, '2026-04-11', 65,  'Slab poured — eastern half done, western section tomorrow', 0, NULL, 16),
(3,  1, '2026-04-11', 30,  'First lift complete on grid A-C', 0, NULL, 16),
(4,  1, '2026-04-11', 100, 'LT panel installed and terminated', 0, NULL, 16),
(5,  1, '2026-04-11', 75,  'Cable tray complete, conduit 60% done', 1, 'Conduit material short — 25mm dia not available', 16),
(7,  1, '2026-04-11', 100, 'AHU installed and mechanically complete', 0, NULL, 16),
(8,  1, '2026-04-11', 40,  'Main shaft ducting done, horizontal branches pending', 0, NULL, 16),
(9,  1, '2026-04-11', 100, 'UG plumbing complete, pressure tested', 0, NULL, 16),
(11, 1, '2026-04-11', 55,  'Zone A and B complete', 0, NULL, 16),
(13, 1, '2026-04-11', 80,  'Racks installed, UPS wired, patching pending', 0, NULL, 16);

-- ── TASK VALIDATIONS (PMC Head validated completed tasks)
INSERT INTO task_validations (task_update_id, status, validated_by, validated_at) VALUES
(1, 'validated', 3, '2026-04-11 18:30:00'),  -- task 1 waterproofing
(4, 'validated', 3, '2026-04-11 18:30:00'),  -- task 4 LT panel
(8, 'validated', 3, '2026-04-11 18:30:00'),  -- task 9 UG plumbing (update_id 8)
(7, 'validated', 3, '2026-04-11 18:30:00');  -- task 7 AHU

-- ── DRAWINGS
INSERT INTO drawings (id, project_id, drawing_number, drawing_name, category, stream) VALUES
(1, 1, 'A-001', 'Ground Floor Plan', 'Architectural', 'design'),
(2, 1, 'A-002', 'First Floor Plan', 'Architectural', 'design'),
(3, 1, 'S-001', 'Foundation Layout', 'Structural', 'design'),
(4, 1, 'E-001', 'Single Line Diagram', 'Electrical', 'services'),
(5, 1, 'E-002', 'Cable Tray Layout', 'Electrical', 'services'),
(6, 1, 'H-001', 'HVAC Layout — GF', 'HVAC', 'services'),
(7, 1, 'P-001', 'Plumbing Schematic', 'Plumbing', 'services'),
(8, 1, 'F-001', 'Sprinkler Layout', 'Fire', 'services');

-- ── DRAWING VERSIONS
INSERT INTO drawing_versions (id, drawing_id, revision, revision_number, file_path, file_size_kb,
  notes, status, is_current, uploaded_by, l1_reviewed_by, l1_reviewed_at, l2_approved_by, l2_approved_at, issued_at) VALUES
-- Issued drawings
(1, 1, 'R0', 0, 'uploads/drawings/A-001_R0.pdf', 842, 'Initial issue', 'issued', 1, 10, 7, '2026-03-20 10:00:00', 5, '2026-03-21 09:00:00', '2026-03-21 09:00:00'),
(2, 2, 'R0', 0, 'uploads/drawings/A-002_R0.pdf', 756, 'Initial issue', 'issued', 1, 10, 7, '2026-03-20 10:00:00', 5, '2026-03-21 09:00:00', '2026-03-21 09:00:00'),
(3, 3, 'R0', 0, 'uploads/drawings/S-001_R0.pdf', 1240, 'Initial issue', 'issued', 1, 10, 7, '2026-03-20 11:00:00', 5, '2026-03-21 10:00:00', '2026-03-21 10:00:00'),
(4, 4, 'R0', 0, 'uploads/drawings/E-001_R0.pdf', 680, 'Initial issue', 'issued', 1, 15, NULL, NULL, 6, '2026-03-21 14:00:00', '2026-03-21 14:00:00'),
(5, 5, 'R0', 0, 'uploads/drawings/E-002_R0.pdf', 920, 'Initial issue', 'issued', 1, 15, NULL, NULL, 6, '2026-03-21 14:00:00', '2026-03-21 14:00:00'),
(6, 6, 'R0', 0, 'uploads/drawings/H-001_R0.pdf', 1100, 'Initial issue', 'issued', 1, 15, NULL, NULL, 6, '2026-03-22 09:00:00', '2026-03-22 09:00:00'),
(7, 7, 'R0', 0, 'uploads/drawings/P-001_R0.pdf', 540, 'Initial issue', 'issued', 1, 15, NULL, NULL, 6, '2026-03-22 09:00:00', '2026-03-22 09:00:00'),
-- Pending revision
(8, 5, 'R1', 1, 'uploads/drawings/E-002_R1.pdf', 980, 'Cable tray revised — route changed at mezzanine', 'pending_l1', 0, 15, NULL, NULL, NULL, NULL, NULL);

-- ── DRAWING QUERIES
INSERT INTO drawing_queries (id, project_id, drawing_version_id, question, stream, raised_by, raised_at,
  assigned_by, assigned_at, answered_by, answer, answered_at, closed_by, closed_at, resolution_note, status, is_overdue) VALUES
-- Open query (fresh)
(1, 1, 1, 'What is the slab thickness at grid C3 — drawing shows 150mm but RCC schedule says 175mm. Which is correct?',
  'design', 16, '2026-04-11 14:30:00', 3, '2026-04-11 15:00:00', NULL, NULL, NULL, NULL, NULL, NULL, 'assigned', 0),
-- Overdue query (>3 days old)
(2, 1, 4, 'Confirm neutral link size for 400A incomer — drawing E-001 shows 70sqmm but vendor is quoting 95sqmm.',
  'services', 17, '2026-04-07 09:00:00', 3, '2026-04-07 10:00:00', NULL, NULL, NULL, NULL, NULL, NULL, 'assigned', 1),
-- Resolved query
(3, 1, 6, 'AHU access panel — clearance shown as 600mm but site has column at 450mm. Alternative?',
  'services', 16, '2026-04-05 11:00:00', 3, '2026-04-05 12:00:00', 6, 'Access panel relocated to opposite side — revised drawing H-001 R1 to follow.',
  '2026-04-06 09:00:00', 3, '2026-04-06 14:00:00', 'Resolved — revised drawing to be issued', 'closed', 0);

-- ── BOQ VERSIONS
INSERT INTO boq_versions (id, project_id, stream, version_number, label, file_path, is_current, uploaded_by) VALUES
(1, 1, 'design',   1, 'v1', 'uploads/boq/PV90_design_BOQ_v1.xlsx',   1, 5),
(2, 1, 'services', 1, 'v1', 'uploads/boq/PV90_services_BOQ_v1.xlsx', 1, 6);

-- ── BOQ ITEMS (design stream)
INSERT INTO boq_items (id, boq_version_id, project_id, trade, item_code, item_name, unit, quantity) VALUES
-- Civil
(1,  1, 1, 'Civil', 'C001', 'PCC M20 Grade Concrete', 'cum', 45.00),
(2,  1, 1, 'Civil', 'C002', 'RCC M25 Grade Concrete', 'cum', 120.00),
(3,  1, 1, 'Civil', 'C003', 'TMT Fe500 Reinforcement', 'MT',  18.50),
(4,  1, 1, 'Civil', 'C004', 'AAC Block 200mm', 'sqm', 380.00),
(5,  1, 1, 'Civil', 'C005', 'Waterproofing compound', 'kg',  650.00),
-- Interior
(6,  1, 1, 'Interior', 'I001', 'Armstrong grid false ceiling', 'sqm', 420.00),
(7,  1, 1, 'Interior', 'I002', 'Epoxy flooring 3mm', 'sqm', 1200.00),
(8,  1, 1, 'Interior', 'I003', 'Aluminium partition 75mm', 'sqm', 180.00);

-- BOQ ITEMS (services stream)
INSERT INTO boq_items (id, boq_version_id, project_id, trade, item_code, item_name, unit, quantity) VALUES
-- Electrical
(9,  2, 1, 'Electrical', 'E001', 'LT Panel 400A incomer', 'nos', 1.00),
(10, 2, 1, 'Electrical', 'E002', 'FRLS 4sqmm cable', 'mtrs', 2400.00),
(11, 2, 1, 'Electrical', 'E003', 'FRLS 16sqmm cable', 'mtrs', 680.00),
(12, 2, 1, 'Electrical', 'E004', 'Cable tray 100x50mm', 'mtrs', 320.00),
-- HVAC
(13, 2, 1, 'HVAC', 'H001', 'AHU 5TR unit', 'nos', 4.00),
(14, 2, 1, 'HVAC', 'H002', 'GI duct 1.2mm', 'sqm', 850.00),
-- Plumbing
(15, 2, 1, 'Plumbing', 'P001', 'UPVC pipe 110mm', 'mtrs', 180.00),
(16, 2, 1, 'Plumbing', 'P002', 'CP fittings set', 'nos', 24.00),
-- Fire
(17, 2, 1, 'Fire / Suppression', 'F001', 'Sprinkler head pendant type', 'nos', 120.00),
(18, 2, 1, 'Fire / Suppression', 'F002', 'GI pipe class C 25mm', 'mtrs', 450.00);

-- ── MATERIAL REQUESTS
INSERT INTO material_requests (id, project_id, boq_item_id, quantity_needed, needed_by_date,
  status, notes, raised_by, raised_at, ordered_by, ordered_at) VALUES
-- Active requests
(1, 1, 2,  25.0, '2026-04-15', 2, 'For mezzanine slab pour',     16, '2026-04-09 08:00:00', 3, '2026-04-09 11:00:00'),
(2, 1, 3,   4.5, '2026-04-15', 2, 'TMT for mezzanine',            16, '2026-04-09 08:00:00', 3, '2026-04-09 11:00:00'),
(3, 1, 10, 600.0,'2026-04-14', 1, '4sqmm FRLS needed urgently',   16, '2026-04-11 09:00:00', NULL, NULL),
-- Overdue request
(4, 1, 12, 180.0,'2026-04-08', 1, 'Cable tray for east wing',     16, '2026-04-05 10:00:00', NULL, NULL),
-- Validated request
(5, 1, 5, 200.0, '2026-04-05', 5, 'Waterproofing compound',       16, '2026-04-01 08:00:00', 3, '2026-04-01 12:00:00');

-- Mark cable tray as overdue
UPDATE material_requests SET is_overdue = 1 WHERE id = 4;

-- ── VENDORS
INSERT INTO vendors (id, project_id, trade, vendor_name, contact_person, phone, gst_number,
  bank_name, bank_account, bank_ifsc, contract_value, stream, registered_by, notes) VALUES
(1, 1, 'Civil', 'Srinivasa Constructions', 'Ramu', '9845012345', '29AABCS1234F1Z5',
  'Canara Bank', '0987654321001', 'CNRB0001234', 1850000.00, 'civil', 3, 'Civil works contractor'),
(2, 1, 'Electrical', 'Lakshmi Electricals', 'Suresh Kumar', '9876543210', '29AACLS5678G1Z3',
  'SBI', '1234567890123', 'SBIN0012345', 980000.00, 'services', 3, 'Electrical contractor'),
(3, 1, 'HVAC', 'Cool Air Systems', 'Venkat', '9900112233', '29AACCA9012H1Z1',
  'HDFC Bank', '5678901234567', 'HDFC0001234', 1240000.00, 'services', 3, 'HVAC contractor');

-- ── VENDOR BOQ ASSIGNMENTS with our cost rates
INSERT INTO vendor_boq_items (vendor_id, boq_item_id, our_cost_rate, our_cost_total, notes, entered_by) VALUES
-- Civil vendor
(1, 1, 3800.00,  171000.00, 'PCC rate per cum', 3),
(1, 2, 5200.00,  624000.00, 'RCC rate per cum', 3),
(1, 3, 58000.00, 1073000.00,'TMT rate per MT',  3),
-- Electrical vendor
(2, 9,  285000.00, 285000.00,'LT panel supply and erect', 3),
(2, 10, 145.00,    348000.00,'4sqmm FRLS per mtr',       3),
(2, 11, 280.00,    190400.00,'16sqmm FRLS per mtr',      3),
(2, 12, 420.00,    134400.00,'Cable tray per mtr',       3),
-- HVAC vendor
(3, 13, 185000.00, 740000.00,'AHU supply and install',   3),
(3, 14, 580.00,    493000.00,'GI duct per sqm fabr+inst',3);

-- ── VENDOR PAYMENTS (this week's payment requests)
INSERT INTO vendor_payments (id, project_id, vendor_id, payment_type, amount_requested,
  work_done_pct, amount_auto_calc, notes, raised_by, raised_at, week_ending, status) VALUES
-- Civil RA bill — 30% done on civil items
(1, 1, 1, 'running_account_bill', 555000.00, 30.00, 1,
  'RA Bill 1 — civil works 30% complete. Waterproofing and first lift partition done.',
  3, '2026-04-11 16:00:00', '2026-04-12', 'pending'),
-- Electrical advance
(2, 1, 2, 'advance',              200000.00, NULL,  0,
  'Mobilisation advance for electrical works',
  3, '2026-04-05 10:00:00', '2026-04-05', 'processed'),
-- HVAC RA bill
(3, 1, 3, 'running_account_bill', 434000.00, 35.00, 1,
  'RA Bill 1 — HVAC 35% complete. AHU installed, ducting in progress.',
  3, '2026-04-11 16:00:00', '2026-04-12', 'pending');

-- ── APPROVAL REQUESTS
INSERT INTO approval_requests (id, project_id, request_type, title, details, drift_days,
  ref_table, ref_id, raised_by, raised_at, status) VALUES
(1, 1, 'weekly_report', 'Weekly Report — Week 15', 'Progress summary for week ending April 12 2026', NULL,
  NULL, NULL, 3, '2026-04-11 17:00:00', 'pending');

-- ── CHANGE NOTICES
INSERT INTO change_notices (id, project_id, cn_number, title, description, source,
  affected_drawings, boq_impact, schedule_impact_days, raised_by, raised_at,
  sig_design_head, sig_services_head, sig_pmc, status) VALUES
(1, 1, 'CN001', 'Cable tray route change at mezzanine',
  'Client requested cable tray to be re-routed below mezzanine slab to avoid interference with HVAC ducting at grid D4. Requires 15m additional cable tray and 40m additional FRLS cables.',
  'client', 'E-002', 1, 2, 16, '2026-04-10 11:00:00',
  1, 1, 3, 'pending_approval');

-- ── WEEKLY REPORT
INSERT INTO weekly_reports (id, project_id, week_ending, week_number, summary, issues_for_client,
  status, drafted_by, created_at) VALUES
(1, 1, '2026-04-12', 15,
  'Week 15 saw significant progress across civil and MEP works. Basement waterproofing is complete (100%) and certified. LT panel installation is complete (100%). Mezzanine slab pour is 65% complete with completion expected by April 16. AHU installation for ground floor is complete. Cable tray works are 75% complete with minor material shortage on 25mm conduit being resolved.',
  'Cable tray conduit material (25mm dia) — shortage at vendor end. Please advise if any alternative supplier to be engaged or wait for existing PO delivery (ETA April 14).',
  'draft', 3, '2026-04-11 17:00:00');

-- ── PHOTO RECORDS (metadata only — files don't need to exist for testing)
INSERT INTO project_photos (project_id, task_id, photo_date, file_path, file_size_kb, caption, uploaded_by, source) VALUES
(1, 1, '2026-04-11', 'uploads/photos/anjaneya_20260411_001.jpg', 820, 'Waterproofing completed', 16, 'app'),
(1, 4, '2026-04-11', 'uploads/photos/anjaneya_20260411_002.jpg', 950, 'LT panel installation', 16, 'app'),
(1, 7, '2026-04-11', 'uploads/photos/anjaneya_20260411_003.jpg', 1100,'AHU installed',           16, 'app'),
(1, 2, '2026-04-11', 'uploads/photos/anjaneya_20260411_004.jpg', 880, 'Mezzanine slab east half', 16, 'app'),
(1, 5, '2026-04-11', 'uploads/photos/anjaneya_20260411_005.jpg', 760, 'Cable tray works',         16, 'app');

