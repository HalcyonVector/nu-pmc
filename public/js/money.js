// public/js/money.js — Indian currency input + display helpers
// Loaded globally; used by every money input in the app.
//
// USAGE IN HTML:
//   <input type="text" class="money-input" id="pr-amount" placeholder="e.g. 25,00,000">
//   — getRaw('pr-amount') returns a Number (e.g. 2500000) or null if invalid
//
// USAGE IN JS:
//   Money.format(2500000)          → "25,00,000"
//   Money.formatRupee(2500000)     → "₹25,00,000"
//   Money.parse("25,00,000")       → 2500000
//   Money.parse("abc")             → null
//   Money.getRaw('pr-amount')      → 2500000 (reads input, strips commas, returns Number)

window.Money = (function () {

  // Parse a user-entered Indian-format string into a Number (or null).
  // Mirror of backend services/payment-validation.js parseIndianAmount.
  function parse(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    let s = String(raw).trim();
    if (!s) return null;
    // Strip currency prefixes
    s = s.replace(/^(?:₹|Rs\.?|INR|rs\.?|inr)\s*/i, '');
    s = s.replace(/\s*(?:₹|Rs\.?|INR|rs\.?|inr)$/i, '');
    s = s.trim();
    // Any letters → reject
    if (/[a-zA-Z]/.test(s)) return null;
    // Strip commas and spaces (commas might be Indian or US — both resolve cleanly)
    s = s.replace(/[,\s]/g, '');
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  // Format a number in Indian lakh/crore grouping — ALWAYS Indian style.
  // format(2500000)   → "25,00,000"
  // format(29578355)  → "2,95,78,355"
  // format(1234.5, 2) → "1,234.50"
  function format(n, decimals = 0) {
    const num = typeof n === 'number' ? n : parse(n);
    if (num === null || !isFinite(num)) return '0';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatRupee(n, decimals = 0) {
    return '₹' + format(n, decimals);
  }

  // Read a money input field, return the parsed Number (or null if invalid/blank).
  function getRaw(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return null;
    return parse(el.value);
  }

  // Attach input handlers to every .money-input on the page.
  // Behaviour:
  //   - inputmode decimal → phone keypad shows decimal point
  //   - onblur → reformat to Indian style ("2500000" becomes "25,00,000")
  //   - onfocus → strip commas so user can edit easily
  //   - on invalid input → red border + clear value
  function bindInputs(root = document) {
    const inputs = root.querySelectorAll('.money-input');
    inputs.forEach(el => {
      if (el.dataset.moneyBound) return;
      el.dataset.moneyBound = '1';
      el.setAttribute('inputmode', 'decimal');
      el.setAttribute('autocomplete', 'off');
      // On focus — strip commas so user can edit the raw number
      el.addEventListener('focus', () => {
        const n = parse(el.value);
        if (n !== null) el.value = String(n);
      });
      // On blur — reformat in Indian style
      el.addEventListener('blur', () => {
        if (!el.value.trim()) { el.classList.remove('money-invalid'); return; }
        const n = parse(el.value);
        if (n === null) {
          el.classList.add('money-invalid');
          return;
        }
        if (n < 0) {
          el.classList.add('money-invalid');
          return;
        }
        el.classList.remove('money-invalid');
        el.value = format(n);  // e.g. "2500000" → "25,00,000"
      });
      // Live: prevent garbage characters from being typed
      el.addEventListener('input', () => {
        // Allow digits, commas, decimal point, currency prefixes — nothing else
        const cleaned = el.value.replace(/[^\d,.₹]/g, '').replace(/\s+/g, '');
        if (cleaned !== el.value) el.value = cleaned;
      });
    });
  }

  // Auto-bind on DOM ready, and bind again whenever Modal or new screens render.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindInputs());
  } else {
    bindInputs();
  }
  // Re-bind on MutationObserver so dynamically-injected inputs also get wired
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes.length) bindInputs();
    }
  });
  try { observer.observe(document.body, { childList: true, subtree: true }); } catch (_e) {}

  return { parse, format, formatRupee, getRaw, bindInputs };
})();
