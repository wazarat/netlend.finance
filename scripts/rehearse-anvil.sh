#!/usr/bin/env bash
# Rehearse the full testnet deploy chain on a local Anvil node, writing to packages/sdk/addresses.local.json.
# Usage: scripts/rehearse-anvil.sh [logdir]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${1:-$ROOT/.anvil-logs}"; mkdir -p "$LOG"
export RPC=http://127.0.0.1:8545
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil account 0
export ADDRESS_BOOK=../packages/sdk/addresses.local.json

pkill -f "anvil --port 8545" 2>/dev/null || true
anvil --port 8545 --chain-id 31337 --base-fee 0 --gas-limit 60000000 --silent > "$LOG/anvil.log" 2>&1 &
sleep 2
python3 -I - <<PY
import json
d=json.load(open("$ROOT/packages/sdk/addresses.46630.json"))
d["chainId"]=31337; d["chainName"]="anvil"; d["known"]={"weth":"0x0000000000000000000000000000000000000000"}
json.dump(d,open("$ROOT/packages/sdk/addresses.local.json","w"),indent=2)
PY
cd "$ROOT/contracts"
run() { echo "== $1"; forge script "script/$1.s.sol" --rpc-url "$RPC" --broadcast --non-interactive > "$LOG/$1.log" 2>&1 \
  && grep -E "done|ONCHAIN EXECUTION COMPLETE" "$LOG/$1.log" | tail -2 || { echo "FAILED: see $LOG/$1.log"; grep -E "Error|revert|Reason" "$LOG/$1.log" | head -5; exit 1; }; }
run Deploy00_Local
run Deploy01_Core
run Deploy02_Substitutes
run Deploy02b_Uniswap
cast rpc evm_increaseTime 1900 --rpc-url "$RPC" >/dev/null; cast rpc evm_mine --rpc-url "$RPC" >/dev/null   # fill the TWAP window
run Deploy03_Oracles
run Deploy04_Markets
run Deploy05_Vaults
echo "== address book"
python3 -I -c "import json; d=json.load(open('$ROOT/packages/sdk/addresses.local.json')); print('core', d['core']); print('vaults', d['vaults']); print('markets', list(d['markets'].keys()))"
