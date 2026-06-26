// routes/lookup.js — Public API lookups exposed to frontend
const express = require('express');
const { requireAuth } = require('../../../middleware/auth');
const lookup  = require('../../../services/lookup');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// GET /api/lookup/gstin/:gstin
router.get('/gstin/:gstin', requireAuth, asyncHandler(async (req, res) => {
    const result = await lookup.lookupGSTIN(req.params.gstin.toUpperCase());
    res.json(result);
  }));

// GET /api/lookup/ifsc/:ifsc
router.get('/ifsc/:ifsc', requireAuth, asyncHandler(async (req, res) => {
    const result = await lookup.lookupIFSC(req.params.ifsc.toUpperCase());
    res.json(result);
  }));

// GET /api/lookup/pan/:pan — finance_admin or principals only
router.get('/pan/:pan', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const allowed = ['principal','design_principal','finance_admin'];
    // Audit reads everything on GET — matches isAuditGet() carve-out in
    // middleware/auth.js.
    if (me.role !== 'audit' && !allowed.includes(me.role)) {
      return res.status(403).json({ error: 'PAN validation — authorised users only' });
    }
    const result = await lookup.validatePAN(req.params.pan.toUpperCase());
    res.json(result);
  }));

// GET /api/lookup/weather?lat=&lng=
router.get('/weather', requireAuth, asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const result = await lookup.getWeather(parseFloat(lat), parseFloat(lng));
    res.json(result);
  }));

// GET /api/lookup/suppliers?lat=&lng=&type=
router.get('/suppliers', requireAuth, asyncHandler(async (req, res) => {
    const { lat, lng, type } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const result = await lookup.findNearbySuppliers(parseFloat(lat), parseFloat(lng), type || 'hardware');
    res.json(result);
  }));

module.exports = router;
