const express = require('express');
const trackingService = require('../tracking/service');

const router = express.Router();

router.post('/proof-record', async (req, res) => {
  const payload = req.body || {};

  const requiredFields = ['gameId', 'roomId', 'circuitName', 'proofHex'];
  const missing = requiredFields.filter((key) => !payload[key]);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(', ')}`,
      trackingSaved: false,
    });
  }

  const result = await trackingService.upsertProofRecord(payload);
  return res.status(200).json({
    ok: true,
    trackingSaved: result.trackingSaved,
    proofRecordId: result.proofRecordId,
    proofHash: result.proofHash,
  });
});

router.post('/kurier-update', async (req, res) => {
  const payload = req.body || {};
  if (!payload.proofRecordId) {
    return res.status(400).json({ error: 'proofRecordId is required', trackingSaved: false });
  }

  const result = await trackingService.updateKurier(payload);
  return res.status(200).json({ ok: true, trackingSaved: result.trackingSaved });
});

router.post('/aggregation-verification', async (req, res) => {
  const payload = req.body || {};
  const requiredFields = [
    'proofRecordId',
    'zkverifyContractAddress',
    'domainId',
    'aggregationId',
    'leaf',
    'merklePath',
    'leafCount',
    'leafIndex',
  ];

  const missing = requiredFields.filter((key) => payload[key] === undefined || payload[key] === null);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(', ')}`,
      trackingSaved: false,
    });
  }

  const result = await trackingService.upsertAggregationVerification(payload);
  return res.status(200).json({ ok: true, trackingSaved: result.trackingSaved });
});

router.post('/circuit-setup', async (req, res) => {
  const payload = req.body || {};

  const requiredFields = [
    'circuitName',
    'compiledCircuitJson',
    'artifactSha256',
    'verificationKeyHex',
    'vkHash',
  ];
  const missing = requiredFields.filter((key) => payload[key] === undefined || payload[key] === null);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(', ')}`,
      trackingSaved: false,
    });
  }

  const result = await trackingService.upsertCircuitSetup(payload);
  return res.status(200).json({ ok: true, trackingSaved: result.trackingSaved });
});

module.exports = router;
