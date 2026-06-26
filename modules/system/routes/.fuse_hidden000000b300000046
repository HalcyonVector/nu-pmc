// routes/ai-settings.js — Principal-only AI feature toggle management
'use strict';
const express = require('express');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const toggles = require('../../../services/ai-toggles');
const audit = require('../../../services/audit');
const router = express.Router();

// GET /api/ai-settings — list all toggles with current state + API key status
router.get('/', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const features = await toggles.getAll();
  const apiKeySet = !!process.env.ANTHROPIC_API_KEY;
  res.json({ features, api_key_set: apiKeySet });
}));

// GET /api/ai-settings/enabled — returns just enabled feature keys (any auth user)
router.get('/enabled', requireAuth, asyncHandler(async (req, res) => {
  const features = await toggles.getAll();
  const enabled = features.filter(f => f.enabled).map(f => f.feature_key);
  res.json({ enabled });
}));

// PATCH /api/ai-settings/:feature_key — toggle a feature on/off
router.patch('/:feature_key', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
  const { feature_key } = req.params;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) required' });
  }
  await toggles.setEnabled(feature_key, enabled, req.session.user.id);
  audit.log({
    userId: req.session.user.id,
    action: 'ai_settings.toggle',
    entityType: 'ai_feature_toggles',
    entityId: null,
    details: { feature_key, enabled },
    req,
  });
  res.json({ success: true, feature_key, enabled });
}));

module.exports = router;
