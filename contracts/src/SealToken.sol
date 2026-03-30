// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @notice SealFi governance token.
 *
 * Note: This token uses standard ERC20Votes — balances are PUBLIC.
 *
 * This is an intentional and honest design decision:
 *
 * The AMOUNT of voting power each address holds is already public
 * on every existing governance protocol. SealFi does not hide this.
 * What SealFi hides is HOW each address voted — the direction.
 *
 * An attacker knows: Alice holds 500,000 SEAL tokens.
 * An attacker does NOT know: Alice voted FOR or AGAINST.
 * An attacker cannot see: whether the proposal is currently winning.
 *
 * Hiding token balances (using ConfidentialERC20) is a separate problem
 * orthogonal to vote direction privacy. SealFi solves vote direction privacy.
 * ConfidentialERC20 integration is a V2 consideration.
 */
contract SealToken is ERC20, ERC20Votes, ERC20Permit {

    address public owner;

    constructor()
        ERC20("SealFi Governance Token", "SEAL")
        ERC20Permit("SealFi Governance Token")
    {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Required overrides
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
