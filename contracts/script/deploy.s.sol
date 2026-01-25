// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/UnoGame.sol";

/**
 * @title DeployUnoGame
 * @notice Deploy script for UnoGame with pre-deployed ZK verifier addresses
 * @dev Run with: forge script script/Deploy.s.sol:DeployUnoGame --rpc-url base_sepolia --broadcast
 * 
 * NOTE: This script deploys UnoGame using already-deployed verifier contracts.
 * The verifiers require library linking and are deployed separately using forge create:
 * 
 * 1. Deploy the library first:
 *    forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
 *      src/verifiers/shuffle_circuitVerifier.sol:ZKTranscriptLib
 * 
 * 2. Deploy each verifier with the library linked:
 *    forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
 *      --libraries src/verifiers/shuffle_circuitVerifier.sol:ZKTranscriptLib:<LIB_ADDRESS> \
 *      src/verifiers/shuffle_circuitVerifier.sol:ShuffleVerifier
 * 
 * 3. Repeat for deal, draw, and play verifiers
 * 
 * 4. Then run this script with the verifier addresses
 * 
 * DEPLOYED CONTRACTS (Base Sepolia):
 * - ZKTranscriptLib: 0xB240D0Ff46c96073727CA8133493C95D04307b7C
 * - ShuffleVerifier: 0x9D2fE939001325fF9fb58C2a22dB60549D4Ba1dA
 * - DealVerifier:    0x4AeaB7206A19EE01FbAEC8aee3654e4E93B59BE6
 * - DrawVerifier:    0x4d9CA273817BfEf07a9D73E23072DEabeb825060  
 * - PlayVerifier:    0xB99a5Cb916bd38353C435d52dDfCb9F7b51bfF0a
 * - UnoGame:         0xCaa7e88f568A78046d017fa360e514e1526005b6
 */
contract DeployUnoGame is Script {
    // Pre-deployed verifier addresses (Base Sepolia)
    address constant SHUFFLE_VERIFIER = 0x9D2fE939001325fF9fb58C2a22dB60549D4Ba1dA;
    address constant DEAL_VERIFIER = 0x4AeaB7206A19EE01FbAEC8aee3654e4E93B59BE6;
    address constant DRAW_VERIFIER = 0x4d9CA273817BfEf07a9D73E23072DEabeb825060;
    address constant PLAY_VERIFIER = 0xB99a5Cb916bd38353C435d52dDfCb9F7b51bfF0a;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "PRIVATE_KEY not set");

        vm.startBroadcast(deployerPrivateKey);
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying with account:", deployer);
        
        // Deploy UnoGame with pre-deployed verifier addresses
        console.log("\nDeploying UnoGame with verifiers...");
        console.log("ShuffleVerifier:", SHUFFLE_VERIFIER);
        console.log("DealVerifier:", DEAL_VERIFIER);
        console.log("DrawVerifier:", DRAW_VERIFIER);
        console.log("PlayVerifier:", PLAY_VERIFIER);

        UnoGame unoGame = new UnoGame(
            SHUFFLE_VERIFIER,
            DEAL_VERIFIER,
            DRAW_VERIFIER,
            PLAY_VERIFIER
        );
        address unoGameAddr = address(unoGame);
        console.log("\nUnoGame deployed to:", unoGameAddr);

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("ShuffleVerifier:", SHUFFLE_VERIFIER);
        console.log("DealVerifier:", DEAL_VERIFIER);
        console.log("DrawVerifier:", DRAW_VERIFIER);
        console.log("PlayVerifier:", PLAY_VERIFIER);
        console.log("UnoGame:", unoGameAddr);
        console.log("========================================");
    }
}

/**
 * @title DeployUnoGameWithMock
 * @notice Deploy script for UnoGame with MockVerifier (for testing)
 */
contract DeployUnoGameWithMock is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "PRIVATE_KEY not set");

        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying with account:", deployer);

        // Deploy mock verifier
        console.log("\nDeploying MockVerifier...");
        MockVerifier mockVerifier = new MockVerifier();
        address mockAddr = address(mockVerifier);
        console.log("MockVerifier deployed to:", mockAddr);

        // Deploy UnoGame with mock verifier for all circuits
        console.log("\nDeploying UnoGame with MockVerifier...");
        UnoGame unoGame = new UnoGame(
            mockAddr,
            mockAddr,
            mockAddr,
            mockAddr
        );
        console.log("UnoGame deployed to:", address(unoGame));

        vm.stopBroadcast();
    }
}

/**
 * @title MockVerifier
 * @notice Simple mock verifier for testing
 */
contract MockVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}
