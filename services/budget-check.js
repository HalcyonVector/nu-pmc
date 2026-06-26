// services/budget-check.js — Budget threshold checks, flag creation, notifications
// Called at engagement creation and PO issue

const users = require('./users-lookup');

const STREAM_MAP = {
  Civil:'design', Structural:'design', Architectural:'design',
  Interior:'design', Facade:'design', Finishes:'design',
  Electrical:'services', HVAC:'services', Plumbing:'services',
  FireFighting:'services', ELV:'services', Lifts:'services',
  Landscaping:'common', Furniture:'common', Contingency:'common',
  'Professional Fees':'common',
};

const T = {
  lineItem:  { flag:0.10, signoff:0.15, strikes:3 },
  trade:     { flag:0.05 },
  project:   { amber:0.01, hardBlock:0.015 },
};

function getStream(trade) {
  return STREAM_MAP[trade] || 'common';
}

/**
 * Main check — call at engagement creation (soft) and PO issue (hard)
 * Returns { allowed, warnings, blocks, flags }
 */
async function checkBudget(db, projectId, engagementId, boqItemId, newAmount, stage) {
  const result = { allowed: true, warnings: [], blocks: [], flags: [] };

  // ── 1. LINE ITEM CHECK
  if (boqItemId) {
    const [[item]] = await db.query(
      `SELECT bi.id, bi.trade, bi.item_name,
              bch.id AS cost_head_id, bch.sanctioned AS head_sanctioned,
              COALESCE(
                (SELECT SUM(vbi.our_cost_total)
                 FROM vendor_boq_items vbi WHERE vbi.boq_item_id = bi.id
                 AND vbi.engagement_id != ?), 0
              ) AS existing_committed
       FROM boq_items bi
       JOIN budget_cost_heads bch ON bch.project_id = bi.project_id
         AND bch.code = bi.trade AND bch.status = 'approved'
       WHERE bi.id = ?`,
      [engagementId, boqItemId]
    );

    if (item) {
      // Get line item sanctioned from BOQ (rate * quantity)
      const [[lineItem]] = await db.query(
        `SELECT COALESCE(SUM(our_cost_total),0) AS sanctioned_total
         FROM vendor_boq_items WHERE boq_item_id = ? LIMIT 1`,
        [boqItemId]
      );
      // Use cost head sanctioned / number of items as proxy if no direct line sanctioned
      const sanctioned = parseFloat(lineItem?.sanctioned_total || 0) || parseFloat(item.head_sanctioned) / 10;
      const committed  = parseFloat(item.existing_committed) + newAmount;
      const pctOver    = sanctioned > 0 ? (committed - sanctioned) / sanctioned : 0;

      // Get strike count for this line item
      const [[strikes]] = await db.query(
        'SELECT COUNT(*) AS cnt FROM budget_flags WHERE project_id=? AND boq_item_id=? AND flag_level=?',
        [projectId, boqItemId, 'line_item']
      );
      const strikeCount = parseInt(strikes.cnt, 10);

      if (pctOver >= T.lineItem.signoff) {
        const action = stage === 'po' ? 'block' : 'warn';
        const entry  = {
          level: 'line_item', trade: item.trade, item: item.item_name,
          pctOver: (pctOver*100).toFixed(1), sanctioned, committed,
          strikeCount, action,
          message: `${item.item_name} is ${(pctOver*100).toFixed(1)}% over sanctioned — sign-off required`,
        };
        if (action === 'block') { result.allowed = false; result.blocks.push(entry); }
        else result.warnings.push(entry);
        result.flags.push({ ...entry, cost_head_id: item.cost_head_id });
      } else if (pctOver >= T.lineItem.flag) {
        result.warnings.push({
          level: 'line_item', trade: item.trade, item: item.item_name,
          pctOver: (pctOver*100).toFixed(1), sanctioned, committed,
          strikeCount, action: 'warn',
          message: `${item.item_name} is ${(pctOver*100).toFixed(1)}% over — PMC and stream head notified`,
        });
        result.flags.push({ cost_head_id: item.cost_head_id, boq_item_id: boqItemId,
          level:'line_item', pctOver, sanctioned, committed, strikeCount });
      }

      // 3-strike escalation
      if (strikeCount >= T.lineItem.strikes) {
        result.warnings.push({
          level: 'line_item_escalation', trade: item.trade,
          message: `${item.item_name} has been flagged ${strikeCount} times — escalating to Principal`,
        });
      }
    }
  }

  // ── 2. TRADE LEVEL CHECK
  const [[tradeData]] = await db.query(
    `SELECT bch.id AS cost_head_id, bch.code AS trade, bch.sanctioned, bch.stream,
            COALESCE(
              (SELECT SUM(vbi.our_cost_total)
               FROM vendor_boq_items vbi
               JOIN boq_items bi2 ON vbi.boq_item_id = bi2.id
               WHERE bi2.project_id = ? AND bi2.trade = bch.code), 0
            ) + ? AS total_committed
     FROM budget_cost_heads bch
     JOIN boq_items bi ON bi.project_id = bch.project_id AND bi.trade = bch.code
     JOIN vendor_boq_items vbi2 ON vbi2.boq_item_id = bi.id AND vbi2.engagement_id = ?
     WHERE bch.project_id = ? AND bch.status = 'approved'
     LIMIT 1`,
    [projectId, newAmount, engagementId, projectId]
  );

  if (tradeData) {
    const tradePctOver = tradeData.sanctioned > 0
      ? (tradeData.total_committed - tradeData.sanctioned) / tradeData.sanctioned : 0;
    if (tradePctOver >= T.trade.flag) {
      result.warnings.push({
        level: 'trade', trade: tradeData.trade,
        pctOver: (tradePctOver*100).toFixed(1),
        message: `Trade ${tradeData.trade} is ${(tradePctOver*100).toFixed(1)}% over budget`,
        stream: tradeData.stream,
      });
      if (stage === 'po') {
        // Soft block at PO — PMC must acknowledge
        result.warnings.push({
          level: 'trade_ack_required',
          message: `PMC Head must acknowledge ${tradeData.trade} trade overrun before PO can be issued`,
        });
      }
    }
  }

  // ── 3. PROJECT TOTAL CHECK
  const [[projData]] = await db.query(
    `SELECT
       COALESCE(SUM(bch.sanctioned),0) AS total_sanctioned,
       COALESCE((SELECT SUM(ve.contract_value)
                 FROM vendor_engagements ve WHERE ve.project_id = ?
                 AND ve.is_active = 1), 0) + ? AS total_committed
     FROM budget_cost_heads bch WHERE bch.project_id = ? AND bch.status='approved'`,
    [projectId, newAmount, projectId]
  );

  if (projData && projData.total_sanctioned > 0) {
    const projPctOver = (projData.total_committed - projData.total_sanctioned) / projData.total_sanctioned;
    if (projPctOver >= T.project.hardBlock) {
      result.allowed = false;
      result.blocks.push({
        level: 'project', pctOver: (projPctOver*100).toFixed(1),
        message: `Project total is ${(projPctOver*100).toFixed(1)}% over budget — HARD BLOCK. Principal must approve.`,
      });
      // Alert principals via Matrix — #internal-principal (org-wide, personal digests).
      try {
        const matrixAdapter = require('./matrix-adapter');
        const principalRoom = await matrixAdapter.getInternalRoomId('internal_principal');
        if (principalRoom) {
          await matrixAdapter.sendText({
            roomId: principalRoom,
            body: `🔴 BUDGET HARD BLOCK — Project ${projectId} — ${(projPctOver*100).toFixed(1)}% over budget. Payment blocked.`,
          }).catch(e => console.warn('[budget-check] Matrix alert failed:', e.message));
        }
      } catch (e) { console.warn('[budget-check]', e.message); }
    } else if (projPctOver >= T.project.amber) {
      result.warnings.push({
        level: 'project', pctOver: (projPctOver*100).toFixed(1),
        message: `Project total is ${(projPctOver*100).toFixed(1)}% over budget — amber flag to Principal`,
      });
    }
  }

  return result;
}

