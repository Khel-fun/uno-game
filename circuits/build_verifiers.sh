#!/bin/bash
# Build script to compile all circuits and generate Solidity verifiers

set -e

CIRCUITS_DIR="/mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/circuits"
VERIFIERS_DIR="/mnt/c/Users/hemav/OneDrive/Desktop/zunno/Zunno/contracts/verifiers"

cd "$CIRCUITS_DIR"

# Create verifiers directory
mkdir -p "$VERIFIERS_DIR"

echo "Compiling Shuffle circuit..."
nargo compile

echo "Generating Shuffle verifier..."
bb write_vk -b ./target/zk_uno.json
bb contract -b ./target/zk_uno.json -o "$VERIFIERS_DIR/ShuffleVerifier.sol"

echo "All circuits compiled and verifiers generated!"
echo "Verifier contracts are in: $VERIFIERS_DIR"
