import { StatusChip } from "@/components/ui";
import { deployed, networkLabel } from "@/config/chain";

export function NetworkChip() {
  return (
    <StatusChip tone={deployed ? "positive" : "neutral"} className="nl-hide-mobile">
      {networkLabel}
    </StatusChip>
  );
}
