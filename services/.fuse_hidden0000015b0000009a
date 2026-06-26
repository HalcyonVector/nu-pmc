const path = require('path');

function normalizeSlashes(value) {
  return String(value || '').replace(/\\/g, '/');
}

function uploadedFileParts(filePath, defaultSubdir = '') {
  const clean = normalizeSlashes(filePath).split(/[?#]/)[0];
  const match = clean.match(/(?:^|\/)uploads\/([^/]+)\/([^/]+)$/i);
  if (match) return { subdir: match[1], filename: match[2] };

  if (defaultSubdir && clean && !clean.includes('/')) {
    return { subdir: defaultSubdir, filename: path.basename(clean) };
  }
  return null;
}

function fileUrl(filePath, { absolute = false, baseUrl = process.env.APP_BASE_URL || '', defaultSubdir = '' } = {}) {
  if (!filePath) return null;
  const raw = normalizeSlashes(filePath);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/api/files/')) {
    return absolute && baseUrl ? baseUrl.replace(/\/+$/, '') + raw : raw;
  }

  const parts = uploadedFileParts(raw, defaultSubdir);
  if (!parts?.subdir || !parts?.filename) return null;
  const url = `/api/files/${encodeURIComponent(parts.subdir)}/${encodeURIComponent(parts.filename)}`;
  return absolute && baseUrl ? baseUrl.replace(/\/+$/, '') + url : url;
}

function attachFileUrl(row, sourceField = 'file_path', targetField = 'file_url', opts = {}) {
  if (row && row[sourceField]) row[targetField] = fileUrl(row[sourceField], opts);
  return row;
}

function attachFileUrls(rows, sourceField = 'file_path', targetField = 'file_url', opts = {}) {
  if (Array.isArray(rows)) rows.forEach(row => attachFileUrl(row, sourceField, targetField, opts));
  return rows;
}

module.exports = { fileUrl, uploadedFileParts, attachFileUrl, attachFileUrls };
