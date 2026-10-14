#!/usr/bin/env bash
# On-chain smoke against the local Anvil deployment: faucet → vault deposit → collateral → borrow → oracle read.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=${RPC:-http://127.0.0.1:8545}
PK=${PK:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}   # anvil account 1
ME=$(cast wallet address --private-key "$PK")
BOOK="$ROOT/packages/sdk/${ADDRESS_BOOK_FILE:-addresses.local.json}"
addr() { python3 -I -c "import json,sys; d=json.load(open(sys.argv[1]))
for k in sys.argv[2].split('.'): d=d[k]
print(d)" "$BOOK" "$1"; }
FAUCET=$(addr substitutes.faucet); USDG=$(addr substitutes.usdg); TSLA=$(addr substitutes.stocks.rTSLA)
CORE=$(addr vaults.core); MORPHO=$(addr core.morpho); IRM=$(addr core.adaptiveCurveIrm); ORC=$(addr markets.TSLA.oracle)
MP="($USDG,$TSLA,$ORC,$IRM,625000000000000000)"
send() { cast send "$@" --private-key "$PK" --rpc-url "$RPC" >/dev/null; }
bal() { cast call "$1" 'balanceOf(address)(uint256)' "$2" --rpc-url "$RPC"; }

if [ "${LOCAL:-1}" = "1" ]; then cast rpc evm_increaseTime 86401 --rpc-url "$RPC" >/dev/null; cast rpc evm_mine --rpc-url "$RPC" >/dev/null; fi   # past the faucet cooldown on Anvil
echo "1. faucet claim";            send "$FAUCET" 'claim()'
echo "   USDG=$(bal "$USDG" "$ME")  rTSLA=$(bal "$TSLA" "$ME")"
echo "2. deposit 5,000 USDG into Core vault"
send "$USDG" 'approve(address,uint256)' "$CORE" 5000000000
send "$CORE" 'deposit(uint256,address)' 5000000000 "$ME"
echo "   shares=$(bal "$CORE" "$ME")  vault totalAssets=$(cast call "$CORE" 'totalAssets()(uint256)' --rpc-url "$RPC")"
echo "2b. allocator moves 2,000 USDG from the ETH market (first in queue) to TSLA, as the curator would"
ALLOC_PK=${ALLOC_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}   # anvil account 0 = allocator
WETH=$(addr known.weth); ETH_ORC=$(addr markets.ETH.oracle)
MP_ETH="($USDG,$WETH,$ETH_ORC,$IRM,770000000000000000)"
MAX=115792089237316195423570985008687907853269984665640564039457584007913129639935
cast send "$CORE" 'reallocate(((address,address,address,address,uint256),uint256)[])' "[($MP_ETH,3000000000),($MP,$MAX)]" --private-key "$ALLOC_PK" --rpc-url "$RPC" >/dev/null
echo "   TSLA market supply = $(cast call "$MORPHO" 'market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)' "$(addr markets.TSLA.id)" --rpc-url "$RPC" | head -1)"
echo "3. post 2 rTSLA, borrow 400 USDG"
send "$TSLA" 'approve(address,uint256)' "$MORPHO" 2000000000000000000
send "$MORPHO" 'supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)' "$MP" 2000000000000000000 "$ME" 0x
send "$MORPHO" 'borrow((address,address,address,address,uint256),uint256,uint256,address,address)' "$MP" 400000000 0 "$ME" "$ME"
echo "   USDG after borrow=$(bal "$USDG" "$ME")"
echo "4. oracle TSLA/USDG price (1e36-scaled) = $(cast call "$ORC" 'price()(uint256)' --rpc-url "$RPC")"
echo "5. withdrawable from Core now = $(cast call "$CORE" 'maxWithdraw(address)(uint256)' "$ME" --rpc-url "$RPC")"
echo "smoke ok"
