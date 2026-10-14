#!/usr/bin/env bash
# Verify every contract from the latest broadcast of each deploy script on Robinhood testnet Blockscout.
# Run after scripts/deploy-testnet.sh. --resume re-uses the broadcast file, sends nothing new, and verifies.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/.testnet-logs"; mkdir -p "$LOG"
set -a; source "$ROOT/.env"; set +a
export ADDRESS_BOOK=../packages/sdk/addresses.46630.json
cd "$ROOT/contracts"
for name in "${@:-Deploy01_Core Deploy02_Substitutes Deploy02b_Uniswap Deploy03_Oracles Deploy04_Markets Deploy05_Vaults Deploy06_Fixed Deploy07_Token}"; do
  for n in $name; do
    echo "== verify $n"
    forge script "script/$n.s.sol" --rpc-url "$RH_RPC_URL" --broadcast --private-key "$PRIVATE_KEY" --resume --verify --verifier blockscout \
      --verifier-url "$RH_VERIFIER_URL" --non-interactive > "$LOG/verify-$n.log" 2>&1
    grep -cE "Contract successfully verified|already verified" "$LOG/verify-$n.log" | sed 's/^/   verified: /'
    grep -E "Failed to verify|Error" "$LOG/verify-$n.log" | head -3
  done
done
