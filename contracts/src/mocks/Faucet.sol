// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @title Faucet
/// @notice Testnet faucet: once per cooldown an address can claim USDG plus a set of stock/meme tokens.
contract Faucet {
    address public owner;
    uint256 public cooldown = 1 days;

    struct Drip {
        address token;
        uint256 amount;
    }

    Drip[] public drips;
    mapping(address => uint256) public lastClaim;

    event Claimed(address indexed to);
    event DripsSet(uint256 count);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address owner_) {
        owner = owner_;
    }

    function setDrips(Drip[] calldata d) external onlyOwner {
        delete drips;
        for (uint256 i = 0; i < d.length; i++) drips.push(d[i]);
        emit DripsSet(d.length);
    }

    function setCooldown(uint256 c) external onlyOwner {
        cooldown = c;
    }

    function dripCount() external view returns (uint256) {
        return drips.length;
    }

    function claim() external {
        _drip(msg.sender);
    }

    /// @notice Owner/API can push a drip to a user (onboarding flows).
    function drip(address to) external onlyOwner {
        _drip(to);
    }

    function _drip(address to) internal {
        require(lastClaim[to] == 0 || block.timestamp >= lastClaim[to] + cooldown, "cooldown");
        lastClaim[to] = block.timestamp;
        for (uint256 i = 0; i < drips.length; i++) {
            IMintable(drips[i].token).mint(to, drips[i].amount);
        }
        emit Claimed(to);
    }
}
