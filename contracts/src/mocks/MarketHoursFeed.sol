// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @title MarketHoursFeed
/// @notice Wraps an AggregatorV3 feed and simulates Robinhood's 24/5 equity feeds:
///         when the market is "closed" the feed keeps returning the last print and its
///         original `updatedAt`, so staleness and weekend-gap logic can be exercised on testnet.
///         `setTradingOpen` is a manual override; `setSchedule` gives a weekly window in UTC.
contract MarketHoursFeed is IAggregatorV3 {
    IAggregatorV3 public immutable underlying;
    address public owner;

    bool public manualOverride;
    bool public manualOpen;

    // Weekly schedule: open if weekday bit set and openUtc <= secondsOfDay < closeUtc.
    uint32 public openUtc;
    uint32 public closeUtc;
    uint8 public weekdayMask; // bit0 = Monday … bit6 = Sunday

    // Frozen snapshot taken at close.
    uint80 private _frozenRound;
    int256 private _frozenAnswer;
    uint256 private _frozenStartedAt;
    uint256 private _frozenUpdatedAt;
    bool private _hasFrozen;

    event ScheduleSet(uint32 openUtc, uint32 closeUtc, uint8 weekdayMask);
    event TradingOpenSet(bool manualOverride, bool open);
    event Frozen(uint80 roundId, int256 answer, uint256 updatedAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(IAggregatorV3 underlying_, address owner_) {
        underlying = underlying_;
        owner = owner_;
        // Default: Mon-Fri, 24h (Robinhood feeds are 24/5)
        openUtc = 0;
        closeUtc = 86400;
        weekdayMask = 0x1F;
    }

    function setSchedule(uint32 openUtc_, uint32 closeUtc_, uint8 weekdayMask_) external onlyOwner {
        require(openUtc_ < closeUtc_ && closeUtc_ <= 86400, "bad window");
        openUtc = openUtc_;
        closeUtc = closeUtc_;
        weekdayMask = weekdayMask_;
        emit ScheduleSet(openUtc_, closeUtc_, weekdayMask_);
    }

    /// @notice Force open/closed regardless of schedule. Freezes the current print when closing.
    function setTradingOpen(bool open) external onlyOwner {
        manualOverride = true;
        manualOpen = open;
        if (!open) _freeze();
        emit TradingOpenSet(true, open);
    }

    function clearOverride() external onlyOwner {
        manualOverride = false;
        emit TradingOpenSet(false, false);
    }

    /// @notice Anyone can snapshot the last print while open, so the frozen value is fresh at close.
    function snapshot() external {
        _freeze();
    }

    function isOpen() public view returns (bool) {
        if (manualOverride) return manualOpen;
        // 1970-01-01 was a Thursday → weekday index: (days + 3) % 7 with Monday = 0
        uint256 day = (block.timestamp / 86400 + 3) % 7;
        if ((weekdayMask >> day) & 1 == 0) return false;
        uint256 sod = block.timestamp % 86400;
        return sod >= openUtc && sod < closeUtc;
    }

    function _freeze() internal {
        (uint80 r, int256 a, uint256 s, uint256 u,) = underlying.latestRoundData();
        _frozenRound = r;
        _frozenAnswer = a;
        _frozenStartedAt = s;
        _frozenUpdatedAt = u;
        _hasFrozen = true;
        emit Frozen(r, a, u);
    }

    function decimals() external view returns (uint8) {
        return underlying.decimals();
    }

    function description() external view returns (string memory) {
        return underlying.description();
    }

    function version() external view returns (uint256) {
        return underlying.version();
    }

    function getRoundData(uint80 roundId) external view returns (uint80, int256, uint256, uint256, uint80) {
        return underlying.getRoundData(roundId);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        if (!isOpen() && _hasFrozen) {
            return (_frozenRound, _frozenAnswer, _frozenStartedAt, _frozenUpdatedAt, _frozenRound);
        }
        return underlying.latestRoundData();
    }
}
