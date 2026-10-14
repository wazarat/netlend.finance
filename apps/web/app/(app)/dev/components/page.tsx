import type { Metadata } from "next";
import { Layers, ShieldCheck } from "lucide-react";
import { Button, Card, CopyAddress, MetricTile, StatusChip, Token } from "@/components/ui";
import { HealthFactor, MarketsTable } from "@/components/lending";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "Components" };

export default function ComponentsPage() {
  return (
    <>
      <h1 className="t-h1">Components</h1>
      <p className="nl-muted mt-1.5 mb-8">Every state, in the current theme. Toggle the theme in the footer to check the other.</p>

      <h2 className="t-h2 mb-4">Buttons</h2>
      <div className="nl-row mb-8">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button size="sm">Small</Button>
        <Button loading>Loading</Button>
        <Button disabled>Insufficient balance</Button>
        <Button href="/earn" icon={Layers}>With icon</Button>
      </div>

      <h2 className="t-h2 mb-4">Status chips</h2>
      <div className="nl-row mb-8">
        <StatusChip tone="positive">Healthy</StatusChip>
        <StatusChip tone="warning">Caution</StatusChip>
        <StatusChip tone="negative">At risk</StatusChip>
        <StatusChip tone="neutral">Pending</StatusChip>
        <StatusChip tone="positive" size="sm">Active</StatusChip>
      </div>

      <h2 className="t-h2 mb-4">Cards and metrics</h2>
      <div className="grid gap-6 tablet:grid-cols-3 mb-8">
        <Card icon={ShieldCheck} title="Stay in control"><p className="nl-card__body">Watch your health factor and repay any time.</p></Card>
        <Card title="Metrics" className="grid gap-4">
          <MetricTile label="Total supplied" value="$12.4M" sub="USDG markets" />
          <MetricTile label="Loading" loading sub="Skeleton" />
        </Card>
        <Card title="Tokens and addresses" className="nl-stack">
          <Token symbol="rTSLA" />
          <Token symbol="USDG" />
          <CopyAddress address="0x1234567890abcdef1234567890abcdef12345678" href="#" />
        </Card>
      </div>

      <h2 className="t-h2 mb-4">Health factor</h2>
      <div className="grid gap-6 tablet:grid-cols-4 mb-8">
        <div className="nl-card"><HealthFactor value={2.41} /></div>
        <div className="nl-card"><HealthFactor value={1.32} /></div>
        <div className="nl-card"><HealthFactor value={1.04} /></div>
        <div className="nl-card"><HealthFactor value={null} /></div>
      </div>

      <Gallery />

      <h2 className="t-h2 mb-4">Table</h2>
      <MarketsTable markets={[]} loading />
    </>
  );
}
