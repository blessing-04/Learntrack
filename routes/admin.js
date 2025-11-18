const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Use service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/admin/signature
 * Upload and save the certificate signature
 */
router.post('/signature', async (req, res) => {
  try {
    const { signatureData, signatoryName, signatoryTitle } = req.body;

    if (!signatureData || !signatoryName || !signatoryTitle) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'signatureData, signatoryName, and signatoryTitle are required'
      });
    }

    // Verify it's a valid base64 image
    if (!signatureData.startsWith('data:image/png;base64,')) {
      return res.status(400).json({ error: 'Invalid signature data format' });
    }

    // Extract base64 data
    const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Save signature image to public folder
    const signaturePath = path.join(__dirname, '../public/certificate-signature.png');
    await fs.writeFile(signaturePath, buffer);

    // Save signatory info to a JSON file
    const infoPath = path.join(__dirname, '../public/certificate-signatory.json');
    const signatoryInfo = {
      name: signatoryName,
      title: signatoryTitle,
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(infoPath, JSON.stringify(signatoryInfo, null, 2));

    console.log('✅ Certificate signature saved successfully');
    console.log(`   Name: ${signatoryName}`);
    console.log(`   Title: ${signatoryTitle}`);

    res.json({
      success: true,
      message: 'Signature saved successfully',
      signatureUrl: '/certificate-signature.png',
      signatory: signatoryInfo
    });

  } catch (err) {
    console.error('Signature upload error:', err);
    res.status(500).json({
      error: 'Failed to save signature',
      details: err.message
    });
  }
});

/**
 * GET /api/admin/signature
 * Get the current certificate signature info
 */
router.get('/signature', async (req, res) => {
  try {
    const infoPath = path.join(__dirname, '../public/certificate-signatory.json');

    try {
      const data = await fs.readFile(infoPath, 'utf8');
      const signatoryInfo = JSON.parse(data);

      res.json({
        success: true,
        signatureUrl: '/certificate-signature.png',
        signatory: signatoryInfo
      });
    } catch (err) {
      // No signature saved yet
      res.json({
        success: false,
        message: 'No signature configured yet'
      });
    }

  } catch (err) {
    console.error('Get signature error:', err);
    res.status(500).json({
      error: 'Failed to get signature',
      details: err.message
    });
  }
});

module.exports = router;
