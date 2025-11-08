const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Setting = require('../models/setting');

const router = express.Router();

function getBrandingDefaults() {
  return {
    siteName: 'Honors Festival',
    logoData: null
  };
}

router.get('/branding', (req, res) => {
  try {
    const settings = Setting.getMany(['siteName', 'logoData']);
    const defaults = getBrandingDefaults();
    res.json({
      siteName: settings.siteName || defaults.siteName,
      logoData: settings.logoData || defaults.logoData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/branding', verifyToken, requireRole('Admin'), (req, res) => {
  try {
    let { siteName, logoData } = req.body || {};

    if (typeof siteName !== 'string' || siteName.trim().length === 0) {
      return res.status(400).json({ error: 'Site name is required.' });
    }

    siteName = siteName.trim().slice(0, 100);
    Setting.set('siteName', siteName);

    if (logoData === null || logoData === '') {
      Setting.delete('logoData');
      logoData = null;
    } else if (typeof logoData === 'string') {
      if (logoData.length > 2_000_000) {
        return res.status(400).json({ error: 'Logo is too large. Please upload a smaller image.' });
      }
      Setting.set('logoData', logoData);
    }

    res.json({ siteName, logoData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


