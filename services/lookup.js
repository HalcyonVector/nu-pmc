// services/lookup.js — Free public API lookups
// GST, IFSC, PAN, Weather — no AI cost, instant results

const http  = require('../services/http');

// ── 1. GST LOOKUP
// Public GST API — no key needed for basic lookups
async function lookupGSTIN(gstin) {
  if (!gstin || gstin.length !== 15) return { error: 'Invalid GSTIN — must be 15 characters' };
  try {
    // Primary: GST government API
    const res = await http.get(`https://sheet.gst.gov.in/files/taxpayermaster/noncompliance/${gstin}`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.data) return parseGSTResponse(res.data, gstin);
  } catch (e) { console.warn('[lookup]', e.message); }

  // Fallback: third-party free GST API
  try {
    const res = await http.get(`https://gstin.io/api/v1/${gstin}`, { timeout: 8000 });
    if (res.data?.taxpayerInfo) {
      const d = res.data.taxpayerInfo;
      return {
        gstin,
        legal_name:   d.lgnm || '',
        trade_name:   d.tradeNam || d.lgnm || '',
        address:      [d.pradr?.adr, d.pradr?.loc, d.pradr?.dst, d.pradr?.stcd].filter(Boolean).join(', '),
        state:        d.pradr?.stcd || '',
        status:       d.sts || 'Active',
        business_type: d.ctb || '',
        registration_date: d.rgdt || '',
      };
    }
  } catch (e) { console.warn('[lookup]', e.message); }

  // Fallback 2: validate format and extract state from GSTIN
  // GSTIN format: 2-digit state + 10-digit PAN + 1 entity + Z + checksum
  const stateCode = gstin.substring(0, 2);
  const states = {
    '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
    '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
    '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
    '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
    '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
    '24':'Gujarat','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka',
    '30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry',
    '36':'Telangana','37':'Andhra Pradesh (New)',
  };
  return {
    gstin,
    legal_name:   '',
    trade_name:   '',
    address:      '',
    state:        states[stateCode] || `State code ${stateCode}`,
    status:       'Unknown — verify manually',
    business_type: '',
    note:         'Live lookup unavailable — please verify details manually',
  };
}

function parseGSTResponse(data, gstin) {
  // Handle various GST API response formats
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (_e) { return { gstin, error: 'Could not parse GST response' }; }
  }
  const d = data.data || data.taxpayerInfo || data;
  return {
    gstin,
    legal_name:   d.lgnm || d.legal_name || '',
    trade_name:   d.tradeNam || d.trade_name || d.lgnm || '',
    address:      d.pradr?.adr || d.address || '',
    state:        d.pradr?.stcd || d.state || '',
    status:       d.sts || d.status || 'Active',
    business_type: d.ctb || d.constitution || '',
    registration_date: d.rgdt || '',
  };
}

// ── 2. IFSC LOOKUP
async function lookupIFSC(ifsc) {
  if (!ifsc || ifsc.length !== 11) return { error: 'Invalid IFSC — must be 11 characters' };
  try {
    const res = await http.get(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`, { timeout: 8000 });
    if (res.data) {
      return {
        ifsc:    res.data.IFSC,
        bank:    res.data.BANK,
        branch:  res.data.BRANCH,
        address: res.data.ADDRESS,
        city:    res.data.CITY,
        state:   res.data.STATE,
        contact: res.data.CONTACT || '',
        micr:    res.data.MICR || '',
      };
    }
  } catch (e) { console.warn('[lookup]', e.message); }
  return { error: 'IFSC not found — verify manually' };
}

// ── 3. PAN VALIDATION (for Finance Admin — pre-payment gate)
async function validatePAN(pan) {
  if (!pan || pan.length !== 10) return { valid: false, error: 'Invalid PAN — must be 10 characters' };
  // PAN format: AAAAA9999A — pattern from canonical source
  const { PAN_PATTERN } = require('../middleware/validate');
  if (!PAN_PATTERN.test(pan.toUpperCase())) return { valid: false, error: 'Invalid PAN format' };

  // PAN 4th character indicates entity type
  const entityTypes = {
    P: 'Individual', C: 'Company', H: 'HUF', F: 'Firm',
    A: 'AOP', T: 'Trust', B: 'BOI', L: 'Local Authority',
    J: 'Artificial Juridical Person', G: 'Government',
  };
  const entityChar = pan[3].toUpperCase();

  // Try NSDL API (free public endpoint)
  try {
    const res = await http.post('https://www.tin-nsdl.com/services/rap/pan-verification.html',
      { pan: pan.toUpperCase() },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );
    if (res.data?.status === 'VALID') {
      return { valid: true, pan: pan.toUpperCase(), name: res.data.name, entity_type: entityTypes[entityChar] || 'Unknown' };
    }
  } catch (e) { console.warn('[lookup]', e.message); }

  // Format validation only if API unavailable
  return {
    valid:       true,
    pan:         pan.toUpperCase(),
    entity_type: entityTypes[entityChar] || 'Unknown',
    note:        'Format valid — live verification unavailable. Verify with Finance Admin.',
  };
}

// ── 4. WEATHER LOOKUP for daily report
async function getWeather(lat, lng) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // Without key — return default
    return { condition: 'Clear', temp_c: null, humidity: null, source: 'manual' };
  }
  try {
    const res = await http.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`,
      { timeout: 8000 }
    );
    const w = res.data;
    const conditionMap = {
      'Clear': 'Clear', 'Clouds': 'Cloudy', 'Rain': 'Light Rain',
      'Drizzle': 'Light Rain', 'Thunderstorm': 'Heavy Rain',
      'Snow': 'Very Cold', 'Haze': 'Cloudy', 'Mist': 'Cloudy',
    };
    const main = w.weather?.[0]?.main || 'Clear';
    return {
      condition: conditionMap[main] || main,
      temp_c:    Math.round(w.main?.temp || 0),
      humidity:  w.main?.humidity || null,
      feels_like: Math.round(w.main?.feels_like || 0),
      source:    'openweathermap',
    };
  } catch (_e) {
    return { condition: 'Clear', temp_c: null, source: 'manual' };
  }
}

// ── 5. NEARBY SUPPLIERS (Google Places — prompt to PMC)
async function findNearbySuppliers(lat, lng, type) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { suppliers: [], note: 'Google Places API key not configured' };
  const keywords = {
    rmc:      'ready mix concrete plant',
    steel:    'steel supplier TMT bars',
    hardware: 'hardware building materials',
    electrical: 'electrical materials wholesale',
  };
  const keyword = keywords[type] || type;
  try {
    const res = await http.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`,
      { timeout: 10000 }
    );
    return {
      suppliers: (res.data.results || []).slice(0, 5).map(p => ({
        name:    p.name,
        address: p.vicinity,
        rating:  p.rating,
        open:    p.opening_hours?.open_now,
      })),
      type,
    };
  } catch (_e) {
    return { suppliers: [], note: 'Could not fetch nearby suppliers' };
  }
}

module.exports = { lookupGSTIN, lookupIFSC, validatePAN, getWeather, findNearbySuppliers };
