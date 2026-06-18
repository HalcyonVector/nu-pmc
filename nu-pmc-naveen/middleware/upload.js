// middleware/upload.js — File upload handling with compression
const multer = require('multer');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

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
  const ext = path.extname(file.originalname).toLowerCase(); // used in allowed check below
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error(`File type ${ext} not allowed`));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 }
});

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
  } catch {
    return 0;
  }
}

module.exports = { upload, compressPhoto, getFileSize, UPLOAD_DIR };
