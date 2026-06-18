# Twilio / Meta WhatsApp Template Submissions

All templates for WhatsApp Business API.
**Category:** UTILITY
**Language:** English (India) - `en_IN`
**Header:** None (plain body)
**Button type:** Quick Reply or CTA (URL) as noted

---

## 1. `nu_grn_approval`
**Variables:** 3
**Buttons:** Quick Reply — "Approve", "Reject"
**Body:**
```
🔴 ACTION NEEDED
{{1}}

GRN raised
{{2}}

{{3}}

Approve or reject:
```
**Variables:**
- {{1}} = Project name (e.g., "TLD Nelamangala")
- {{2}} = GRN number (e.g., "GRN-0042")
- {{3}} = Vendor / quantity / amount (e.g., "ABC Civil Works — 45 bags cement — ₹22,500")

**Buttons:**
- Button 1: "Approve" (id: `grn_{id}_1`)
- Button 2: "Reject" (id: `grn_{id}_2`)

---

## 2. `nu_anomaly_alert`
**Variables:** 3
**Buttons:** None (FYI only)
**Body:**
```
🟡 FYI
{{1}}

Daily report flagged:
"{{2}}"

{{3}}

Full detail in app.
```
**Variables:**
- {{1}} = Project name
- {{2}} = Anomaly reason (e.g., "Slab pour reported 100% at 09:15 — concrete truck only arrived 09:45")
- {{3}} = Site manager name

---

## 3. `nu_issue_confirm`
**Variables:** 4
**Buttons:** Quick Reply — "Confirm", "Dismiss"
**Body:**
```
🔴 ACTION NEEDED
{{1}}

{{2}} Issue raised
{{3}}

"{{4}}"

Confirm into register?
```
**Variables:**
- {{1}} = Project name
- {{2}} = Issue type (Safety/Quality/Design/RFI/Compliance)
- {{3}} = Issue number (e.g., "ISS-0007")
- {{4}} = Title/description (≤60 chars)

**Buttons:**
- Button 1: "Confirm" (id: `issue_{id}_1`)
- Button 2: "Dismiss" (id: `issue_{id}_2`)

---

## 4. `nu_mom_client_ack`
**Variables:** 2
**Buttons:** Quick Reply — "Accept MOM", "Request changes"
**Body:**
```
🔴 ACTION NEEDED

Meeting Minutes
{{1}} — {{2}}

Please review and respond within 3 days.
```
**Variables:**
- {{1}} = MOM number (e.g., "MOM-TLD-012")
- {{2}} = Meeting date (e.g., "18-Apr-2026")

**Buttons:**
- Button 1: "Accept MOM" (id: `mom_{id}_1`)
- Button 2: "Request changes" (id: `mom_{id}_2`)

---

## 5. `nu_vendor_defect`
**Variables:** 2
**Buttons:** Quick Reply — "Acknowledged", "Dispute"
**Body:**
```
⚠️ ALERT

Defect Notice
{{1}}

"{{2}}"

Please respond:
```
**Variables:**
- {{1}} = NCR number (e.g., "NCR-0003")
- {{2}} = Defect description (≤60 chars)

**Buttons:**
- Button 1: "Acknowledged" (id: `ncr_{id}_1`)
- Button 2: "Dispute" (id: `ncr_{id}_2`)

---

## 6. `nu_payment_fyi`
**Variables:** 2
**Buttons:** None (FYI only)
**Body:**
```
🟡 FYI

✅ Urgent payment auto-approved
{{1}}
Rs {{2}}

Open app to query if needed.
```
**Variables:**
- {{1}} = Vendor name
- {{2}} = Amount (formatted Indian, e.g., "4,50,000")

---

## 7. `nu_schedule_drift`
**Variables:** 3
**Buttons:** CTA (URL) — "Open in App"
**Body:**
```
🟡 FYI
{{1}}

{{2}} is {{3}}% behind plan

Tap to review narrative:
```
**Variables:**
- {{1}} = Project name
- {{2}} = Trade (e.g., "Civil")
- {{3}} = Drift percentage (e.g., "15")

**Button:**
- CTA URL: `https://nuassociates.in/app/schedule/{project_id}/health`

---

## 8. `nu_budget_alert`
**Variables:** 3
**Buttons:** CTA (URL) — "Open in App"
**Body:**
```
🔴 ACTION NEEDED
{{1}}

{{2}} is {{3}}% over budget

All new engagements blocked. Tap to review:
```
**Variables:**
- {{1}} = Project name
- {{2}} = Trade (e.g., "MEP")
- {{3}} = Percentage over (e.g., "8")

**Button:**
- CTA URL: `https://nuassociates.in/app/budget/{project_id}`

---

## 9. `nu_payment_excel`
**Variables:** 2
**Buttons:** CTA (URL) — "Open in App"
**Body:**
```
🔴 ACTION NEEDED

Weekly payment batch ready
Week ending {{1}}
Total: Rs {{2}}

Tap to approve:
```
**Variables:**
- {{1}} = Week-ending date (e.g., "20-Apr-2026")
- {{2}} = Total amount (e.g., "18,50,000")

**Button:**
- CTA URL: `https://nuassociates.in/app/payments/{project_id}/batch`

---

## Submission checklist

For each template in Twilio Console → Content Template Builder:
1. Select **Category: UTILITY** (NOT Marketing — Utility is for transactional messages, cheaper and faster approval)
2. Select **Language: English (India)** — `en_IN`
3. Paste body exactly as above (including emoji headers)
4. Add variables in order — use the "Insert variable" button for each {{n}}
5. Add buttons (Quick Reply for #1-5, CTA URL for #7-9)
6. For CTA URLs, use the exact placeholder format — Twilio substitutes the variable at send time
7. Submit all 9 in one session — Meta batches approvals

## Expected timeline

- Twilio review: <1 hour (automated)
- Meta approval: 1-3 business days
- Rejection reasons to expect: marketing-style language, missing opt-out, promotional tone

## If rejected

Common fixes:
- Remove any "please", "kindly" type marketing language → use direct imperative
- Ensure body clearly describes the transactional action (approve/reject/acknowledge)
- Variables should have concrete examples in the variable description field
