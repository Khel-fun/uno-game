// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/uno.sol";

contract DeployUNOGame is Script {
    function run() external {
        
        //uint256 deployerPrivateKey = vm.envUint("LOCAL_PRIVATE_KEY");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "PRIVATE_KEY not set");
        vm.startBroadcast(deployerPrivateKey);
        address deployer = vm.addr(deployerPrivateKey);
        UnoGame unoGame = new UnoGame();
        vm.stopBroadcast();
        // console.log("UNOGame deployed at:", address(unoGame));
    }
}
