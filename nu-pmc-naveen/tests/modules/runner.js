// tests/modules/runner.js — run all module tests in order, or a single module
// Usage:
//   node tests/modules/runner.js            — run all 12 modules
//   node tests/modules/runner.js 07         — run module 07 only
//   node tests/modules/runner.js 03 07      — run modules 03 through 07

const path  = require('path');
const fs    = require('fs');
const STATE = path.join(__dirname, 'state.json');

const MODULES = [
  '01-setup',
  '02-boq',
  '03-engagement',
  '04-boq-mapping',
  '05-schedule',
  '06-drawings',
  '07-grn',
  '08-issues',
  '09-moms',
  '10-payments',
  '11-reports',
  '12-finance',
  '13-whatsapp',
];

async function run() {
  const args     = process.argv.slice(2);
  let toRun      = MODULES;

  if (args.length === 1) {
    toRun = MODULES.filter(m => m.startsWith(args[0]));
  } else if (args.length === 2) {
    const [from, to] = args;
    const fi = MODULES.findIndex(m => m.startsWith(from));
    const ti = MODULES.findIndex(m => m.startsWith(to));
    toRun    = fi >= 0 && ti >= 0 ? MODULES.slice(fi, ti + 1) : MODULES;
  }

  if (!toRun.length) {
    console.error('No matching modules found. Available:', MODULES.map(m => m.split('-')[0]).join(', '));
    process.exit(1);
  }

  // Reset state if running from module 01
  if (toRun[0].startsWith('01')) {
    fs.writeFileSync(STATE, '{}');
    console.log('State reset.\n');
  }

  let total = 0, totalPassed = 0, totalFailed = 0;
  const startTime = Date.now();

  for (const mod of toRun) {
    const modPath = path.join(__dirname, mod + '.test.js');
    if (!fs.existsSync(modPath)) {
      console.log(`⚠  ${mod} — file not found, skipping`);
      continue;
    }

    process.stdout.write(`\n─── Module ${mod} ───────────────────\n`);
    const { passed, failed } = await require(modPath).run();
    total       += passed + failed;
    totalPassed += passed;
    totalFailed += failed;

    if (failed > 0) {
      console.log(`\n⛔  Module ${mod} failed — ${process.env.CONTINUE_ON_FAIL ? 'continuing (CONTINUE_ON_FAIL=1).' : 'stopping chain.'}`);
      if (!process.env.CONTINUE_ON_FAIL) break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(45)}`);
  console.log(`${totalPassed}/${total} tests passed in ${elapsed}s`);
  if (totalFailed > 0) {
    console.log(`${totalFailed} failed`);
    process.exit(1);
  } else {
    console.log('All modules passed ✓');
  }
}

run().catch(err => {
  console.error('Runner error:', err.message);
  process.exit(1);
});
