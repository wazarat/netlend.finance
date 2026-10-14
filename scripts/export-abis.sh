#!/usr/bin/env bash
# Export ABIs from Foundry artifacts (contracts/out) into packages/sdk/abis (consumed by api, mcp, web).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/packages/sdk/abis"; mkdir -p "$OUT"
cd "$ROOT/contracts" && forge build >/dev/null 2>&1
python3 -I - "$ROOT/contracts/out" "$OUT" <<'PY'
import json, sys, pathlib
out, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
wanted = {
  "IMorpho": "IMorpho.sol/IMorpho.json", "IMetaMorpho": "IMetaMorphoV1_1.sol/IMetaMorphoV1_1.json",
  "IIrm": "IIrm.sol/IIrm.json", "IOracle": "IOracle.sol/IOracle.json",
  "MockUSDG": "MockUSDG.sol/MockUSDG.json", "MockStockToken": "MockStockToken.sol/MockStockToken.json",
  "MockV3Aggregator": "MockV3Aggregator.sol/MockV3Aggregator.json", "MarketHoursFeed": "MarketHoursFeed.sol/MarketHoursFeed.json",
  "Faucet": "Faucet.sol/Faucet.json", "MockNFT": "MockNFT.sol/MockNFT.json",
  "UniV3TwapOracle": "UniV3TwapOracle.sol/UniV3TwapOracle.json", "MarketGuard": "MarketGuard.sol/MarketGuard.json",
  "IPublicAllocator": "IPublicAllocator.sol/IPublicAllocator.json",
  "FixedTermMarket": "FixedTermMarket.sol/FixedTermMarket.json", "NetlendToken": "NetlendToken.sol/NetlendToken.json",
  "StakingRewards": "StakingRewards.sol/StakingRewards.json", "RevenueSplitter": "RevenueSplitter.sol/RevenueSplitter.json",
}
for name, rel in wanted.items():
    p = out / rel
    if not p.exists():
        print("  missing", rel); continue
    json.dump(json.load(open(p))["abi"], open(dst / f"{name}.json", "w"), indent=1)
    print("  " + name)
PY
echo "ABIs written to $OUT"
