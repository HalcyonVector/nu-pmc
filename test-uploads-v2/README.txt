NU PMC — TEST UPLOADS FOLDER
============================
Every folder corresponds to one upload point in the system.
Use the file(s) inside to test that specific button/form.

FOLDER                              WHERE TO UPLOAD IN THE SYSTEM
------                              ------------------------------
01_site-photos/                     Site → Photos → Upload Photos (can upload up to 40 at once)
02_issue-defect-photo/              Site → Issues/Defects → Raise New Issue → attach photo
03_meeting-site-visit-photo/        Workflow → Meetings → [open a MOM] → Site Visit → attach photo
04_drawing-register/                Design-Services → Drawing Register → Upload Register
                                     Use design-drawing-register.xlsx for DESIGN stream
                                     Use services-drawing-register.xlsx for SERVICES stream
05_drawings/                        Design-Services → Drawings → Upload Drawing
                                     Drawing number MUST match a row in the register first
                                     Use PDFs or DXF; replace .dwg placeholder with real file
06_project-schedule/                Design-Services → Schedule → Upload Schedule
07_design-boq/                      Design-Services → BOQ → Upload BOQ → select stream: Design
08_services-boq/                    Design-Services → BOQ → Upload BOQ → select stream: Services
09_client-boq/                      Onboarding → Client BOQ → Upload BOQ
10_grn/                             Site → GRN → Create GRN → attach BOTH files:
                                       grn-delivery-note.pdf  →  Delivery Note field
                                       grn-vendor-invoice.pdf →  Invoice field
11_payment-request-evidence/        Finance → Payment Requests → Raise Payment → attach evidence
                                     Up to 5 PDF files allowed
12_urgent-payment/                  Finance → Urgent Payments → New Urgent Payment
                                       urgent-payment-invoice.pdf →  Invoice field
                                       urgent-payment-upi-qr.png  →  UPI QR Code field
13_petty-cash-bill/                 Finance → Petty Cash → Add Entry → attach bill
14_direct-payment-receipt/          Finance → Direct Payments → Add → attach receipt (Principal only)
15_icici-payment-confirmation/      Finance → Payments → ICICI → Confirm Payment → Upload Confirmation
16_vendor-master-bulk-upload/       Onboarding → Vendors → Master → Bulk Upload
                                     Creates vendors in the master list (not yet assigned to a project)
17_vendor-engagements-bulk-upload/  Onboarding → Vendors → [select project] → Engagements → Bulk Upload
                                     Assigns vendors to a project with scope & contract value
18_users-bulk-upload/               Admin → User Management → Bulk Upload Users
                                     Roles must be EXACT: jr_architect, site_manager, etc.
19_clients-bulk-upload/             Onboarding → Clients → Bulk Upload
                                     GSTIN is mandatory; state is auto-derived from first 2 digits
20_project-documents/               Onboarding → Projects → [open project] → Documents → Upload
21_handover-document/               Site → Handover → Upload Handover Document
22_measurement-signed-certificate/  Workflow → Measurements → [select RA Bill] → Upload Signed Certificate
23_weekly-report/                   Reporting → Weekly Reports → Upload Report (PDF)
24_mom-reissue-document/            Workflow → Meetings → [open MOM] → Reissue → Upload New PDF
25_meeting-observation-file/        Workflow → Meetings → [open MOM] → Observation → Upload File
26_fee-schedule/                    Finance → Invoices → Fee Schedule → Upload Schedule
27_site-form-template/              Site → Forms → Templates → Upload Template (XLSX)
28_site-form-submission/            Site → Forms → [open a project form] → Submit → Upload Filled Form
29_daily-report/                    Work → Today's Report → Submit Today's Report → Site Photo / Attachment
                                     Role: Site Manager or Senior Site Manager (must be assigned to project)
                                     Optional photo or PDF attached to the end-of-day report
                                     PMC Head sees a "View Attachment" link on each report card

WHO READS DAILY REPORTS
------------------------
- Site Manager / Senior Site Manager: submit via the "Today's Report" pinned card in Work tab
- PMC Head: reviews under Reporting → Daily Reports (
ROLE CORRECTIONS (upload audit, 2026-07-01)
-------------------------------------------
16_vendor-master-bulk-upload  — owner is PRINCIPAL (with PMC), NOT IT Admin.
19_clients-bulk-upload        — owner is PRINCIPAL / FINANCE ADMIN, NOT IT Admin.
  Reason: it_admin is read-only on business data (middleware/it-admin-readonly.js);
  it may only write user/system/governance endpoints. Only 18_users-bulk-upload is
  legitimately an IT Admin action.

BEHAVIOUR CHANGES (upload audit 2026-07-01) — relevant when testing
-------------------------------------------------------------------
- 12_urgent-payment: the sample "urgent-payment-upi-qr.png" is NOT a machine-
  readable QR, so the upload returns "No QR code found in image". The two-file
  upload itself works — swap in a real UPI QR image to complete this flow.
- 13_petty-cash: category must be one of labour / material / site_expense / other
  (an invalid value now returns 400 instead of a 500).
- 14_direct-payment: payment type may be upi / cash / bank_transfer / cheque /
  card / other (the DB enum was widened to match the dropdown; non-upi/cash used
  to 500).
- 26_fee-schedule: usable by FINANCE ADMIN (and principals/PMC), not principal-only.
- 09_client-boq: PMC Head can edit rates but no longer sees the Upload button
  (upload is for stream heads / principals).
- 17_vendor-engagements-bulk: stream heads (Design/Services Head) may initiate,
  in addition to PMC / principals (engagements still go to approval).
- 21 handover / 20 project-documents now accept .doc/.docx; 27 form-template
  accepts .csv (in addition to .xlsx).
