// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockV3Aggregator
/// @notice Minimal Chainlink AggregatorV3Interface mock. `updateAnswer` sets the latest round.
contract MockV3Aggregator {
    uint8 public immutable decimals;
    string public description;
    uint256 public constant version = 0;

    int256 public latestAnswer;
    uint256 public latestTimestamp;
    uint80 public latestRound;

    mapping(uint80 => int256) private _answers;
    mapping(uint80 => uint256) private _timestamps;
    mapping(uint80 => uint256) private _startedAt;

    address public owner;

    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(uint8 decimals_, string memory description_, int256 initialAnswer, address owner_) {
        decimals = decimals_;
        description = description_;
        owner = owner_;
        _update(initialAnswer);
    }

    function transferOwnership(address o) external onlyOwner {
        owner = o;
    }

    function updateAnswer(int256 answer) external onlyOwner {
        _update(answer);
    }

    function _update(int256 answer) internal {
        latestAnswer = answer;
        latestTimestamp = block.timestamp;
        latestRound++;
        _answers[latestRound] = answer;
        _timestamps[latestRound] = block.timestamp;
        _startedAt[latestRound] = block.timestamp;
        emit AnswerUpdated(answer, latestRound, block.timestamp);
    }

    function getRoundData(uint80 roundId)
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, _answers[roundId], _startedAt[roundId], _timestamps[roundId], roundId);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (latestRound, _answers[latestRound], _startedAt[latestRound], _timestamps[latestRound], latestRound);
    }
}