/**
 * Persist flags and send notifications
 */
async function persistAndNotify(db, projectId, engagementId, checkResult, triggeredBy, stage) {
  for (const flag of checkResult.flags) {
    const [[existingFlag]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM budget_flags
       WHERE project_id=? AND cost_head_id=?
       AND flag_level='line_item' AND boq_item_id=?`,
      [projectId, flag.cost_head_id, flag.boq_item_id || null]
    );
    const strikeNum = parseInt(existingFlag.cnt, 10) + 1;

    await db.query(
      `INSERT INTO budget_flags
       (project_id, cost_head_id, boq_item_id, flag_level, pct_over,
        sanctioned, committed, trigger_stage, engagement_id, strike_number)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [projectId, flag.cost_head_id, flag.boq_item_id || null,
       flag.level, flag.pctOver, flag.sanctioned, flag.committed,
       stage, engagementId, strikeNum]
    );

    // Notify PMC Head
    const [pmcHeads] = await db.query(
      `SELECT u.id FROM users u
       JOIN project_assignments pa ON pa.user_id = u.id
       WHERE pa.project_id = ? AND u.role = 'pmc_head' AND u.is_active = 1`, [projectId]
    );
    const notifLog = require('./notif-log');
    for (const p of pmcHeads) {
      await notifLog.logUserNotif({
        userId: p.id, messageType: 'budget_flag',
        body: checkResult.warnings.map(w=>w.message).join(' | '),
        status: 'pending',
      });
    }

    // Notify stream head
    if (flag.stream && flag.stream !== 'common') {
      const headRole = flag.stream === 'design' ? 'design_head' : 'services_head';
      const [heads] = await db.query(
        `SELECT u.id FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id
         WHERE pa.project_id = ? AND u.role = ? AND u.is_active = 1`, [projectId, headRole]
      );
      for (const h of heads) {
        await notifLog.logUserNotif({
          userId: h.id, messageType: 'budget_flag',
          body: checkResult.warnings.filter(w=>w.stream===flag.stream).map(w=>w.message).join(' | '),
          status: 'pending',
        });
      }
    }

    // 3rd strike or project hard block — notify Principal
    if (strikeNum >= 3 || checkResult.blocks.some(b=>b.level==='project')) {
      const [principals] = await db.query(
        "SELECT id FROM users WHERE role IN ('principal','design_principal') AND is_active=1"
      );
      const projInfo = { name: await users.projectName(projectId) };
      for (const p of principals) {
        await notifLog.logUserNotif({
          userId: p.id, messageType: 'budget_escalation',
          body: `BUDGET ESCALATION — ${checkResult.blocks.concat(checkResult.warnings).map(w=>w.message).join(' | ')}`,
          status: 'pending',
        });
        // Matrix alert to #internal-principal
        const matrixAdapter = require('./matrix-adapter');
        const principalRoom = await matrixAdapter.getInternalRoomId('internal_principal');
        if (principalRoom) {
          const blockMsg = checkResult.blocks.find(b => b.level === 'project');
          if (blockMsg) {
            await matrixAdapter.sendText({
              roomId: principalRoom,
              body: `🔴 BUDGET ESCALATION — ${projInfo?.name || 'Project'} — ${blockMsg.message}`,
            }).catch(e => console.warn('[budget-check.persistAndNotify] Matrix failed:', e.message));
          }
        }
      }
    }
  }
}

module.exports = { checkBudget, persistAndNotify, getStream, STREAM_MAP };
