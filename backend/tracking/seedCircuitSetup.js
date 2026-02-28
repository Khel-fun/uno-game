/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const trackingService = require('./service');

const CIRCUITS = ['shuffle', 'deal', 'draw', 'play'];

function toHex(buffer) {
  return `0x${buffer.toString('hex')}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const vkHashMap = JSON.parse(process.env.TRACKING_VK_HASH_JSON || '{}');
  const circuitsDir = path.resolve(__dirname, '../../frontend/public/circuits');

  for (const circuitName of CIRCUITS) {
    const circuitPath = path.join(circuitsDir, `${circuitName}_circuit.json`);
    const vkPath = path.join(circuitsDir, `${circuitName}_circuit_vk`);

    if (!fs.existsSync(circuitPath)) {
      console.warn(`[seed] skipping ${circuitName}: missing ${circuitPath}`);
      continue;
    }

    if (!fs.existsSync(vkPath)) {
      console.warn(`[seed] skipping ${circuitName}: missing ${vkPath}`);
      continue;
    }

    const compiledCircuitJson = readJson(circuitPath);
    const artifactSha256 = crypto
      .createHash('sha256')
      .update(JSON.stringify(compiledCircuitJson))
      .digest('hex');

    const verificationKeyHex = toHex(fs.readFileSync(vkPath));
    const vkHash = vkHashMap[circuitName] || `pending-${circuitName}`;

    const result = await trackingService.upsertCircuitSetup({
      circuitName,
      proofSystem: 'ultrahonk',
      compiledCircuitJson,
      artifactSha256,
      noirVersion: compiledCircuitJson.noir_version || null,
      circuitHash: compiledCircuitJson.hash || null,
      verificationKeyHex,
      vkHash,
      isActive: true,
    });

    console.log(`[seed] ${circuitName}: trackingSaved=${result.trackingSaved} sha=${artifactSha256}`);
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exitCode = 1;
});
