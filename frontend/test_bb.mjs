import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { readFileSync } from 'fs';

async function test() {
  const circuits = ['shuffle_circuit', 'play_circuit', 'draw_circuit', 'deal_circuit'];
  
  try {
    console.log('Creating Barretenberg instance...');
    const api = await Barretenberg.new();
    console.log('Barretenberg API created');

    for (const name of circuits) {
      try {
        const circuit = JSON.parse(readFileSync(`public/circuits/${name}.json`, 'utf8'));
        console.log(`\n--- Testing ${name} (bytecode len: ${circuit.bytecode.length}) ---`);
        
        const backend = new UltraHonkBackend(circuit.bytecode, api);
        console.log(`  Backend created`);

        // Test 1: default settings (poseidon2, no ZK)
        console.log(`  Testing getVerificationKey (default)...`);
        const vk1 = await backend.getVerificationKey();
        console.log(`  DEFAULT VK length: ${vk1.length} - OK`);

        // Test 2: EVM settings 
        console.log(`  Testing getVerificationKey (verifierTarget: evm)...`);
        const vk2 = await backend.getVerificationKey({ verifierTarget: 'evm' });
        console.log(`  EVM VK length: ${vk2.length} - OK`);
        
        console.log(`  ${name}: ALL TESTS PASSED`);
      } catch (e) {
        console.error(`  ${name} FAILED: ${e.message}`);
      }
    }

    await api.destroy();
    console.log('\nDone.');
    process.exit(0);
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
}

test();
