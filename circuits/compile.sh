#!/bin/bash
# Set up clean PATH with bb and nargo
NARGO_BIN=/home/naveen/.nargo/bin
BB_BIN=/home/naveen/.bb
export PATH="${NARGO_BIN}:${BB_BIN}:/usr/local/bin:/usr/bin:/bin"

cd "$(dirname "$0")"
echo "=== Compiling Noir circuits ==="
nargo compile --workspace
echo ""
echo "=== Generating verification keys (evm target for Solidity) ==="
mkdir -p target
for circuit in shuffle_circuit deal_circuit draw_circuit play_circuit; do
    if [ -f "target/${circuit}.json" ]; then
        echo "Generating VK for ${circuit}..."
        bb write_vk -b "target/${circuit}.json" -o "target/${circuit}_vk" -t evm
    else
        echo "ERROR: target/${circuit}.json not found!"
    fi
done
echo ""
echo "=== Generating Solidity verifiers ==="
for circuit in shuffle_circuit deal_circuit draw_circuit play_circuit; do
    if [ -f "target/${circuit}_vk/vk" ]; then
        echo "Generating Solidity verifier for ${circuit}..."
        bb write_solidity_verifier -k "target/${circuit}_vk/vk" -o "target/${circuit}Verifier.sol" -t evm --optimized
    else
        echo "ERROR: target/${circuit}_vk/vk not found!"
    fi
done
echo ""
echo "=== Done! ==="
ls -la target/
