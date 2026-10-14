// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {NetlendToken} from "../src/token/NetlendToken.sol";
import {StakingRewards} from "../src/staking/StakingRewards.sol";
import {RevenueSplitter} from "../src/staking/RevenueSplitter.sol";
import {Faucet} from "../src/mocks/Faucet.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {IMetaMorphoV1_1} from "metamorpho/interfaces/IMetaMorphoV1_1.sol";

/// @title Deploy07_Token
/// @notice NETLEND stand-in token (700 M minted to TREASURY, the 300 M public share mintable by the faucet),
///         StakingRewards (stake NETLEND, earn USDG), RevenueSplitter (75 % treasury / 25 % stakers of the vault
///         performance fee). Points every vault's fee recipient at the splitter, adds a 1,000 NETLEND faucet drip
///         and seeds a first 1,000 USDG reward stream so Stake shows live figures. Idempotent per key.
contract Deploy07_Token is AddressBook {
    uint256 constant INITIAL_MINT = 700_000_000e18; // everything except the 30 % public share
    uint256 constant STAKERS_BPS = 2_500; // 25 % of the performance fee to stakers, 75 % to treasury (15 : 5 of interest)
    uint256 constant FAUCET_DRIP = 1_000e18;
    uint256 constant SEED_REWARD = 1_000e6;

    function run() external {
        address deployer = _deployer();
        address owner = _role("OWNER", deployer);
        address treasury = _role("TREASURY", deployer);
        address usdg = _require("substitutes.usdg");
        address faucet = _require("substitutes.faucet");
        vm.startBroadcast(deployer);

        address token = _get("token.netlend");
        if (token == address(0)) {
            token = address(new NetlendToken(deployer, treasury, INITIAL_MINT));
            _put("token.netlend", token);
            NetlendToken(token).grantRole(NetlendToken(token).MINTER_ROLE(), faucet);
            _appendDrip(Faucet(faucet), token, FAUCET_DRIP);
        }

        address staking = _get("token.staking");
        if (staking == address(0)) {
            staking = address(new StakingRewards(deployer, token, usdg));
            _put("token.staking", staking);
        }

        address splitter = _get("token.splitter");
        if (splitter == address(0)) {
            splitter = address(new RevenueSplitter(deployer, treasury, staking, usdg, STAKERS_BPS));
            _put("token.splitter", splitter);
            StakingRewards(staking).setRewardsDistribution(splitter);
            // First stream so the Stake page has a rate on day one (testnet only).
            MockUSDG(usdg).mint(splitter, SEED_REWARD);
            RevenueSplitter(splitter).distribute(usdg);
        }

        string[3] memory vaults = ["core", "frontier", "eth"];
        for (uint256 i = 0; i < vaults.length; i++) {
            address v = _get(string.concat("vaults.", vaults[i]));
            if (v == address(0)) continue;
            IMetaMorphoV1_1 vault = IMetaMorphoV1_1(v);
            if (vault.owner() == deployer && vault.feeRecipient() != splitter) vault.setFeeRecipient(splitter);
        }

        if (owner != deployer) {
            if (StakingRewards(staking).owner() == deployer) StakingRewards(staking).setOwner(owner);
            if (RevenueSplitter(splitter).owner() == deployer) RevenueSplitter(splitter).setOwner(owner);
        }
        vm.stopBroadcast();
        console2.log("Deploy07_Token done. NETLEND:", token, "staking:", staking);
    }

    function _appendDrip(Faucet f, address token, uint256 amount) internal {
        uint256 n = f.dripCount();
        Faucet.Drip[] memory d = new Faucet.Drip[](n + 1);
        for (uint256 i = 0; i < n; i++) {
            (address t, uint256 a) = f.drips(i);
            d[i] = Faucet.Drip(t, a);
        }
        d[n] = Faucet.Drip(token, amount);
        f.setDrips(d);
    }
}
