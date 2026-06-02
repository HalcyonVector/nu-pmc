// services/fuzzy-match.js
// Fuzzy duplicate detection for vendors and clients
// Adaptive threshold + first-word pre-filter + company suffix stripping

function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) =>
    Array.from({length: n+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const l = levenshtein(a, b);
  return 1 - l / Math.max(a.length, b.length, 1);
}

// Strip common company suffixes that don't affect identity
function normalise(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|inc|corp|corporation|company|co)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Core duplicate check with adaptive threshold
 * Returns 0-1 similarity score with short-string and first-word logic applied
 */
function dupScore(a, b) {
  const an = normalise(a);
  const bn = normalise(b);
  if (!an || !bn) return 0;
  if (an === bn)  return 1;

  const maxLen = Math.max(an.length, bn.length);

  // Short strings require exact match — don't fuzzy-compare
  if (maxLen < 5) return 0;

  // First word must roughly match — prevents "XYZ Ltd" vs "ABC Ltd" false positive
  const firstA = an.split(' ')[0];
  const firstB = bn.split(' ')[0];
  if (firstA.length >= 2 && firstB.length >= 2) {
    const firstSim = similarity(firstA, firstB);
    if (firstSim < 0.70) return 0;
  }

  return similarity(an, bn);
}

/**
 * Is it a duplicate? Adaptive threshold based on string length.
 */
function isDuplicate(score, a, b) {
  const maxLen = Math.max((a||'').length, (b||'').length);
  const threshold = maxLen < 8 ? 0.85 : maxLen < 15 ? 0.80 : 0.75;
  return score >= threshold;
}

async function findSimilarVendors(db, name, trade) {
  const norm = normalise(name);
  if (!norm || norm.length < 3) return [];

  const prefix = norm.substring(0, 4);
  const [candidates] = await db.query(
    `SELECT id, vendor_name, trade FROM vendors
     WHERE (trade = ? OR ? IS NULL)
     AND (LOWER(vendor_name) LIKE ? OR SOUNDEX(vendor_name) = SOUNDEX(?))
     LIMIT 20`,
    [trade||null, trade||null, prefix + '%', name]
  );

  return candidates
    .map(c => {
      const s = dupScore(c.vendor_name, name);
      return { ...c, similarity: s, is_duplicate: isDuplicate(s, c.vendor_name, name) };
    })
    .filter(c => c.is_duplicate)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

async function findSimilarClients(db, name) {
  const norm = normalise(name);
  if (!norm || norm.length < 3) return [];

  const prefix = norm.substring(0, 4);
  const [candidates] = await db.query(
    `SELECT id, client_name FROM clients
     WHERE LOWER(client_name) LIKE ? OR SOUNDEX(client_name) = SOUNDEX(?)
     LIMIT 20`,
    [prefix + '%', name]
  );

  return candidates
    .map(c => {
      const s = dupScore(c.client_name, name);
      return { ...c, similarity: s, is_duplicate: isDuplicate(s, c.client_name, name) };
    })
    .filter(c => c.is_duplicate)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

async function checkVendorDuplicate(db, name, trade) {
  const similar = await findSimilarVendors(db, name, trade);
  return {
    isDuplicate: similar.length > 0,
    suggestions: similar,
    message: similar.length > 0
      ? `Similar vendor: "${similar[0].vendor_name}" (${(similar[0].similarity*100).toFixed(0)}% match)`
      : null,
  };
}

async function checkClientDuplicate(db, name) {
  const similar = await findSimilarClients(db, name);
  return {
    isDuplicate: similar.length > 0,
    suggestions: similar,
    message: similar.length > 0
      ? `Similar client: "${similar[0].client_name}" (${(similar[0].similarity*100).toFixed(0)}% match)`
      : null,
  };
}

module.exports = { checkVendorDuplicate, checkClientDuplicate, similarity, normalise, dupScore, isDuplicate };
