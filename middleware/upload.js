// middleware/upload.js — File upload handling with compression
const multer   = require('multer');
const sharp    = require('sharp');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const fileType = require('file-type');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Ensure directories exist
['photos', 'drawings', 'documents', 'boq', 'schedules', 'daily-reports'].forEach(dir => {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subdir = 'documents';
    if (file.fieldname === 'photo') subdir = 'photos';
    else if (file.fieldname === 'drawing') subdir = 'drawings';
    else if (file.fieldname === 'boq') subdir = 'boq';
    else if (file.fieldname === 'schedule') subdir = 'schedules';
    else if (file.fieldname === 'daily_report') subdir = 'daily-reports';
    cb(null, path.join(UPLOAD_DIR, subdir));
  },
  filename: (req, file, cb) => {
    const ts    = Date.now();
    const nonce = crypto.randomBytes(6).toString('hex');
    // Sanitize: allow only [a-z0-9._-], lowercase; strip path separators and unicode.
    let safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    // Reject leading-dot names (prevents .htaccess / hidden-file style)
    if (safe.startsWith('.')) safe = 'file' + safe;
    // Cap length to stay well under ext4's 255-byte path component limit
    if (safe.length > 120) {
      const ext = path.extname(safe);
      safe = safe.slice(0, 120 - ext.length) + ext;
    }
    cb(null, `${ts}_${nonce}_${safe}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.dwg', '.dxf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error(`File type ${ext} not allowed`));
};

// Internal multer instance — not exported directly. Routes use the `upload`
// wrapper below which transparently injects magic-byte validation.
const _multer = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 20) * 1024 * 1024 }
});

// ── Magic-byte MIME map ───────────────────────────────────────────────────
// Maps file extensions to the MIME types file-type should detect from
// the first bytes of the actual file content.
//
// Why this matters: fileFilter() only checks the extension from
// originalname (attacker-controlled). An attacker can rename exploit.php
// to invoice.pdf and bypass the extension check. Magic-byte validation
// reads the actual file header after it lands on disk and rejects any
// file whose content does not match its claimed type.
//
// DXF is plain ASCII text, no reliable magic bytes, skip check.
// DWG uses AC10..AC27 header, mapped to application/x-autocad.
const MAGIC_MIME_MAP = {
  '.pdf':  new Set(['application/pdf']),
  '.jpg':  new Set(['image/jpeg']),
  '.jpeg': new Set(['image/jpeg']),
  '.png':  new Set(['image/png']),
  // XLSX is a ZIP (PK header); XLS is OLE2 (D0CF header)
  '.xlsx': new Set(['application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  '.xls':  new Set(['application/vnd.ms-excel', 'application/x-cfb']),
  '.dwg':  new Set(['application/x-autocad', 'image/x-dwg', 'application/acad']),
  // .dxf -- ASCII text, no magic bytes, skip (extension-only check is fine)
};

/**
 * Validate a freshly-uploaded file's magic bytes against its extension.
 * Deletes the file and throws if the content does not match.
 *
 * @param {string} filePath  absolute path to the uploaded file on disk
 * @returns {Promise<void>}
 * @throws {Error}  with .code = 'INVALID_MAGIC_BYTES' on mismatch
 */
async function validateMagicBytes(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // DWG: the file-type library does NOT detect AutoCAD DWG, so the generic
  // check below would reject every .dwg as "Detected: unknown" — including
  // genuine CAD files. Validate by the well-defined DWG version header instead
  // (ASCII "AC1NNN", e.g. AC1015/AC1027/AC1032).
  if (ext === '.dwg') {
    let head = '';
    try {
      const fd = fs.openSync(filePath, 'r');
      const b  = Buffer.alloc(6);
      fs.readSync(fd, b, 0, 6, 0);
      fs.closeSync(fd);
      head = b.toString('ascii');
    } catch (_e) { /* unreadable -> reject below */ }
    if (/^AC1\d{3}$/.test(head)) return;            // valid AutoCAD DWG header
    try { fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
    const e = new Error('File content does not match extension .dwg (not a valid AutoCAD DWG). Upload rejected.');
    e.code = 'INVALID_MAGIC_BYTES';
    e.status = 400;
    throw e;
  }

  const allowedMimes = MAGIC_MIME_MAP[ext];

  // Extension not in the map (e.g. .dxf) -- skip magic check
  if (!allowedMimes) return;

  let detected;
  try {
    detected = await fileType.fromFile(filePath);
  } catch (err) {
    // Can't read the file -- delete it and reject
    try { fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
    const e = new Error('Could not read uploaded file for type detection: ' + err.message);
    e.code = 'INVALID_MAGIC_BYTES';
    throw e;
  }

  // file-type returns null/undefined for plain-text files and some edge cases.
  // If we could not detect a type, reject -- a PDF/JPEG/PNG always has detectable magic.
  const mime = detected && detected.mime ? detected.mime : '';

  // XLSX: file-type often returns application/zip for valid .xlsx files
  // because XLSX is just a renamed ZIP. Accept both.
  if (!allowedMimes.has(mime)) {
    try { fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
    const e = new Error(
      'File content does not match extension ' + ext + '. ' +
      'Detected: ' + (mime || 'unknown') + '. Upload rejected.'
    );
    e.code = 'INVALID_MAGIC_BYTES';
    e.status = 400;
    throw e;
  }
}

// ── Magic-check Express middleware ────────────────────────────────────────
// Runs after multer writes the file. Validates content against extension.
// Handles req.file (single), req.files array (array), req.files object (fields).
function _magicCheck(req, res, next) {
  const files = [];
  if (req.file) {
    files.push(req.file);
  } else if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      Object.values(req.files).forEach(function(arr) {
        files.push(...(Array.isArray(arr) ? arr : [arr]));
      });
    }
  }
  if (!files.length) return next();

  Promise.all(files.map(function(f) { return validateMagicBytes(f.path); }))
    .then(function() { next(); })
    .catch(function(err) {
      // validateMagicBytes already deleted the offending file.
      // Clean up any other files from this same upload.
      files.forEach(function(f) {
        try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_e) { /* ignore */ }
      });
      res.status(err.status || 400).json({ error: err.message || 'Invalid file content' });
    });
}

// ── Public upload API ─────────────────────────────────────────────────────
// Wraps multer methods so every upload route gets magic-byte validation
// automatically. Express accepts arrays as middleware, so:
//   router.post('/x', upload.single('photo'), handler)
// works identically whether upload.single() returns a function or [fn, fn].
// Zero changes needed in any route file.
const upload = {
  single: function() { return [_multer.single.apply(_multer, arguments), _magicCheck]; },
  array:  function() { return [_multer.array.apply(_multer, arguments),  _magicCheck]; },
  fields: function() { return [_multer.fields.apply(_multer, arguments), _magicCheck]; },
  none:   function() { return _multer.none(); },
  any:    function() { return _multer.any();  },
};

// Compress photo after upload
async function compressPhoto(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) return filePath;
    const compressed = filePath.replace(ext, '_c' + ext);
    await sharp(filePath)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(compressed);
    fs.unlinkSync(filePath);
    fs.renameSync(compressed, filePath);
    return filePath;
  } catch (err) {
    console.error('Photo compression error:', err.message);
    return filePath;
  }
}

function getFileSize(filePath) {
  try {
    return Math.round(fs.statSync(filePath).size / 1024);
  } catch (_e) {
    return 0;
  }
}

module.exports = { upload, compressPhoto, validateMagicBytes, getFileSize, UPLOAD_DIR };
