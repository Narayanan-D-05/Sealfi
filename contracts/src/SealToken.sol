// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title  SealToken
 * @notice SealFi governance token.
 *
 * Balances are PUBLIC by design:
 *   - Observers know: Alice holds 500,000 SEAL tokens.
 *   - Observers do NOT know: Alice voted FOR or AGAINST.
 *
 * Vote direction privacy is handled by SealTally via fhEVM.
 * Hiding token balances (ConfidentialERC20) is a V2 consideration.
 */
contract SealToken is ERC20, ERC20Votes, ERC20Permit {

    address public owner;

    error NotOwner();

    constructor()
        ERC20("SealFi Governance Token", "SEAL")
        ERC20Permit("SealFi Governance Token")
    {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // Testnet Faucet: Anyone can mint for testing purposes
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // ─── Required overrides ──────────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address account)
        public view override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(account);
    }
}