// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test-only stand-in for BEP-20 USDT. NOTE: USDT on BSC uses 18 decimals
/// (unlike Ethereum USDT's 6) - this mock matches BSC behaviour.
contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
