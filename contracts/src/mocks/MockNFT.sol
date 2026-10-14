// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockNFT
/// @notice Testnet stand-in for Robinhood Punks / StonkBrokers. Anyone can mint up to maxSupply.
contract MockNFT is ERC721 {
    uint256 public immutable maxSupply;
    uint256 public nextId = 1;
    string private _base;

    constructor(string memory name_, string memory symbol_, uint256 maxSupply_, string memory base_)
        ERC721(name_, symbol_)
    {
        maxSupply = maxSupply_;
        _base = base_;
    }

    function mint(address to) external returns (uint256 id) {
        require(nextId <= maxSupply, "sold out");
        id = nextId++;
        _mint(to, id);
    }

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }
}
