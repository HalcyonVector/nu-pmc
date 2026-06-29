#!/usr/bin/env node
// ui-audit.js — Static UI click-wiring audit for nu-pmc
// Outputs: ui-audit-report.html

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'public', 'js', 'app.js');
const API_JS = path.join(ROOT, 'public', 'js', 'api.js');
const OUT    = path.join(ROOT, 'ui-audit-report.html');

const WRITE_HTTP = ['POST','PATCH','PUT','DELETE'];

// ─── 1. INDEX API METHODS ────────────────────────────────────────────────────
const apiSrc = fs.readFileSync(API_JS, 'utf8');
const appSrc = fs.readFileSync(APP_JS, 'utf8');
const lines  = appSrc.split('\n');

const API = {};
function indexAPI(re) {
  let m;
  while ((m = re.exec(apiSrc)) !== null) {
    const [, name, http, raw] = m;
    if (['call','fileUrl'].includes(name)) continue;
    API[name] = { method: http, path: raw.replace(/^[`'"]/,'').replace(/[`'"]$/,'').replace(/\$\{[^}]+\}/g,':param') };
  }
}
indexAPI(/(\w+)\s*:\s*(?:\([^)]*\)\s*=>|function[^(]*\([^)]*\))\s*API\.call\(\s*'([A-Z]+)'\s*,\s*(`[^`\n]{0,200}`|'[^'\n]{0,200}'|"[^"\n]{0,200}")/g);
indexAPI(/API\.(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function[^(]*\([^)]*\))\s*API\.call\(\s*'([A-Z]+)'\s*,\s*(`[^`\n]{0,200}`|'[^'\n]{0,200}'|"[^"\n]{0,200}")/g);
console.log('API methods: ' + Object.keys(API).length);

// ─── 2. INDEX APP METHODS ────────────────────────────────────────────────────
const METHODS = {};
const methodStart = /^  (?:async\s+)?(\w+)\s*\(/;
let cur = null, depth = 0, body = [], sl = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!cur) {
    const mm = l.match(methodStart);
    if (mm) { cur = mm[1]; depth = 0; body = [l]; sl = i; for (const c of l) { if(c==='{') depth++; else if(c==='}') depth--; } if(depth<=0){cur=null;body=[];} }
  } else {
    body.push(l);
    for (const c of l) { if(c==='{') depth++; else if(c==='}') depth--; }
    if (depth <= 0) {
      const src = body.join('\n');
      const calls = [];
      let rm; const ra = /API\.(\w+)\s*\(/g;
      while((rm = ra.exec(src))!==null){ const n=rm[1]; if(!['call','get','post','patch','del','fileUrl'].includes(n) && API[n]) calls.push({name:n,...API[n]}); }
      const rc2 = /API\.call\(\s*'([A-Z]+)'\s*,\s*(`[^`\n]{0,150}`|'[^'\n]{0,150}'|"[^"\n]{0,150}")/g;
      while((rm = rc2.exec(src))!==null){ calls.push({name:'(raw)',method:rm[1],path:rm[2].replace(/^[`'"]/,'').replace(/[`'"]$/,'').replace(/\$\{[^}]+\}/g,':param')}); }
      const roleVarRe = /(?:const|let|var)\s+(is\w+|can\w+|my\w+|has\w+)\s*=\s*[^;\n]*(role|APP\.user)/g;
      const roleVars = new Set();
      while((rm = roleVarRe.exec(src))!==null) roleVars.add(rm[1]);
      const hasRole = roleVars.size>0 || /APP\.user\.role\s*===/.test(src) || /includes\(APP\.user\.role\)/.test(src) || /includes\(me\.role\)/.test(src);
      METHODS[cur] = { calls, roleVars, hasRole, startLine: sl+1 };
      cur=null; body=[];
    }
  }
}
console.log('App methods: ' + Object.keys(METHODS).length);

// ─── 3. EXTRACT ONCLICK HANDLERS ─────────────────────────────────────────────
function labelAfter(line, pos) {
  // Extract button label from the text AFTER the onclick attribute ends
  const tail = line.slice(pos);
  const m1 = tail.match(/>[^>]*>([^<]{0,80})<\/button>/);
  if (m1) return m1[1].replace(/\$\{[^}]+\}/g,'…').trim();
  const m2 = tail.match(/>([^<]{0,80})<\/button>/);
  if (m2) return m2[1].replace(/\$\{[^}]+\}/g,'…').trim();
  return '';
}

function tplGuard(win) {
  const m = win.match(/\b(can\w+|my\w+|is\w+|has\w+|unsigned|pending)\s*[\?&|]/);
  if (m) return m[1];
  if (/APP\.user\.role\s*===/.test(win) || /\[.*\]\.includes\(/.test(win)) return 'role ternary';
  return null;
}

function resolveAPIs(action) {
  const out = [];
  let rm;
  const da = /API\.(\w+)\s*\(/g;
  while((rm=da.exec(action))!==null){const n=rm[1];if(!['call','get','post','patch','del','fileUrl'].includes(n)&&API[n]) out.push({name:n,...API[n],via:'direct'});}
  const am = /APP\.(\w+)\s*\(/g;
  while((rm=am.exec(action))!==null){const n=rm[1];if(METHODS[n]) METHODS[n].calls.forEach(c=>out.push({...c,via:'APP.'+n+'()'}))}
  return out;
}

const findings = [];
const ocRe = /onclick="([^"]{1,400})"/g;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  ocRe.lastIndex = 0;
  let oc;
  while ((oc = ocRe.exec(line)) !== null) {
    const action   = oc[1].trim();
    const ocEnd    = oc.index + oc[0].length;
    const label    = labelAfter(line, ocEnd);
    const winStart = Math.max(0, i-10), winEnd = Math.min(lines.length-1, i+2);
    const win      = lines.slice(winStart, winEnd+1).join('\n');

    let enc = '(top)';
    for (let j = i; j >= Math.max(0,i-300); j--) { const mm=lines[j].match(methodStart); if(mm){enc=mm[1];break;} }

    const apis   = resolveAPIs(action);
    const isWrite = apis.some(a=>WRITE_HTTP.includes(a.method));
    const isNav   = apis.length===0 && /switchTab|switchBucket|selectProject|pickProject|setDwgType|renderSchedule|state\.|APP\.render/.test(action);

    // Gate detection (3 tiers)
    const hGate = /APP\.user\.role|isPrincipal|isPMC|isAdmin/.test(action) ? 'handler' : null;
    const tGate = !hGate ? tplGuard(win) : null;
    const mGate = !hGate && !tGate && METHODS[enc]?.hasRole ? 'method:'+enc : null;
    const gate  = hGate || (tGate?'template:'+tGate:null) || mGate;

    const ungated = isWrite && !gate;

    // Per-button mismatch detection
    const mismatches = [];
    if (label && !label.includes('…')) {
      const ll = label.toLowerCase();
      const isApprLbl = /\b(approve|accept|sign off|confirm|validate|clear)\b/.test(ll);
      const isRejLbl  = /\b(reject|dismiss|revoke|delete|remove|deactivate)\b/.test(ll);
      apis.forEach(a => {
        const pl = (a.path||'').toLowerCase()+' '+(a.name||'').toLowerCase();
        if (isApprLbl && /reject|dismiss|revoke|cancel/.test(pl) && !/approve|accept|confirm/.test(pl))
          mismatches.push('Label "'+label+'" but calls '+a.method+' '+a.path+' (via '+a.via+')');
        if (isRejLbl && /approve|accept|confirm/.test(pl) && !/reject|dismiss/.test(pl))
          mismatches.push('Label "'+label+'" but calls '+a.method+' '+a.path+' (via '+a.via+')');
      });
    }

    findings.push({ lineNo:i+1, enc, label:label||'(unlabelled)', action, apis, gate, isWrite, isNav, ungated, mismatches, win });
  }
}

// ─── 4. STATS & SORT ─────────────────────────────────────────────────────────
function risk(f) {
  if (f.mismatches.length) return 'crit';
  if (f.ungated)           return 'high';
  if (f.isWrite)           return 'write';
  if (f.isNav)             return 'nav';
  return 'ok';
}
const RO = {crit:0,high:1,write:2,nav:3,ok:4};
findings.sort((a,b)=>RO[risk(a)]-RO[risk(b)]);

const stats = {
  crit:  findings.filter(f=>f.mismatches.length).length,
  high:  findings.filter(f=>f.ungated).length,
  write: findings.filter(f=>f.isWrite&&f.gate&&!f.mismatches.length).length,
  nav:   findings.filter(f=>f.isNav).length,
  ok:    findings.filter(f=>!f.mismatches.length&&!f.ungated&&!f.isNav&&(!f.isWrite||f.gate)).length,
};

console.log('\nOnclick handlers: ' + findings.length);
console.log('  Mismatches:    ' + stats.crit);
console.log('  Ungated write: ' + stats.high);
console.log('  Gated write:   ' + stats.write);
console.log('  Nav only:      ' + stats.nav);
console.log('  OK:            ' + stats.ok);

// ─── 5. HTML REPORT ──────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const RLABEL = {crit:'⛔ MISMATCH',high:'🔴 UNGATED WRITE',write:'🟡 GATED WRITE',nav:'🔵 NAVIGATION',ok:'✅ OK'};

function card(f, id) {
  const r = risk(f);
  const apis = f.apis.length
    ? f.apis.map(a=>'<tr><td class="m '+(WRITE_HTTP.includes(a.method)?'wr':'')+'">'+esc(a.method)+'</td><td class="m">'+esc(a.path)+'</td><td class="vi">'+esc(a.via||a.name)+'</td></tr>').join('')
    : '<tr><td colspan="3" class="mu">'+(f.isNav?'Navigation / UI state only':'No API call traced (may be dynamic)')+'</td></tr>';
  const gateHtml = f.gate ? '<span class="tg gn">&#x2713; '+esc(f.gate)+'</span>'
    : f.isWrite ? '<span class="tg rd">&#x2717; none &mdash; server must enforce</span>'
    : '<span class="mu">&mdash;</span>';
  const mmHtml = f.mismatches.map(mm=>'<div class="mmr">&#x26D4; '+esc(mm)+'</div>').join('');
  return '<details class="fd '+r+'" id="'+id+'"><summary>'
    +'<span class="rb '+r+'">'+RLABEL[r]+'</span>'
    +'<span class="lb">'+esc(f.label)+'</span>'
    +'<span class="cx">line '+f.lineNo+' &middot; '+esc(f.enc)+'()</span>'
    +'</summary><div class="fb">'+mmHtml
    +'<table class="at"><thead><tr><th>HTTP</th><th>Endpoint</th><th>Via</th></tr></thead><tbody>'+apis+'</tbody></table>'
    +'<div class="mt"><span class="ml">Gate:</span>'+gateHtml+'</div>'
    +'<div class="mt"><span class="ml">onclick:</span><code>'+esc(f.action)+'</code></div>'
    +'<details class="sn"><summary>Source context (line '+f.lineNo+')</summary><pre>'+esc(f.win)+'</pre></details>'
    +'</div></details>\n';
}

// Build issue sections by method
const issueMap = {};
findings.forEach(f=>{ const r=risk(f); if(r==='crit'||r==='high'){ if(!issueMap[f.enc]) issueMap[f.enc]=[]; issueMap[f.enc].push(f); } });
let issueHtml = '';
if (!Object.keys(issueMap).length) {
  issueHtml = '<p class="mu">No mismatches or ungated writes detected.</p>';
} else {
  Object.entries(issueMap).sort((a,b)=>b[1].length-a[1].length).forEach(([mn,ffs],gi)=>{
    const nc=ffs.filter(f=>risk(f)==='crit').length, nh=ffs.filter(f=>risk(f)==='high').length;
    issueHtml += '<h3 class="mh">'+esc(mn)+'() '
      +(nc?'<span class="tg rd">'+nc+' mismatch</span>':'')
      +(nh?'<span class="tg yw">'+nh+' ungated</span>':'')
      +'</h3>';
    ffs.forEach((f,i)=>{ issueHtml += card(f,'iss_'+gi+'_'+i); });
  });
}

// Write wiring map
const writes = findings.filter(f=>f.isWrite);
let wireRows = '';
writes.forEach(f=>{
  const r=risk(f);
  const eps = f.apis.map(a=>'<code>'+esc(a.method)+' '+esc(a.path)+'</code>').join('<br>')||'<span class="mu">unresolved</span>';
  const gc  = f.gate ? '<span class="tg gn">&#x2713;</span> '+esc(f.gate) : '<span class="tg rd">&#x2717;</span>';
  wireRows += '<tr><td>'+esc(f.label)+'</td><td class="m">'+esc(f.enc)+'()</td><td>'+eps+'</td><td>'+gc+'</td>'
    +'<td><span class="rb '+r+'" style="font-size:10px">'+RLABEL[r]+'</span></td></tr>\n';
});

// All findings
let allHtml = '';
findings.forEach((f,i)=>{ allHtml += card(f,'f'+i); });

const now = new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});

// ─── Write HTML using string concat (avoids template-literal backtick conflicts)
const H = [
'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
'<title>nu-pmc UI Audit</title>',
'<style>',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;background:#f5f6f8;color:#1a1a2e}',
'.pg{max-width:1120px;margin:0 auto;padding:28px 16px}',
'h1{font-size:20px;font-weight:700;margin-bottom:4px}',
'.sub{color:#666;font-size:12px;margin-bottom:24px}',
'.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}',
'.sc{background:#fff;border:1px solid #dee2e6;border-radius:10px;padding:14px 16px}',
'.sc .n{font-size:30px;font-weight:800}.sc .l{font-size:11px;color:#666;margin-top:2px}',
'.sc.crit .n{color:#c0392b}.sc.high .n{color:#e74c3c}.sc.yw .n{color:#d4a017}.sc.ok .n{color:#27ae60}',
'h2{font-size:16px;font-weight:700;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #dee2e6}',
'h3.mh{font-size:13px;color:#333;background:#f0f0f0;padding:7px 12px;border-radius:6px;margin:16px 0 8px;',
'  font-family:Menlo,Consolas,monospace;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
'.fd{background:#fff;border:1px solid #dee2e6;border-radius:8px;margin-bottom:6px;overflow:hidden}',
'.fd summary{padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;list-style:none}',
'.fd summary::-webkit-details-marker{display:none}',
'.fd.crit{border-left:4px solid #c0392b}.fd.high{border-left:4px solid #e74c3c}',
'.fd.write{border-left:4px solid #d4a017}.fd.nav{border-left:4px solid #2980b9}.fd.ok{border-left:4px solid #27ae60}',
'.rb{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap}',
'.rb.crit{background:#fdecea;color:#c0392b}.rb.high{background:#fdecea;color:#e74c3c}',
'.rb.write{background:#fff8e1;color:#856404}.rb.nav{background:#e8f4fd;color:#2980b9}.rb.ok{background:#eafaf1;color:#27ae60}',
'.lb{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.cx{color:#999;font-size:11px;white-space:nowrap}',
'.fb{padding:12px 16px;border-top:1px solid #dee2e6}',
'.mmr{background:#fdecea;color:#c0392b;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-weight:600;font-size:12px}',
'.at{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}',
'.at th{background:#f8f9fa;text-align:left;padding:5px 8px;border:1px solid #dee2e6;color:#555;font-weight:600}',
'.at td{padding:4px 8px;border:1px solid #dee2e6}.at .m{font-family:Menlo,Consolas,monospace}',
'.at .wr{color:#c0392b;font-weight:700}.at .vi{color:#666;font-style:italic}',
'.mt{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:12px;flex-wrap:wrap}',
'.ml{color:#666;font-weight:600;white-space:nowrap}',
'.tg{font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600}',
'.tg.rd{background:#fdecea;color:#c0392b}.tg.yw{background:#fff8e1;color:#856404}.tg.gn{background:#eafaf1;color:#27ae60}',
'code{font-family:Menlo,Consolas,monospace;font-size:11px;background:#f8f9fa;padding:1px 5px;border-radius:3px;word-break:break-all}',
'.sn summary{font-size:11px;color:#888;cursor:pointer;margin-top:6px}',
'.sn pre{background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:8px;font-size:10px;',
'  font-family:Menlo,Consolas,monospace;overflow-x:auto;white-space:pre;margin-top:6px}',
'.mu{color:#999}.fb-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}',
'.fb-btn{border:1px solid #dee2e6;background:#fff;border-radius:20px;padding:5px 14px;font-size:12px;cursor:pointer;font-weight:500}',
'.fb-btn.on{background:#1a1a2e;color:#fff;border-color:#1a1a2e}',
'.wt{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}',
'.wt th{background:#f8f9fa;text-align:left;padding:7px 10px;border:1px solid #dee2e6;font-weight:600;color:#333}',
'.wt td{padding:6px 10px;border:1px solid #dee2e6;vertical-align:top}',
'.tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #dee2e6}',
'.tb{border:none;background:none;padding:10px 18px;font-size:13px;font-weight:600;color:#666;cursor:pointer;',
'  border-bottom:3px solid transparent;margin-bottom:-2px}',
'.tb.on{color:#1a1a2e;border-bottom-color:#1a1a2e}',
'.tp{display:none}.tp.on{display:block}',
'</style></head><body><div class="pg">',
'<h1>nu-pmc UI Click-Wiring Audit</h1>',
'<p class="sub">Generated ' + now + ' &middot; ' + findings.length + ' onclick handlers &middot; ' + Object.keys(API).length + ' API endpoints indexed</p>',
'<div class="gr">',
'<div class="sc crit"><div class="n">' + stats.crit  + '</div><div class="l">&#x26D4; Label/Endpoint Mismatch</div></div>',
'<div class="sc high"><div class="n">' + stats.high  + '</div><div class="l">&#x1F534; Ungated Write Ops</div></div>',
'<div class="sc yw">  <div class="n">' + stats.write + '</div><div class="l">&#x1F7E1; Gated Writes</div></div>',
'<div class="sc ok">  <div class="n">' + (stats.nav+stats.ok) + '</div><div class="l">&#x2705; Nav / OK</div></div>',
'<div class="sc">     <div class="n">' + findings.length + '</div><div class="l">Total Handlers</div></div>',
'<div class="sc">     <div class="n">' + Object.keys(API).length + '</div><div class="l">API Methods</div></div>',
'</div>',
'<div class="tabs">',
'<button class="tb on" onclick="showTab(\'issues\',this)">Issues</button>',
'<button class="tb" onclick="showTab(\'wiring\',this)">Write Wiring Map</button>',
'<button class="tb" onclick="showTab(\'all\',this)">All Handlers</button>',
'</div>',
// Issues tab
'<div class="tp on" id="tp-issues">',
'<h2>Issues &mdash; Mismatches &amp; Ungated Writes</h2>',
issueHtml,
'</div>',
// Wiring map tab
'<div class="tp" id="tp-wiring">',
'<h2>Write Operation Wiring Map (' + writes.length + ' handlers)</h2>',
'<p style="margin-bottom:12px;color:#666;font-size:12px">Every button that triggers POST/PATCH/PUT/DELETE, the endpoint it hits, and whether a client-side role gate was found. Green = gate detected in template or method body. Red = server middleware is the only guard.</p>',
'<table class="wt"><thead><tr><th>Button Label</th><th>Method</th><th>Endpoint(s)</th><th>Role Gate</th><th>Risk</th></tr></thead><tbody>',
wireRows,
'</tbody></table></div>',
// All findings tab
'<div class="tp" id="tp-all">',
'<h2>All Handlers (' + findings.length + ')</h2>',
'<div class="fb-bar">',
'<button class="fb-btn on" onclick="fa(\'all\',this)">All</button>',
'<button class="fb-btn" onclick="fa(\'crit\',this)">&#x26D4; Mismatch (' + stats.crit + ')</button>',
'<button class="fb-btn" onclick="fa(\'high\',this)">&#x1F534; Ungated (' + stats.high + ')</button>',
'<button class="fb-btn" onclick="fa(\'write\',this)">&#x1F7E1; Gated Write (' + stats.write + ')</button>',
'<button class="fb-btn" onclick="fa(\'nav\',this)">&#x1F535; Nav (' + stats.nav + ')</button>',
'<button class="fb-btn" onclick="fa(\'ok\',this)">&#x2705; OK (' + stats.ok + ')</button>',
'</div>',
'<div id="al">' + allHtml + '</div>',
'</div>',
'<script>',
'function showTab(id,btn){',
'  document.querySelectorAll(".tp").forEach(p=>p.classList.remove("on"));',
'  document.querySelectorAll(".tb").forEach(b=>b.classList.remove("on"));',
'  document.getElementById("tp-"+id).classList.add("on");',
'  btn.classList.add("on");',
'}',
'function fa(cls,btn){',
'  document.querySelectorAll(".fb-bar .fb-btn").forEach(b=>b.classList.remove("on"));',
'  btn.classList.add("on");',
'  document.querySelectorAll("#al .fd").forEach(el=>{',
'    el.style.display=(cls==="all"||el.classList.contains(cls))?"":"none";',
'  });',
'}',
'</script></div></body></html>',
];

fs.writeFileSync(OUT, H.join('\n'), 'utf8');
console.log('\nReport: ' + OUT);
