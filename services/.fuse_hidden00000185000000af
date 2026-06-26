// services/upi-qr.js
// Decodes UPI QR code from photo upload
// Uses sharp (already installed) + jsqr

const sharp  = require('sharp');
const jsQR   = require('jsqr');

/**
 * Extract UPI ID from a QR code photo
 * @param {string} imagePath — path to uploaded image
 * @returns {{ upi_id, raw, valid, error }}
 */
async function decodeUPIQR(imagePath) {
  try {
    // Convert image to raw pixel data via sharp
    const { data, info } = await sharp(imagePath)
      .resize(800, 800, { fit: 'inside' }) // normalise size
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // jsQR expects Uint8ClampedArray with RGBA — convert greyscale to RGBA
    const rgba = new Uint8ClampedArray(info.width * info.height * 4);
    for (let i = 0; i < data.length; i++) {
      rgba[i*4]   = data[i]; // R
      rgba[i*4+1] = data[i]; // G
      rgba[i*4+2] = data[i]; // B
      rgba[i*4+3] = 255;     // A
    }

    const code = jsQR(rgba, info.width, info.height);
    if (!code) return { valid: false, error: 'No QR code found in image' };

    const raw = code.data;

    // UPI QR format: upi://pay?pa=UPI_ID&pn=NAME&...
    if (!raw.startsWith('upi://')) {
      return { valid: false, raw, error: 'QR code is not a UPI payment QR' };
    }

    const url    = new URL(raw);
    const upi_id = url.searchParams.get('pa');
    const name   = url.searchParams.get('pn') || '';
    const amount = url.searchParams.get('am') || null;

    if (!upi_id) return { valid: false, raw, error: 'UPI ID not found in QR' };

    // Basic UPI ID format check — user@provider
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/;
    if (!upiRegex.test(upi_id)) {
      return { valid: false, raw, upi_id, error: 'UPI ID format invalid: ' + upi_id };
    }

    return { valid: true, upi_id, name, amount, raw };
  } catch (err) {
    return { valid: false, error: 'QR decode failed: ' + err.message };
  }
}

module.exports = { decodeUPIQR };
