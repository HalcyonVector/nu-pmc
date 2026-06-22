# nu PMC — Employee System Guide
### Complete Reference for Every Role and Every Flow

*nu associates | Architecture · Engineering · PMC*
*This document reflects the system as of June 2026.*

---

## Table of Contents

1. [What is nu PMC?](#1-what-is-nu-pmc)
2. [Logging In and Getting Started](#2-logging-in-and-getting-started)
3. [User Roles — What Each Role Can and Cannot Do](#3-user-roles)
4. [The Project Lifecycle — From Start to Handover](#4-the-project-lifecycle)
5. [Vendor Bank Detail Changes — The Dual-Approval Flow](#5-vendor-bank-detail-changes)
6. [Drawings, Schedule, and BOQ (Design & Services)](#6-drawings-schedule-and-boq)
7. [Site Operations](#7-site-operations)
8. [Finance — The Complete Money Flow](#8-finance)
9. [Meetings, Changes, Approvals, and Measurements (Workflow)](#9-workflow-module)
10. [Reports and the Dashboard (Reporting)](#10-reporting-module)
11. [Notifications — In-App and WhatsApp](#11-notifications)
12. [How the System Prevents Errors When Multiple People Work Simultaneously](#12-concurrency-and-data-safety)
13. [The Audit Log — Every Action is Recorded](#13-the-audit-log)
14. [AI-Assisted Features](#14-ai-features)
15. [File Uploads](#15-file-uploads)
16. [Governance, SLAs, and Project-Specific Settings](#16-governance-and-slas)
17. [Common Workflows — Quick Reference](#17-common-workflows-quick-reference)
18. [Error Messages and What They Mean](#18-error-messages)
19. [Glossary](#19-glossary)
20. [Who to Contact for System Issues](#20-who-to-contact)

---

## 1. What is nu PMC?

nu PMC is the internal software platform used by nu associates to manage every aspect of a construction project — from the first client meeting to the final handover. It is not a generic tool: it was built specifically for the way nu associates works, with Indian billing formats, WhatsApp notifications, and multi-party approval chains baked in from the start.

Think of it as the single place where design drawings, vendor payments, site reports, budgets, schedules, and client invoices all come together. Instead of passing files by email or keeping separate spreadsheets for each project, every team member works inside nu PMC, and the system remembers every action, approval, and change.

### 1.1 Who uses the system?

Every person who touches a project has a login. The system recognises the following roles:

| Role | What they do in nu PMC |
|------|------------------------|
| Principal | Gives final approval on vendor payments and major decisions. Sees everything across all projects. |
| Design Principal | Senior design authority. Approves drawings and high-value sign-offs. |
| PMC Head | Runs project management. Approves vendor payment requests before they go to Principal. |
| Design Head | Manages the design team. Approves drawings in the design stream. |
| Services Head | Manages the MEP/services team. Approves drawings in the services stream. |
| Finance Admin | Handles all money flows — invoices, payments, budget, GST, TDS. |
| Site Manager | Runs the physical site. Fills daily reports, records GRNs, manages issues. |
| Trainee | Read-only access to most things. Can raise issues, submit photos, and record site visits. |

### 1.2 How the system is organised (Modules)

nu PMC is divided into eight functional areas, called modules. Each module owns a specific slice of the project and controls its own data. Other modules can read that data but cannot change it directly — they must go through the owning module. This design prevents accidental overwriting and keeps a clean audit trail.

| Module | Short name | What it owns |
|--------|-----------|--------------|
| Auth & Users | M1 | Logins, roles, password resets, user accounts |
| Onboarding | M2 | Projects, clients, vendors, BOQ, documents, team assignments |
| Readiness Gate | M3 | Project activation checklist (must pass before site work begins) |
| Site | M4 | Daily reports, GRNs, issues, photos, snags, labour, custom forms |
| Finance | M5 | Payments, budget, invoices, GST, petty cash, client receipts |
| Reporting | M6 | Dashboard, Gantt, weekly health, needs-you, pending items |
| System | M7 | Navigation, notifications, WhatsApp messages, AI triggers, delegations |
| Design & Services | DS | Drawings, schedules, BOQ, material requests |
| Workflow | WF | Meetings, change notices, approvals, measurements, submittals |

---

## 2. Logging In and Getting Started

### 2.1 First login — you must change your password

When your account is created, an administrator sets a temporary password and sends it to you via WhatsApp. The first time you log in, the system will block everything else and show you a password-change screen. You cannot skip this step.

The new password you choose must meet **all** of these rules:

- At least 8 characters long
- Contains at least one lowercase letter (a–z)
- Contains at least one uppercase letter (A–Z)
- Contains at least one digit (0–9)
- Must not be on the list of commonly-breached passwords (e.g. "Password1", "Welcome@123", "Admin123", "nupmc@2026")
- Must not contain your own username

> **Why so strict?** Construction projects involve real money — vendor bank accounts, payment approvals, client invoices. A weak password is an open door. Every person with a login is a potential entry point.

### 2.2 What happens if the system forces a password change mid-session?

If an administrator resets your password (for example, because you forgot it), the system will block all your actions with a "MUST_CHANGE_PASSWORD" message the next time you use your session. Only three actions are allowed until you change it:

- Viewing your own profile (`/auth/me`)
- Changing your password (`/auth/change-password`)
- Logging out (`/auth/logout`)

Everything else returns an error until the new password is set.

### 2.3 Forgotten password — OTP via WhatsApp

If you forget your password, click "Forgot password" on the login screen. The system sends a one-time code (OTP) to your registered WhatsApp number. Enter the code, then choose a new password that meets the rules above. The OTP is valid for a short time only — if it expires, request a new one.

### 2.4 What you see after login — the Navigation

The tabs and menu items you see depend entirely on your role. A trainee sees far fewer options than a PMC Head. The navigation is configured per-role in the system and can be customised by an IT Admin without touching the code. If a tab seems to be missing, check with your manager — it may simply not be enabled for your role yet.

---

## 3. User Roles — What Each Role Can and Cannot Do

### 3.1 Trainee — read-only with limited write access

Trainees are the most restricted role. By default, every write operation is blocked except for a specific list of allowed actions.

| Action | Allowed? |
|--------|----------|
| View drawings, schedule, BOQ, GRNs | YES — read-only |
| Submit a daily site report | YES |
| Upload site photos | YES |
| Raise an issue or snag | YES |
| Record a site visit / observation in meetings | YES |
| Write a lessons-learned input after project close | YES |
| Approve payments or change notices | NO |
| View financial data (payments, invoices, fee schedule) | NO |
| Create or edit vendor records | NO |
| Upload or approve drawings | NO |
| Manage users | NO |
| View client billing information | NO |
| Access approval workflows | NO |

### 3.2 Site Manager

Site Managers run the physical site. They have full write access to all site-related items: daily reports, GRNs, issues, photos, snags, the labour register, and custom forms. They also participate in meetings and site visits. They do **not** have access to the finance module.

### 3.3 Design Head / Services Head

These roles manage their respective drawing and technical streams. They can upload, version, review, and approve drawings. They manage schedule tasks and BOQ items. They can propose vendor bank-detail changes (but cannot approve them — another person must do that). They do not approve vendor payments.

### 3.4 PMC Head

The PMC Head is the **first approver** in the vendor payment chain. When a payment request is raised by Finance Admin, it goes to the PMC Head first. PMC Head can approve or reject it. If approved, it moves to the Principal. The PMC Head also manages project assignments and can propose vendor bank changes.

### 3.5 Finance Admin

Finance Admin controls all money flows: raising payment requests, generating proforma invoices, tracking budget, recording petty cash, filing GST and TDS data, and managing the fee schedule. Finance Admin is the **only person** who can raise a payment request. Finance Admin can also approve vendor bank changes proposed by non-finance heads.

### 3.6 Principal and Design Principal

These are the **final approvers**. Vendor payments that have passed PMC approval come to the Principal for final sign-off before any money moves. Principals see everything across all projects. Design Principal is specifically the authority for high-value design approvals.

### 3.7 Delegations — acting on behalf of someone

If a role-holder is unavailable (travelling, on leave), they can activate a delegation that temporarily grants another named person their approval authority. The delegation is time-limited. Once a delegation is active, the nominated deputy can approve on behalf of the absent person and the audit trail records both names — the deputy who acted and the principal who delegated.

---

## 4. The Project Lifecycle — From Start to Handover

Every project moves through a defined sequence of states. Certain actions are only possible in certain states.

| Project State | What it means |
|--------------|---------------|
| `initialising` | Project has been created but the pre-start checklist is not yet complete. Site work cannot begin. |
| `active` | All seven checklist items are done. The project is live and all modules are fully open. |
| `on_hold` | Temporarily paused (client decision, legal issue, etc.). |
| `completed` | Physical work is done. Handover and closure in progress. |
| `closed` | Final sign-off done. Project is archived. |

### 4.1 Creating a project (Onboarding module)

Only a user with the appropriate PMC or Principal role can create a new project. When a project is created, the system records:

- Project name, code, and description
- Which company entity (which nu associates entity is billing the client)
- The client — either an existing client or a new one added at this step
- The billing account (which bank account will receive client payments)
- The fee schedule — the milestone-based payment plan for the client

Creating the project ticks the first checklist item (`project_created`). Six more items must be completed before the project can go active.

### 4.2 The seven-item activation checklist (Readiness Gate)

This is the most important gate in the entire system. A project **cannot** move from "initialising" to "active" until all seven items are marked complete. The system checks this automatically — there is no manual override.

**Step 1 — Project record created**
The project, client, and basic metadata are saved. This happens automatically when you create the project.

**Step 2 — Design drawing register signed off**
The list of all expected design drawings is agreed and finalised. Both the design team and the relevant signatory must agree on what drawings are required before work begins.

**Step 3 — Services drawing register signed off**
The same as step 2, but for MEP (mechanical, electrical, plumbing) and services drawings.

**Step 4 — Design BOQ uploaded**
The design Bill of Quantities is uploaded to the system. This is the line-item breakdown of all design-stream work with rates and quantities.

**Step 5 — Services BOQ uploaded**
The services/MEP BOQ is uploaded. Same as step 4 for the services stream.

**Step 6 — R0 schedule uploaded and approved**
The baseline project schedule is in place. R0 means "revision zero" — the original agreed plan before any changes. This is the reference point for all future schedule comparisons.

**Step 7 — Site Manager assigned**
There is a named person responsible for daily site operations. Without a site manager, no one is formally accountable for site reporting.

> **What happens when you try to activate early?**
> The system returns a list of the specific blockers that are not yet done.
> For example: *"2 blockers: Design BOQ not uploaded; Site manager not assigned."*
> Fix those specific items and try again.

### 4.3 Adding the team

Once the project is created, team members are assigned to it. Each assignment links a specific user to the project with their role for that project. The site manager assignment is tracked separately because it is one of the seven checklist items.

### 4.4 Vendor onboarding (before any payment can happen)

No vendor can be paid until they pass the vendor clearance workflow. This is a one-time check per vendor (not per project). The steps are:

1. **Vendor master record created** — name, PAN, GSTIN, contact details entered
2. **Bank details entered** — account number, IFSC code, bank name. This triggers the vendor bank dual-approval flow (see Section 5)
3. **Documents verified** — Finance Admin checks PAN, GSTIN, and bank details against the originals (PAN card copy, GSTIN certificate, cancelled cheque or bank letter)
4. **Vendor marked as "cleared"** — Finance Admin or authorised person confirms the vendor is ready to receive payments

> **IMPORTANT:** A vendor whose clearance status is not "cleared" cannot receive a payment. If a vendor's bank details change after clearance, the clearance is automatically reset to "pending" and the bank change approval flow must be completed before the next payment.

---

## 5. Vendor Bank Detail Changes — The Dual-Approval Flow

Changing a vendor's bank account is one of the **highest-risk actions** in the system. A fraudulent bank change is the most common way construction payments are diverted. nu PMC therefore requires two separate people from different roles to agree on every bank detail change — the person who proposes it cannot be the same person who approves it.

### 5.1 Who can propose a bank change?

Finance Admin, PMC Head, Design Head, or Services Head can propose a change. Principals can view but **cannot** propose — they can only approve or reject.

### 5.2 Who approves?

The approver depends on who proposed:

| Proposer | Who can approve |
|----------|----------------|
| Finance Admin | Principal or Design Principal **only** |
| PMC Head / Design Head / Services Head | Principal, Design Principal, or Finance Admin |

The same person who proposed **cannot** approve, even if their role would otherwise allow it. This is a hard rule in the system — it cannot be bypassed.

### 5.3 Step-by-step flow

**Step 1 — Proposal**
An authorised staff member goes to Finance → Vendors → the vendor's record → Propose Bank Change. They must provide:
- The new bank details (account number, IFSC, bank name)
- A written reason for the change (minimum 5 characters — a blank reason is rejected)

The system rejects the proposal if nothing is actually changing (i.e. the new details are identical to the current ones).

**Step 2 — Duplicate check**
The system checks that no other bank-change proposal is already pending for this vendor. Only one proposal at a time is allowed. If there is an existing pending proposal, it must be resolved (approved, rejected, or cancelled) before a new one can be raised.

**Step 3 — Proposal record created**
A proposal record is stored with a before/after snapshot of the bank details and the proposer's identity and reason.

**Step 4 — Vendor confirmation via Matrix**
A confirmation poll is sent to the vendor's personal Matrix room (a secure messaging channel) asking the vendor to confirm the new details are correct. This is an independent check — the vendor themselves verifies that the change is genuine.

**Step 5 — Peer approval**
After the vendor confirms, the appropriate approver (based on who proposed) receives a notification. They review:
- The current (before) bank details
- The proposed (after) bank details
- The stated reason
- Who proposed the change

They either **approve** or **reject**. If they reject, they must give a reason. The original proposer can also **cancel** the proposal at any point before approval if they realise it was a mistake.

**Step 6 — Commitment (on approval)**
If approved:
- The vendor's bank details are updated to the new values
- The vendor's clearance status is reset to "pending" (even though the change was approved, Finance Admin must re-verify the vendor before the next payment)
- Two audit events are written: `bank_change.approved` and `bank_change.committed`

**Step 7 — Re-clearance**
Finance Admin receives a notification. They verify the new bank details against the bank's confirmation and re-mark the vendor as cleared. Only then can the next payment proceed.

> **Why does approval reset the clearance?**
> Even after the bank details are confirmed correct, Finance Admin needs to verify the new details against a physical bank document (cancelled cheque or bank letter) before the next payment can proceed. Approval of the change is not the same as re-verifying the vendor.

The full trail — who proposed, when, what changed, who confirmed (vendor), who approved, and the before/after snapshots — is recorded permanently in the audit log and can never be deleted.

---

## 6. Drawings, Schedule, and BOQ (Design & Services Module)

The Design & Services module manages the technical heart of the project — the drawings that define what gets built, the schedule that defines when, and the BOQ that defines the cost of each item.

### 6.1 Drawings — upload, version, review, approve

Every drawing in nu PMC is **versioned**. You never simply "replace" a drawing — you upload a new version, and all previous versions are kept. This is important for the paper trail: if there is a dispute about what was specified at a given point in time, you can retrieve the exact drawing that was current then.

The drawing lifecycle:

**Step 1 — Upload**
Design Head or their team uploads the drawing. The system assigns a drawing number and sets it to draft status. The drawing is tagged with its stream (design or services).

**Step 2 — AI check (if enabled)**
The system can run automated checks on the drawing and flag potential issues — missing title blocks, incorrect revision numbering, consistency with the drawing register.

**Step 3 — Review**
Design Head (or Services Head, depending on stream) reviews the drawing. They can request revisions.

**Step 4 — Revision (if needed)**
If revisions are requested, the draughtsperson uploads a new version. Each version has a revision letter (A, B, C…). The revision cycle can repeat as many times as needed.

**Step 5 — Approval**
When satisfied, the Design Head marks the drawing as "approved". Approved drawings can be issued to the site.

**Step 6 — Issue**
The approved drawing is issued to site. A WhatsApp notification goes to the Site Manager and relevant team members.

**Step 7 — Supersession (if updated later)**
If a drawing is superseded by a later version, the earlier version is flagged as superseded but remains visible in the history. You can always see exactly what was current at any point in the project.

### 6.2 The Drawing Register

Before any drawings are uploaded, the Drawing Register is set up. This is a list of all the drawings that are **expected** for the project — a kind of master index. When a drawing is uploaded and approved, it gets ticked off against the register.

The register serves two purposes:
- It is one of the seven checklist items (signing off the register means both parties agree on what drawings are required)
- It gives a real-time view of which expected drawings are still outstanding

### 6.3 The Project Schedule

The schedule in nu PMC is a structured list of tasks organised into a Gantt chart. The baseline ("R0") schedule is the agreed plan at project start. As the project progresses:

- Site managers and team members update task status (not started / in progress / done)
- If the scope or timeline changes, a formal schedule revision is uploaded (R1, R2, etc.)
- The Gantt view in the Reporting module shows the current state visually

The R0 schedule must be uploaded and approved before the project can be activated — it is checklist item 6.

**Task Updates vs Schedule Revisions**
- A task update is a routine status update (marking a task as complete)
- A schedule revision is a structural change (adding tasks, moving milestones, changing the plan). Revisions require upload and approval like a new drawing.

### 6.4 BOQ — Bill of Quantities

The BOQ is the line-item breakdown of every material and work item in the project with its rate and quantity. nu PMC maintains **two separate BOQs**: one for the design/architectural stream and one for the services/MEP stream. Uploading and signing off both BOQs is part of the activation checklist (items 4 and 5).

The BOQ is also linked to the budget module — the BOQ rates become the basis for budget allocation and for checking whether payment requests are within contract values.

### 6.5 Material Requests

When site needs materials that are not yet on site, a Material Request is raised within the Design & Services module. This creates a formal requisition tied to a BOQ line item. Finance uses the material request as the basis for raising a material advance payment to the vendor who will supply the materials.

---

## 7. Site Operations (Site Module)

The Site module is what the Site Manager and site team use every day. It records what is happening physically on the ground.

### 7.1 Daily Site Reports

Every working day, the Site Manager is expected to submit a daily report. This report captures:

- Date and weather conditions
- Headcount — how many workers of each trade were present
- Brief notes on work completed today
- Any notable events or safety observations

Once submitted, the report can be viewed by anyone with project access. The Weekly Health Report (in the Reporting module) aggregates daily reports to give a week-by-week summary that is shared with the Principal every Monday morning.

If a daily report is not submitted by the configured reminder time, the Site Manager receives a WhatsApp reminder.

### 7.2 GRNs — Goods Received Notes

A GRN (Goods Received Note) is created whenever materials are delivered to site. It records:

- Which vendor delivered the material
- What was delivered and in what quantity
- The date and time of delivery
- The person who received and inspected the goods
- Any discrepancies between what was ordered and what arrived

A GRN starts in "pending" status. The Site Manager approves it once the delivery is verified against the delivery challan. **Only approved GRNs can be used as the basis for a vendor payment request** — this prevents payment for goods that were never actually received.

> The Finance module checks GRN status automatically when a payment is raised. If the relevant GRN is not yet approved, the payment cannot proceed.

### 7.3 Issues — RFIs, Queries, Safety, Quality, Snags

The Issues system is used to raise and track any problem or question that arises on site. All of the following are recorded as issues with different types:

| Issue Type | When to use it |
|-----------|---------------|
| RFI (Request for Information) | A site question that needs an answer from the design team before work can proceed |
| Design Query | A specific question about a drawing or design detail |
| Safety Flag | A safety hazard observed on site that needs immediate attention |
| Quality Flag / NCR | A non-conformance — something not built to spec |
| Snag | A punch-list defect identified during or after completion |

Each issue is assigned to a person to resolve. It stays open until the assignee marks it resolved. Open issues appear on the "Needs You" dashboard for the relevant people. The person who raised the issue gets a notification when it is resolved.

### 7.4 Site Photos

The site team can upload photos directly from the site. The system uses AI to suggest tags for each photo (what it shows, which area, which trade). Photos are attached to the project and can be filtered by date, area, or tag. They provide a visual progress record and are useful evidence in any dispute.

Photos can also be attached to meetings, GRNs, and issues for specific context.

### 7.5 Labour Register

The labour register records the daily headcount per contractor and per trade. This feeds into the reporting module for labour productivity tracking and is used to verify contractor billing. If a contractor bills for 50 workers on a given day but the labour register shows only 35 were on site, that discrepancy is visible immediately.

### 7.6 Custom Forms

Site managers can create custom form templates for recurring data collection tasks specific to a project (for example, a daily concrete pour checklist, or a pre-pour inspection form). Field staff fill these forms on-site and the data is stored in the system against the project and date.

---

## 8. Finance — The Complete Money Flow

The Finance module handles all money movement: outgoing payments to vendors, incoming receipts from clients, budget tracking, statutory compliance (GST and TDS), and client invoicing. Finance Admin is the primary user of this module, but every approver role needs to understand how the payment approval chain works.

### 8.1 Vendor Payment Flow — step by step

This is the most important flow in the system. **Every rupee that leaves the company goes through this process.**

**Step 1 — Finance Admin raises a payment request**
Finance Admin goes to Finance → Payments → New Payment Request. They fill in:
- The vendor (must be a cleared vendor)
- The engagement (the specific contract this payment relates to)
- The amount
- The type of payment (see Section 8.3 for types)
- Any relevant GRN references (for material payments)

**Step 2 — Automatic sanity check**
The system runs the following checks automatically:
- The amount does not exceed the vendor's contract value for this engagement
- The cumulative total of all past payments + all pending payments + this new request does not exceed the contract value
- If the request is more than 50% of the contract value in one go, a warning flag is raised (but the request is not blocked)
- If the amount is more than 3× the vendor's typical bill on this engagement, another warning flag is raised

If any **hard limit** is exceeded, the request is blocked. If only warnings are triggered, Finance Admin sees them and can proceed.

**Step 3 — Payment enters "pending_pmc" status**
The PMC Head receives an in-app notification and a WhatsApp message: a payment request is waiting for their review.

**Step 4 — PMC Head approves or rejects**
PMC Head reviews: the vendor, the amount, the engagement, and the supporting details. They can:
- **Approve** → the request moves to "pmc_approved" (displayed as "pending_principal")
- **Reject** → the request moves to "pmc_rejected". PMC Head must give a reason.

**Step 5 — Principal approves or rejects**
The Principal receives a notification. They review the same details plus the PMC Head's approval. They can:
- **Approve** → the request moves to "principal_approved"
- **Reject** → "principal_rejected". Principal must give a reason.

**Step 6 — ICICI payment file generated**
Finance Admin generates the bank payment file for ICICI and uploads it to the ICICI corporate banking portal. The bank processes the transfer.

**Step 7 — UTR recorded and vendor notified**
Once the bank confirms the transfer, Finance Admin records the UTR (Unique Transaction Reference) number in nu PMC. The payment status moves to "paid". A WhatsApp confirmation is sent to the vendor.

> **Concurrency protection:** The system uses a state machine for every payment status change. If two people try to approve the same payment simultaneously, the second person gets an error: *"Row was not in state 'pending_pmc' — may have been transitioned by another request."* Reload the page to see the current status.

### 8.2 Urgent payments

An "urgent" flag can be set on a payment request to indicate it needs faster processing. Urgent payments appear at the top of the approval queue and trigger an additional WhatsApp alert to the approvers. The approval steps are the same — urgent only affects visibility and prioritisation, not the number of approvals required.

### 8.3 Payment types and what they mean

| Payment Type | What it is |
|-------------|-----------|
| Running Account Bill (RA Bill) | Periodic payment for work completed to date. Most common type. Usually raised after each site measurement is certified. |
| Mobilisation Advance | Upfront payment to help a vendor mobilise equipment and labour before work starts. Recovered against future RA bills. |
| Material Advance | Advance for materials to be procured. Recovered when materials are delivered and the GRN is raised and approved. |
| Final Bill | Last payment after all work is complete and all defects are rectified. |
| Petty Cash | Small miscellaneous expenses paid directly from a site petty cash fund without the full approval chain. |

### 8.4 Budget — cost heads and variance

The budget is organised by **cost heads** — categories of expenditure (Civil, Structural, Electrical, Plumbing, etc.). Each cost head has an allocated budget. As payment requests are raised and paid, the actual spend is tracked against each head. Finance Admin and the PMC Head can see a real-time variance: how much was budgeted versus how much has been committed or paid.

Budget flags can be set to alert the team when a cost head is approaching its limit. This gives Finance Admin early warning before the budget is actually exceeded.

### 8.5 Client Invoicing — Proforma Invoice (PI)

nu associates bills its clients based on a fee schedule — a set of agreed milestones (e.g. "Schematic Design complete", "Construction Documents issued", "Handover"). When a milestone is reached:

1. Finance Admin raises a Proforma Invoice (PI) for that milestone in Finance → Invoices
2. The system automatically generates a PDF with:
   - The firm's letterhead and details (from the company entity record)
   - Client name, address, and GSTIN
   - The milestone description
   - The amount excluding GST
   - CGST @ 9% and SGST @ 9% (18% total for intra-state)
   - Bank payment details for the client to transfer
   - HSN code 998311 (Architectural / PMC Services)
3. The PDF is shared with the client (download from the system or send via WhatsApp)
4. A Tally Prime XML file is also generated for importing directly into the accounting software — Finance Admin downloads this and imports it into Tally
5. When the client pays, Finance Admin records the receipt with the client's UTR in Finance → Client Receipts

> **Note on invoice terminology:** The PI is a Proforma Invoice. The Tax Invoice (with formal GST registration) is raised separately after the client approves and agrees to pay the PI amount.

### 8.6 GST and TDS tracking

The system maintains a running GST statement — a record of all taxable supplies made and received in each period. Finance Admin can export this statement for each period to prepare the GST return.

TDS (Tax Deducted at Source) deductions on vendor payments are also tracked. When a vendor is paid an amount on which TDS is applicable, the TDS amount is recorded. Finance Admin uses this to file the quarterly TDS return.

### 8.7 Petty cash

Small on-site expenses (below the threshold for a formal payment request) are managed through petty cash. The Site Manager or Finance Admin records each petty cash transaction with:
- The amount
- A description of what it was for
- The receipt reference number

The total petty cash balance is tracked against a per-project allocation. When the balance runs low, Finance Admin tops it up by issuing a petty cash replenishment (which does go through the payment approval chain).

### 8.8 BOQ Mapping — linking client rates to vendor costs

The BOQ Mapping feature links the client BOQ (what the client is paying nu associates for each item) to the vendor engagement pricing (what nu associates is paying each vendor for the same item). This gives a real-time margin view: for any given scope item, you can see the client rate and the vendor rate side by side. This helps Finance Admin and the Principal understand the project margin at a line-item level.

### 8.9 Principal Direct Payments

For situations where the client (Principal) is paying a vendor directly (bypassing the nu associates payment chain), the Finance module records these separately as "principal direct payments". These are tracked for budget purposes but do not go through the standard PMC → Principal approval chain since the Principal is the one making the payment.

---

## 9. Meetings, Changes, Approvals, and Measurements (Workflow Module)

### 9.1 Meetings and Minutes of Meeting (MOM)

Every formal meeting related to a project is recorded in nu PMC. This includes site visits, client meetings, design review meetings, and contractor meetings. When a meeting is created, the system records:

- Date, time, location, and attendees
- Agenda and discussion points
- Action items — specific tasks arising from the meeting, each assigned to a named person with a deadline
- Photos taken during the meeting or site visit

After the meeting, the MOM (Minutes of Meeting) can be sent to attendees directly from the system as a PDF. Action items stay open on the responsible person's "Needs You" dashboard until they are marked done.

Meetings can be revised — if an attendee raises a correction, a revision record is created so the correction is visible alongside the original minutes. The revision history shows every change made.

### 9.2 Change Notices

A Change Notice (CN) is raised whenever there is a formal change to the scope, schedule, or cost of the project. **Change notices are critically important: without a formal CN, a verbal change instruction has no paper trail and the contractor cannot be billed or paid for the extra work.**

**Step 1 — Identify the change**
PMC Head or Design Head raises a CN describing: what is changing (scope, schedule, cost, or all three), the reason for the change, and the impact on the project.

**Step 2 — Send for sign-off**
The CN is sent to the relevant signatories for approval. Multiple signatories may be required depending on the nature and value of the change.

**Step 3 — Sign-off**
Each signatory either signs (approves) or rejects. The CN records each signatory's response with an exact timestamp.

**Step 4 — Approval**
Once all required signatories have signed, the CN is marked as approved and the change is incorporated into the project baseline.

**Step 5 — Update consequential records**
- If the change affects the budget → make a budget adjustment in the Finance module
- If it affects the schedule → upload a new schedule revision in the Design & Services module
- If it affects the BOQ → upload a revised BOQ version

### 9.3 The Approvals Dispatcher

The Approvals section is a single unified view of everything across all modules that is currently waiting for your action. It reads from payment requests, change notices, drawing approvals, weekly sign-offs, and vendor clearances — and presents them all in one place. You do not need to navigate to each module separately to find what needs your attention.

The system also has a "Needs You" view in the Reporting module that performs the same function but grouped differently. Both show the same underlying data.

### 9.4 Measurements and Certification

For quantity-based contracts, the Measurements module records joint measurements taken by the site team and the contractor together. A measurement sheet records:

- What was measured (the BOQ line items and areas)
- The quantities agreed
- Who was present when the measurement was taken
- The date

Once both parties agree and the measurement is certified by the authorised engineer, it becomes the formal basis for the corresponding running account bill. A vendor cannot be paid for work that has not been measured and certified.

### 9.5 Submittals

The Submittals register tracks all formal documents submitted by contractors for approval — shop drawings, material samples, test certificates, method statements, and similar. Each submittal is given a sequential number, logged with a submission date, and tracked until it is reviewed and returned with one of the following responses:

- Approved (A) — can proceed without changes
- Approved with comments (AWC) — can proceed but must incorporate the noted comments
- Revise and resubmit (RR) — cannot proceed; resubmit after addressing comments
- Rejected (R) — does not comply; full resubmission required

---

## 10. Reports and the Dashboard (Reporting Module)

### 10.1 The Dashboard

The dashboard is the first screen you see after logging in. It shows a role-specific summary of what is happening across your projects:

- **Finance Admin** sees pending payment counts and budget variance highlights
- **Site Manager** sees today's daily report status and any open issues assigned to them
- **PMC Head** sees items pending their approval and a project-level health summary
- **Principal** sees everything across all projects with a flag on anything waiting for their approval

### 10.2 Needs You

"Needs You" is the most important part of the reporting module for day-to-day work. It shows every item in the system that is currently blocked, waiting for **your specific action**. If a payment is pending your approval, if a drawing is waiting your review, if an action item from a meeting has your name on it — it all appears here. **Check this list at the start of every working day.**

### 10.3 The Weekly Health Report

Every Monday morning, the system compiles the Weekly Health Report. This aggregates the past week's:

- Daily reports submitted and any gaps
- Issues raised and resolved
- Photos uploaded
- GRNs received and approved
- Progress against the schedule (tasks completed vs planned)
- Budget variance update

It is reviewed and signed off by the PMC Head (or their designate) before being shared with the Principal. The sign-off workflow: after the report is generated, PMC Head reviews it and marks it as signed. The Principal then receives a notification. If the Principal wants to comment or flag something, they can do so within the system.

### 10.4 The Gantt Chart

The Gantt chart view shows the project schedule as a bar chart against a calendar. You can see which tasks are on track, which are delayed, and what the overall progress looks like. The data is drawn directly from the schedule tasks in the Design & Services module. **You cannot edit the schedule from the Gantt view** — go to the schedule in the Design & Services module to make changes.

### 10.5 The Accordion Summary

The Accordion Summary is a tab-by-tab health check of the project. Each section (drawings, payments, issues, schedule, etc.) shows a colour-coded badge: green means all good, amber means items are pending, red means something is overdue or stuck. This gives a quick project health check without having to open each module separately.

### 10.6 Lessons Learned

At the end of a project, the system prompts team members to record lessons learned — what went well, what could be improved, and any technical notes worth preserving for future projects. The AI can summarise and group these inputs into themes. The published lessons are visible across the organisation and searchable by topic.

---

## 11. Notifications — In-App and WhatsApp

nu PMC sends notifications through two channels: in-app notifications (the bell icon in the navigation) and WhatsApp messages. WhatsApp is used for anything time-sensitive or requiring immediate attention.

### 11.1 What triggers a WhatsApp message?

| Event | Who gets the message |
|-------|---------------------|
| New user account created | The new user (with their temporary password) |
| Payment request raised | PMC Head (awaiting their approval) |
| Payment request approved by PMC Head | Principal (awaiting their approval) |
| Payment confirmed (UTR recorded) | The vendor |
| Drawing issued / approved | Site Manager and relevant team |
| RFI or design query raised | The person assigned to answer it |
| Defect / snag raised | The responsible contractor (via their registered number) |
| OTP for password reset | The user who requested the reset |
| Daily report reminder | Site Manager (if daily report not yet submitted by reminder time) |
| Proforma Invoice raised | Client contact (if configured) |
| Vendor bank change pending approval | The approver(s) |

### 11.2 What if a WhatsApp message fails?

If the system cannot deliver a WhatsApp message (Twilio is unreachable, incorrect phone number, recipient not registered on WhatsApp), the failure is recorded in the system in the `wa_send_failures` table. IT Admin and the Principal can see a list of failed messages in the Pending tab.

**No message silently disappears — every failure is tracked and visible.**

Common reasons for failure:
- Phone number format is incorrect (must include country code, e.g. 9199XXXXXXXX)
- The recipient has not activated WhatsApp on that number
- Twilio credentials are not configured in the server environment (IT Admin issue)

### 11.3 Matrix — secure messaging for vendors

In addition to WhatsApp, nu PMC uses Matrix (an open-source secure messaging protocol) for certain vendor communications — specifically the vendor bank confirmation step and the weekly sign-off polls. Each vendor has a personal Matrix room. Messages sent to vendors for sensitive confirmations go through Matrix rather than WhatsApp for added security and auditability. The vendor's responses (confirmations) are read back into the system automatically by a polling script.

---

## 12. How the System Prevents Errors When Multiple People Work Simultaneously

With multiple people working on the same project at the same time, there is a risk of conflicts — what happens if two people try to approve the same payment at the same moment? nu PMC has two mechanisms to prevent this.

### 12.1 The State Machine

Every important record in the system (payment requests, vendor clearance status, project status, etc.) moves through a defined set of states. The state machine enforces two rules:

**Rule 1 — Only valid transitions are allowed**
A record can only move to states that are valid from its current state. The system knows which transitions are allowed (e.g. a payment in "pending_pmc" can go to "pmc_approved" or "pmc_rejected", but not directly to "paid"). Any attempt to make an invalid move is blocked with a clear error message.

**Rule 2 — The "from" state must still be current**
A transition only succeeds if the record is still in the expected "from" state at the moment the database is updated. The database update uses a WHERE clause that requires the current status to match. If another person has already changed the status, the WHERE clause finds no matching row, and the system returns an error to the second person.

> **In plain language:** If you and a colleague both have a payment approval page open at the same time and you both click "Approve" within milliseconds of each other, only one of you succeeds. The other gets: *"Row was not in state 'pending_pmc' — may have been transitioned by another request."* This is not a bug. Reload the page and you will see it is already approved.

### 12.2 Optimistic Locking

For records where edits (not just status changes) can conflict, the system uses optimistic locking. Every such record has a "row version" number. When you load the record to edit it, you get version N. When you save, the system checks that the version in the database is still N. If someone else has saved in between (making it N+1), your save is rejected.

The error message: *"Stale version — record was modified by another user. Please refresh and try again."*

This means the second editor is never silently overwriting the first editor's work. They have to reload, see what changed, and then decide what to do.

---

## 13. The Audit Log — Every Action is Recorded

Every significant action in nu PMC is written to the audit log. This is a permanent, append-only record that **cannot be edited by users**. It records:

- Who performed the action (user's identity)
- What the action was (e.g. `payment_request.transition`, `vendor.bank_change.approve`, `drawing.approved`)
- What record was affected (which table and which row)
- The before/after details (e.g. status changed from `pending_pmc` to `pmc_approved`)
- The IP address and browser of the person who acted
- The exact timestamp

**Audit log entries are written after every:**
- Status transition on a payment request, vendor record, project, or any other state-machine-controlled record
- Vendor bank detail change (propose, approve, reject, cancel)
- Drawing approval or rejection
- User account creation, deactivation, or password reset
- Change notice sign-off
- Budget adjustment

> **The audit log cannot be deleted or edited — not even by administrators.**
> If there is ever a dispute about who approved what and when, the audit log is the authoritative record.

---

## 14. AI-Assisted Features

nu PMC includes a set of AI-powered features that augment the work of the team. These are **assistants, not decision-makers** — they suggest, flag, and summarise, but every action still requires human approval.

| AI Feature | What it does |
|-----------|-------------|
| Drawing check | Automated review of uploaded drawings for common issues — missing title blocks, incorrect revision numbering, inconsistencies with the drawing register |
| Photo tagging | When a site photo is uploaded, AI suggests tags (e.g. "reinforcement", "formwork", "area 3") to make photos searchable |
| Lessons learned summary | At project close, AI groups and summarises the lessons-learned inputs from the team into themes |
| AI Triggers | Specific system events can trigger a configured AI prompt — for example, when a defect is raised, AI can draft a notification message to the contractor |

All AI features are logged in the `ai_trigger_logs` table. If an AI suggestion was acted on, the audit trail shows that the action was human-confirmed.

---

## 15. File Uploads — Documents and Drawings

nu PMC accepts file uploads for drawings, documents, photos, and Excel data imports. The following rules apply to all uploads:

- **Drawings are versioned** — uploading a new file for an existing drawing creates a new version, not a replacement
- **Documents in the document library** (contracts, specifications, approvals) are also version-controlled
- **Photos are stored with project and date context** and can be tagged
- **Excel uploads** are used for bulk data — for example, loading a BOQ with many line items at once instead of entering them one by one
- **Bulk user uploads** via Excel allow IT Admin to create multiple user accounts at once (each gets a temporary password)

The system stores files outside the database (in a configured upload directory on the server) and keeps only the file path and metadata in the database. This keeps the database fast even with many large drawing files.

> If you upload a file and it does not appear immediately, wait a few seconds and refresh. Large files (especially high-resolution drawings) may take a moment to process.

---

## 16. Governance, SLAs, and Project-Specific Settings

### 16.1 Governance Rules

Governance rules allow IT Admin or Principal to override certain permission defaults for specific scenarios. For example, a governance rule could allow a particular team member to access a module they would not normally see for a specific reason, without changing their global role. All governance rules are recorded and audited.

### 16.2 Project SLAs

Each project can have its own SLA (Service Level Agreement) overrides. For example, the default SLA for a payment approval might be 3 working days, but a specific project might have a contractual requirement to process payments within 24 hours. Project SLAs let the system enforce and track these deadlines per project without changing the global defaults.

SLA breaches appear highlighted in the Pending tab and Needs You view.

### 16.3 PMC Assignments

The PMC Assignments module maps which PMC staff member is responsible for each project. If the responsible PMC person changes, the assignment is updated here. This is separate from the general team assignment — it specifically tracks PMC accountability.

PMC Deputies can also be declared here — if the primary PMC person is unavailable, the deputy takes on the responsibility automatically for the duration of the absence.

---

## 17. Common Workflows — Quick Reference

### 17.1 I need to pay a vendor

1. Check the vendor is cleared: Finance → Vendors → check clearance_status = "cleared". If not, complete clearance first.
2. Check there is an approved GRN for the work/delivery being paid: Site → GRNs.
3. Finance → Payments → New Payment Request. Fill in vendor, engagement, amount, type.
4. Submit. The system validates the amount against the contract value.
5. Wait for PMC Head to receive notification and approve (within the project SLA).
6. After PMC Head approves, wait for Principal approval.
7. Once Principal-approved, generate the ICICI payment file. Record UTR when bank confirms payment.

### 17.2 I need to add a new vendor

1. Onboarding → Vendors → Add Vendor. Enter name, PAN, GSTIN, contact details.
2. Enter bank details. This automatically triggers the vendor bank dual-approval flow (Section 5).
3. Upload supporting documents: PAN card copy, GSTIN certificate, cancelled cheque or bank letter.
4. Once bank details are approved by two separate people, Finance Admin marks the vendor as cleared.
5. Vendor is now eligible to receive payments.

### 17.3 I need to raise a Change Notice

1. Workflow → Change Notices → New CN.
2. Describe the change: what is changing, why, and the impact on scope, cost, and/or schedule.
3. Select the required signatories (the system may mandate certain signatories based on the change type).
4. Each signatory receives a notification. They sign or reject from within the system.
5. Once all sign: update the budget and/or schedule in their respective modules.

### 17.4 I need to reset a user's password

1. Users → find the user → Admin Reset.
2. The system generates a temporary password and sets the force-password-change flag.
3. The user is notified via WhatsApp with the temporary password.
4. On next login, the user is immediately prompted to change their password before doing anything else.

### 17.5 A vendor's bank account has changed

1. Finance → Vendors → select vendor → Propose Bank Change.
2. Enter the new details and the reason (minimum 5 characters required).
3. A confirmation is sent to the vendor via Matrix for them to verify.
4. After vendor confirms, the appropriate approver (see Section 5.2) reviews and approves or rejects.
5. If approved, the vendor's clearance status resets to "pending". Finance Admin must re-verify before the next payment.

### 17.6 I need to activate a project (move from initialising to active)

1. Check all seven checklist items are complete: Onboarding → Project → Checklist tab.
2. If any items are outstanding, complete them (upload missing BOQs, assign site manager, etc.).
3. Once all seven are green, the system will auto-activate or provide an Activate button.
4. The project status changes to "active" and a full record of the activation (who triggered it, when) is written to the audit log.

### 17.7 Approving a drawing

1. Go to Design & Services → Drawings.
2. Open the drawing to be reviewed.
3. Review the drawing and all related documents.
4. If approved: click Approve. An issue notification goes to the site team.
5. If revisions are needed: click Request Revision with comments. The draughtsperson receives the comments and uploads a new version.

---

## 18. Error Messages — What They Mean and What To Do

| Error message / code | What to do |
|---------------------|-----------|
| `MUST_CHANGE_PASSWORD` | Log in and change your password before doing anything else. You will be redirected to the password-change screen automatically. |
| *"Stale version — record was modified by another user. Please refresh and try again."* | Someone else edited or approved this record between when you loaded it and when you saved. Refresh the page and review the current state before acting. |
| *"Row X was not in state 'Y' — may have been transitioned by another request"* | Another person has already acted on this record. Refresh to see the current status. This is not a bug — it means the concurrency protection worked. |
| `PROPOSAL_PENDING` — a bank-change proposal is already pending | There is already an open bank-change proposal for this vendor. That one must be resolved (approved, rejected, or cancelled) before a new one can be raised. |
| `SELF_APPROVAL_DENIED` | You cannot approve your own proposal. A different person with the appropriate role must approve. This is a hard rule — no workaround exists by design. |
| `SELF_REJECT_DENIED` | Same as above for rejections. |
| *"Request ₹X exceeds contract value of ₹Y"* | The payment amount you entered is greater than the vendor's agreed contract for this engagement. Check the amount or raise a Change Notice first to formally increase the contract value. |
| *"Total payments would exceed contract value"* | The sum of all past + pending + this payment exceeds the contract. The error shows the breakdown. Check if an earlier payment was against a different engagement, or raise a CN to revise the contract. |
| *"Project X is not ready to activate. N blockers: ..."* | The activation checklist is not complete. The error lists the specific items outstanding. Complete those items and try again. |
| *"Trainees are read-only on this function."* | Your role does not have write access to this area. If you believe this is wrong, ask your manager to check your role assignment. |
| *"Trainees do not have access to this section."* | Trainees are blocked from financial and governance sections regardless of the action type. |
| `VENDOR_NOT_FOUND` | The vendor ID in the request does not match any vendor in the system. This usually means the page is out of date — refresh and try again. |
| `PROPOSAL_NOT_OPEN` | The bank-change proposal you are trying to act on has already been resolved. Refresh to see its current state. |
| `NO_CHANGE` | You tried to propose a bank change but the new details you entered are identical to the existing ones. At least one field must actually change. |
| `REASON_MISSING` | A written reason (minimum 5 characters) is required for bank change proposals and rejections. Enter a meaningful reason before submitting. |
| *"Twilio credentials not configured — WA sends will be no-ops"* | This is a server log message, not visible to regular users. It means WhatsApp messages are not being sent. Notify IT Admin to configure the Twilio credentials. |

---

## 19. Glossary

| Term | Meaning |
|------|---------|
| Audit Log | A permanent record of every significant action — who did what, when, and to which record. Cannot be edited or deleted. |
| BOQ | Bill of Quantities — the line-item breakdown of work items with quantities and rates. |
| Change Notice (CN) | A formal document recording a change to project scope, schedule, or cost. Requires multi-signatory approval. |
| Clearance | The status of a vendor after their identity and bank details have been verified by Finance Admin. |
| Contract Value | The total agreed amount to be paid to a vendor under a specific engagement. |
| Dual Approval | A requirement for two different people to authorise an action (e.g. vendor bank changes, where proposer ≠ approver). |
| Engagement | A specific contract between nu associates and a vendor for a defined scope of work and value. |
| Fee Schedule | The milestone-based payment plan that governs when the client is invoiced. |
| GRN | Goods Received Note — a record confirming that materials were delivered to site and accepted. Required before payment for those materials. |
| GSTIN | GST Identification Number — the vendor's or client's GST registration number. Required for all tax-compliant transactions. |
| HSN Code | Harmonised System of Nomenclature — the code that classifies the type of service for GST (998311 for Architectural/PMC services). |
| ICICI | The bank used for outgoing vendor payments via their corporate payment portal. |
| Matrix | A secure open-source messaging protocol used for vendor confirmations and sign-off polls. |
| Milestone | A defined deliverable in the fee schedule against which a client invoice is raised. |
| MOM | Minutes of Meeting — the written record of what was discussed and decided in a meeting. |
| Module | A self-contained functional area of nu PMC (e.g. Finance, Site, Design & Services). Each module owns its own data. |
| NCR | Non-Conformance Report — a quality issue where work does not meet the specified standard. Recorded as an issue with type "quality". |
| Onboarding | The process of setting up a new project with all necessary records before work begins. |
| Optimistic Locking | A mechanism that prevents two people from simultaneously overwriting each other's edits by using a row version number. |
| OTP | One-Time Password — a temporary code sent via WhatsApp for password reset. |
| PAN | Permanent Account Number — India's tax identification number for individuals and entities. Required for vendor verification. |
| PI | Proforma Invoice — a preliminary invoice sent to the client before the formal Tax Invoice. |
| PMC | Project Management Consultancy — the core service nu associates provides. |
| R0 Schedule | The baseline (original approved) project schedule, created before site work begins. All future revisions are compared against R0. |
| RA Bill | Running Account Bill — a periodic payment claim from a vendor for work completed and measured to date. |
| Readiness Gate | The seven-item checklist that must be complete before a project can go from "initialising" to "active". |
| RFI | Request for Information — a formal query from the site team to the design team asking for clarification before proceeding. |
| SAC Code | 998311 — Services Accounting Code for Architectural / PMC services under the Indian GST framework. |
| Sign-off | Formal approval or confirmation of a document, report, or decision by an authorised person. Recorded with timestamp and identity. |
| Snag | A defect or incomplete item identified during or after construction, to be rectified before final payment. Recorded as an issue with type "snag". |
| State Machine | The system that controls what status a record can move to and prevents invalid or concurrent transitions. |
| Submittal | A document (shop drawing, sample, test certificate) submitted by a contractor for formal approval before proceeding with work. |
| TDS | Tax Deducted at Source — tax withheld from vendor payments and remitted to the government. Tracked per vendor and per period. |
| Twilio | The third-party service used to send WhatsApp messages. Credentials must be configured for WA messages to work. |
| UTR | Unique Transaction Reference — the bank-issued reference number for a completed payment. Records that money has moved. |
| Variance | The difference between the budgeted cost and the actual/committed cost for a cost head or line item. |
| WhatsApp Notification | An automated message sent via Twilio to a user's or vendor's WhatsApp number. Failures are logged and visible to IT Admin. |

---

## 20. Who to Contact for System Issues

| Problem | Contact |
|---------|---------|
| Cannot log in / forgotten password | Your manager or IT Admin — they can reset your password via Admin → Users → Admin Reset |
| WhatsApp messages not arriving | IT Admin — they need to check the Twilio configuration and the `wa_send_failures` table |
| Something seems wrong with a payment approval | Finance Admin first, then PMC Head |
| A drawing is missing or showing the wrong version | Design Head (design stream) or Services Head (services stream) |
| A vendor payment is stuck in approval | PMC Head to follow up with the relevant approver |
| A vendor bank change is stuck | Finance Admin — they can see all pending proposals in the vendor record |
| System is slow or showing errors | IT Admin — they need to check the server logs |
| Need a new user account created | IT Admin or any user with user-management access |
| A vendor is not showing as cleared | Finance Admin — only they can set the clearance status |
| Not sure which tab to use for something | Check this guide first (Section 17), then ask your line manager |
| Audit log query (who did what and when) | IT Admin or Principal — they have access to the full audit log |

---

*nu PMC Employee System Guide — nu associates | Architecture · Engineering · PMC*
*This document reflects the system as of June 2026. Always refer to the latest version for updates.*
