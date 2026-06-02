// services/wa-headers.js
// WhatsApp message header tags
// Format for project messages:   EMOJI TAG\nProject Name (truncated 20 chars)\n\n{body}
// Format for global messages:    EMOJI TAG\n\n{body}

const HEADERS = {
  action:      '🔴 ACTION NEEDED',
  fyi:         '🟡 FYI',
  internal:    '📋 INTERNAL',
  confidential:'🔒 CONFIDENTIAL',
  records:     '📤 FOR YOUR RECORDS',
  confirmed:   '✅ CONFIRMED',
  alert:       '⚠️ ALERT',
};

const MESSAGE_TYPE_MAP = {
  cn_approval:              'action',
  grn_approve:              'action',
  issue_confirm:            'action',
  drawing_approval:         'action',
  budget_flag:              'action',
  budget_escalation:        'action',
  saturday_payment_digest:  'action',
  morning_priorities:       'action',
  urgent_payment_fyi:       'fyi',
  anomaly_ack:              'fyi',
  schedule_risk:            'fyi',
  report_anomaly:           'fyi',
  utr_consolidated:         'fyi',
  morning_site_prep:        'internal',
  evening_close:            'internal',
  evening_digest:           'internal',
  weekly_digest:            'internal',
  pending_items:            'internal',
  daily_report:             'internal',
  drawing_query:            'internal',
  task_outlier:             'internal',
  budget_custom_head:       'confidential',
  saturday_excel:           'confidential',
  payment_approved:         'confidential',
  utr_vendor:               'records',
  vendor_payment_confirmed: 'records',
  mom_client_ack:           'confirmed',
  vendor_contract:          'confirmed',
  safety_issue:             'alert',
  quality_issue:            'alert',
  report_anomaly_escalated: 'alert',
  vps_alert:                'alert',
  ssl_alert:                'alert',
};

/**
 * Tag a message with header
 * @param {string} type - message type key
 * @param {string} body - message body
 * @param {string|null} projectName - optional project name for line 2
 */
function tagByType(type, body, projectName) {
  const headerKey = MESSAGE_TYPE_MAP[type] || 'fyi';
  const header    = HEADERS[headerKey] || HEADERS.fyi;
  const projLine  = projectName ? '\n' + projectName.substring(0, 20) : '';
  return header + projLine + '\n\n' + body;
}

function tag(headerKey, body, projectName) {
  const header   = HEADERS[headerKey] || HEADERS.fyi;
  const projLine = projectName ? '\n' + projectName.substring(0, 20) : '';
  return header + projLine + '\n\n' + body;
}

module.exports = { tag, tagByType, HEADERS };
