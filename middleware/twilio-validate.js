// middleware/twilio-validate.js — Validate Twilio webhook signatures
// Prevents anyone other than Twilio from hitting the webhook endpoint
const crypto = require('crypto');

function validateTwilioSignature(req, res, next) {
  // Skip validation in development
  if (process.env.NODE_ENV !== 'production') return next();

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return next(); // No token configured — skip (warn in startup)

  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) {
    return res.status(403).json({ error: 'Missing Twilio signature' });
  }

  // Build the URL Twilio signed
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  // Build sorted param string
  const params = req.body || {};
  const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
    return acc + key + params[key];
  }, '');

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(url + sortedParams, 'utf8'))
    .digest('base64');

  if (expected !== twilioSignature) {
    console.warn('[Webhook] Invalid Twilio signature — request rejected');
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  next();
}

module.exports = { validateTwilioSignature };
