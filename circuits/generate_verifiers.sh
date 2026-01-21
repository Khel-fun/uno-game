#!/bin/bash
# Script to generate Solidity verifiers for all circuits

cd /mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/circuits

echo "Generating Solidity verifiers..."

# Shuffle Verifier
echo "Generating ShuffleVerifier..."
~/.bb/bb write_vk -b ./target/shuffle_circuit.json 2>/dev/null
~/.bb/bb contract -o /mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/contracts/verifiers/ShuffleVerifier.sol 2>&1
echo "✓ ShuffleVerifier.sol generated"

# Deal Verifier
echo "Generating DealVerifier..."
~/.bb/bb write_vk -b ./target/deal_circuit.json 2>/dev/null
~/.bb/bb contract -o /mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/contracts/verifiers/DealVerifier.sol 2>&1
echo "✓ DealVerifier.sol generated"

# Draw Verifier
echo "Generating DrawVerifier..."
~/.bb/bb write_vk -b ./target/draw_circuit.json 2>/dev/null
~/.bb/bb contract -o /mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/contracts/verifiers/DrawVerifier.sol 2>&1
echo "✓ DrawVerifier.sol generated"

# Play Verifier
echo "Generating PlayVerifier..."
~/.bb/bb write_vk -b ./target/play_circuit.json 2>/dev/null
~/.bb/bb contract -o /mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/contracts/verifiers/PlayVerifier.sol 2>&1
echo "✓ PlayVerifier.sol generated"

echo ""
echo "All verifiers generated successfully!"
ls -lh /mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/contracts/verifiers/
