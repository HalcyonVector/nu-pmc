// gantt.js — Gantt chart renderer
// Pure JS + SVG — no external library

const GANTT = {

  TRADE_COLORS: {
    'Civil':               '#c8a55a',
    'Electrical':          '#4a8fa8',
    'IT / Networking':     '#4a8a5a',
    'HVAC':                '#9a6ab8',
    'Fire / Suppression':  '#a84a3a',
    'PA & Fire Alarm':     '#a88a2a',
    'Interior':            '#7a5a9a',
    'Plumbing':            '#3a8a7a',
    'Handover':            '#5a5a5a',
    'Architectural':       '#c8a55a',
    'Structural':          '#4a8fa8',
  },

  tradeColor(trade) {
    return GANTT.TRADE_COLORS[trade] || '#5a5a5a';
  },

  // ── RENDER GANTT into container element
  render(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!data?.tasks?.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:var(--mono);font-size:11px">No schedule data</div>';
      return;
    }

    // SVG renders on all screen sizes inside the tab with horizontal scroll.
    // Mobile users who need detail use the ⬇ Download (.xlsx) button.

    const { project, tasks, trades } = data;

    // ── DIMENSIONS
    const LABEL_W   = 180;  // task name column
    const BAR_H     = 20;   // bar height
    const ROW_H     = 28;   // row height (bar + padding)
    const HEADER_H  = 56;   // date header height
    const MIN_DAY_W = 14;   // min pixels per day

    // Calculate day width based on container
    const availW  = Math.max(container.clientWidth - LABEL_W - 32, 400);
    const DAY_W   = Math.max(MIN_DAY_W, Math.floor(availW / project.total_days));
    const CHART_W = project.total_days * DAY_W;

    // Total rows: one per trade header + tasks
    const rows = [];
    const byTrade = {};
    tasks.forEach(t => {
      if (!byTrade[t.trade]) byTrade[t.trade] = [];
      byTrade[t.trade].push(t);
    });

    Object.entries(byTrade).forEach(([trade, tlist]) => {
      rows.push({ type: 'trade', trade, tasks: tlist });
      tlist.forEach(t => rows.push({ type: 'task', task: t, trade }));
    });

    const totalH = HEADER_H + rows.length * ROW_H + 20;

    // ── BUILD SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W + CHART_W + 1}" height="${totalH}"
      style="font-family:'IBM Plex Mono',monospace;background:#111;display:block">`;

    // ── BACKGROUND
    svg += `<rect width="${LABEL_W + CHART_W}" height="${totalH}" fill="#111"/>`;

    // ── MONTH HEADERS
    const startDate = new Date(project.start_date + 'T00:00:00');
    let d = new Date(startDate);
    let prevMonth = -1;
    for (let day = 0; day < project.total_days; day++) {
      const x = LABEL_W + day * DAY_W;
      const month = d.getMonth();
      if (month !== prevMonth) {
        const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        svg += `<rect x="${x}" y="0" width="${DAY_W * 30}" height="${HEADER_H - 20}" fill="#1a2e44"/>`;
        svg += `<text x="${x + 4}" y="18" fill="#c8a55a" font-size="12" font-weight="600">${monthLabel}</text>`;
        prevMonth = month;
      }
      // Week markers
      if (d.getDay() === 1) {
        svg += `<line x1="${x}" y1="${HEADER_H - 20}" x2="${x}" y2="${totalH}" stroke="#1f1f1f" stroke-width="1"/>`;
        const wNum = Math.ceil(day / 7) + 1;
        /* week number labels removed — too small to read at any zoom */
      }
      d.setDate(d.getDate() + 1);
    }

    // ── TODAY LINE
    if (project.today_day >= 0 && project.today_day <= project.total_days) {
      const todayX = LABEL_W + project.today_day * DAY_W;
      svg += `<line x1="${todayX}" y1="0" x2="${todayX}" y2="${totalH}" stroke="#c8a55a" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>`;
      svg += `<text x="${todayX + 3}" y="12" fill="#c8a55a" font-size="11" font-weight="600">TODAY</text>`;
    }

    // ── ROWS
    rows.forEach((row, i) => {
      const y = HEADER_H + i * ROW_H;

      if (row.type === 'trade') {
        // Trade header row
        const col = GANTT.tradeColor(row.trade);
        svg += `<rect x="0" y="${y}" width="${LABEL_W + CHART_W}" height="${ROW_H}" fill="#181818"/>`;
        svg += `<rect x="0" y="${y}" width="4" height="${ROW_H}" fill="${col}"/>`;
        svg += `<text x="10" y="${y + ROW_H/2 + 4}" fill="${col}" font-size="12" font-weight="700" letter-spacing="1">${row.trade.toUpperCase()}</text>`;

        // Trade summary bar (thin line across)
        const tr = trades.find(t => t.trade === row.trade);
        if (tr) {
          const tx  = LABEL_W + tr.start_day * DAY_W;
          const tw  = (tr.end_day - tr.start_day) * DAY_W;
          svg += `<rect x="${tx}" y="${y + ROW_H/2 - 1}" width="${tw}" height="2" fill="${col}" opacity="0.3" rx="1"/>`;
        }

      } else {
        // Task row
        const t   = row.task;
        const col = GANTT.tradeColor(row.trade);
        const pct = t.pct_complete || 0;
        const isOverdue = t.is_overdue;

        // Alternating row background
        if (i % 2 === 0) svg += `<rect x="0" y="${y}" width="${LABEL_W + CHART_W}" height="${ROW_H}" fill="#141414"/>`;

        // Label
        const label = t.task_name.length > 22 ? t.task_name.substring(0,21) + '…' : t.task_name;
        svg += `<text x="12" y="${y + ROW_H/2 + 4}" fill="${pct===100?'#3a3a3a':'#aaa'}" font-size="11"
          ${pct===100?'text-decoration="line-through"':''}>${GANTT.escapeXml(label)}</text>`;

        // % text
        /* pct label inside bar removed — too small to read, removed per GUI spec */

        // Bar background
        const bx = LABEL_W + t.start_day * DAY_W;
        const bw = Math.max(t.duration_days * DAY_W, 4);
        const by = y + (ROW_H - BAR_H) / 2;

        svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${BAR_H}" fill="#1f1f1f" rx="3"/>`;

        // Progress fill
        if (pct > 0) {
          const fw = Math.max(bw * pct / 100, 4);
          const fillCol = pct === 100 ? '#2a5a3a' : isOverdue ? '#5a2a1a' : col;
          svg += `<rect x="${bx}" y="${by}" width="${fw}" height="${BAR_H}" fill="${fillCol}" opacity="0.85" rx="3"/>`;
        }

        // Bar border
        const borderCol = isOverdue ? '#a84a3a' : pct === 100 ? '#2a5a3a' : col;
        svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${BAR_H}" fill="none" stroke="${borderCol}" stroke-width="1" rx="3" opacity="0.6"/>`;

        // % label inside bar if enough space
        if (bw > 30 && pct > 0) {
          svg += `<text x="${bx + fw/2}" y="${by + BAR_H/2 + 3}" fill="white" font-size="8"
            text-anchor="middle" font-weight="600">${pct}%</text>`;
        }

        // Overdue indicator
        if (isOverdue) {
          svg += `<text x="${bx + bw + 4}" y="${by + BAR_H/2 + 3}" fill="#a84a3a" font-size="8">⚠</text>`;
        }

        // Dependency arrow (simple)
        if (t.depends_on_task_id) {
          // Subtle dot to indicate dependency
          svg += `<circle cx="${bx}" cy="${by + BAR_H/2}" r="3" fill="#2a2a2a" stroke="${col}" stroke-width="1"/>`;
        }
      }
    });

    // ── LABEL COLUMN BORDER
    svg += `<line x1="${LABEL_W}" y1="0" x2="${LABEL_W}" y2="${totalH}" stroke="#252525" stroke-width="1"/>`;

    // ── HEADER BORDER
    svg += `<line x1="0" y1="${HEADER_H}" x2="${LABEL_W + CHART_W}" y2="${HEADER_H}" stroke="#252525" stroke-width="1"/>`;

    // ── LEGEND
    const legendY = totalH - 18;
    let legendX   = LABEL_W + 10;
    const legendItems = [
      { col: '#4a8a5a', label: 'Complete' },
      { col: '#c8a55a', label: 'In progress' },
      { col: '#a84a3a', label: 'Overdue' },
      { col: '#c8a55a', label: 'Today', dashed: true },
    ];
    legendItems.forEach(li => {
      if (li.dashed) {
        svg += `<line x1="${legendX}" y1="${legendY - 3}" x2="${legendX + 16}" y2="${legendY - 3}" stroke="${li.col}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
      } else {
        svg += `<rect x="${legendX}" y="${legendY - 8}" width="16" height="8" fill="${li.col}" opacity="0.85" rx="2"/>`;
      }
      svg += `<text x="${legendX + 20}" y="${legendY - 1}" fill="#555" font-size="11">${li.label}</text>`;
      legendX += 80;
    });

    svg += '</svg>';

    // ── WRAPPER with scroll
    container.innerHTML = `
      <div style="overflow-x:auto;border-radius:8px;border:1px solid #252525">
        ${svg}
      </div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:8px;display:flex;justify-content:space-between">
        <span>Schedule ${data.version?.label || 'R0'} · R0 end: ${data.project?.end_date}</span>
        <span>${data.version?.drift_days > 0 ? '⚠ +'+data.version.drift_days+' days drift from R0' : '✓ On R0 track'}</span>
      </div>`;
  },

  escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // ── LOAD AND RENDER for a project
  async load(containerId, projectId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-family:var(--mono);font-size:11px">Loading schedule…</div>';

    const data = await API.call('GET', `/gantt/${projectId}`);
    if (data?.error) {
      container.innerHTML = `<div style="color:#c87060;font-size:11px;font-family:var(--mono);padding:12px">${data.error}</div>`;
      return;
    }
    GANTT.render(containerId, data);
  },
};
