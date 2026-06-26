// services/logger.js
// File-backed logger. Mirrors console.* to disk so existing console.log /
// console.error calls across the codebase land in log files without each
// caller having to import anything.
//
// LOG_DIR (from .env) controls the destination directory. Relative paths
// resolve against the project root. Two files are produced:
//   - app.log    : log/info/warn output
//   - error.log  : error output and process-level fatal handlers
//
// The logger is best-effort. Failures to write log lines are swallowed —
// the application must not crash because the disk is full.

const fs    = require('fs');
const path  = require('path');
const util  = require('util');

const projectRoot = path.resolve(__dirname, '..');
const rawDir      = process.env.LOG_DIR || './logs';
const logDir      = path.isAbsolute(rawDir) ? rawDir : path.resolve(projectRoot, rawDir);

try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) { /* best-effort */ }

const appStream   = fs.createWriteStream(path.join(logDir, 'app.log'),   { flags: 'a' });
const errorStream = fs.createWriteStream(path.join(logDir, 'error.log'), { flags: 'a' });

appStream.on('error',   () => { /* swallow — never crash on log failure */ });
errorStream.on('error', () => {});

function fmt(level, args) {
  const ts = new Date().toISOString();
  const msg = util.format(...args);
  return `${ts} ${level} ${msg}\n`;
}

function writeApp(level, args) {
  try { appStream.write(fmt(level, args)); } catch (_) {}
}
function writeErr(args) {
  try { errorStream.write(fmt('ERROR', args)); } catch (_) {}
}

// Tee console.* — preserve original behaviour (stdout/stderr) and also
// append to the relevant file. Originals are kept so tests and tooling
// that capture process output still work.
const orig = {
  log:   console.log.bind(console),
  info:  console.info.bind(console),
  warn:  console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

console.log   = (...a) => { orig.log(...a);   writeApp('INFO',  a); };
console.info  = (...a) => { orig.info(...a);  writeApp('INFO',  a); };
console.warn  = (...a) => { orig.warn(...a);  writeApp('WARN',  a); };
console.error = (...a) => { orig.error(...a); writeErr(a); };
console.debug = (...a) => { orig.debug(...a); writeApp('DEBUG', a); };

module.exports = {
  logDir,
  info:  (...a) => console.info(...a),
  warn:  (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
  debug: (...a) => console.debug(...a),
};
