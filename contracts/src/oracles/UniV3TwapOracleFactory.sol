// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UniV3TwapOracle} from "./UniV3TwapOracle.sol";

/// @title UniV3TwapOracleFactory
/// @notice Deterministic deployer for TWAP oracles so the API can verify an oracle was produced here.
contract UniV3TwapOracleFactory {
    mapping(address => bool) public isTwapOracle;

    event CreateUniV3TwapOracle(address indexed oracle, address indexed pool, address collateral, address loan, uint32 window);

    function create(address pool, address collateralToken, address loanToken, uint32 window, bytes32 salt)
        external
        returns (UniV3TwapOracle oracle)
    {
        oracle = new UniV3TwapOracle{salt: salt}(pool, collateralToken, loanToken, window);
        isTwapOracle[address(oracle)] = true;
        emit CreateUniV3TwapOracle(address(oracle), pool, collateralToken, loanToken, window);
    }
}
