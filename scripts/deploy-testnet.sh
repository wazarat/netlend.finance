#!/usr/bin/env bash
# Deploy the whole netlend.finance stack to Robinhood Chain testnet (46630), one script after another with one key.
# Idempotent: every script skips what addresses.46630.json already records. Verification is a separate pass
# (scripts/verify-testnet.sh) so a slow Blockscout never stalls a broadcast.
# Usage: scripts/deploy-testnet.sh [from-step]   e.g. scripts/deploy-testnet.sh 03
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/.testnet-logs"; mkdir -p "$LOG"
set -a; source "$ROOT/.env"; set +a
export ADDRESS_BOOK=../packages/sdk/addresses.46630.json
FROM="${1:-01}"
cd "$ROOT/contracts"
run() {
  local name="$1"; local step="${name#Deploy}"; step="${step%%_*}"
  [[ "$step" < "$FROM" ]] && { echo "== $name (skipped)"; return; }
  echo "== $name"
  # The public RPC is load-balanced over nodes that lag a few blocks; forge's simulation then fails with
  # "unsupported block number" / "failed to get block number". Nothing is sent during simulation and every script
  # is idempotent, so retry a few times before giving up.
  # Forge writes the address book during simulation. If the broadcast never happens, those entries are stale and a
  # later CREATE at the same nonce can give them code, which fools the code-presence check. So snapshot and restore.
  local book="$ROOT/packages/sdk/addresses.46630.json"; cp "$book" "$book.bak"
  local ok=0
  for attempt in 1 2 3 4 5 6; do
    cp "$book.bak" "$book"
    if forge script "script/$name.s.sol" --rpc-url "$RH_RPC_URL" --broadcast --non-interactive --slow > "$LOG/$name.log" 2>&1; then
      ok=1; break
    fi
    if grep -qE "unsupported block number|failed to get block number|failed to get account" "$LOG/$name.log"; then
      echo "   rpc lag (attempt $attempt), retrying in 15s"; sleep 15; continue
    fi
    break
  done
  if [[ $ok == 1 ]]; then
    rm -f "$book.bak"
    grep -E "done|ONCHAIN EXECUTION COMPLETE" "$LOG/$name.log" | tail -2
  else
    cp "$book.bak" "$book"; rm -f "$book.bak"
    echo "FAILED (address book restored): see $LOG/$name.log"; grep -E "Error|revert|Reason" "$LOG/$name.log" | head -5; exit 1
  fi
  echo "   balance now: $(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RH_RPC_URL" --ether) ETH"
}
run Deploy01_Core
run Deploy02_Substitutes
run Deploy02b_Uniswap
run Deploy03_Oracles
run Deploy04_Markets
run Deploy05_Vaults
run Deploy05b_FlowCaps
run Deploy06_Fixed
run Deploy07_Token
echo "== address book"
python3 -I -c "import json; d=json.load(open('$ROOT/packages/sdk/addresses.46630.json')); print('core', d['core']); print('vaults', d['vaults']); print('markets', list(d['markets'].keys())); print('fixed', d['fixed'].get('market'), list(d['fixed']['markets'].keys())); print('token', d['token'])"
