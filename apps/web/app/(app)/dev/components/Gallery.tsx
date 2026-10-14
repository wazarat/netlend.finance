"use client";
import { useState } from "react";
import { AmountInput, Tabs } from "@/components/ui";

export function Gallery() {
  const [tab, setTab] = useState("supply");
  const [amt, setAmt] = useState("500.00");
  return (
    <>
      <h2 className="t-h2 mb-4">Tabs and amount input</h2>
      <div className="grid gap-6 tablet:grid-cols-2 mb-8">
        <div className="nl-card nl-stack" style={{ gap: "var(--space-5)" }}>
          <Tabs ariaLabel="Example" value={tab} onChange={setTab} items={[{ id: "supply", label: "Supply" }, { id: "borrow", label: "Borrow" }, { id: "repay", label: "Repay" }]} />
          <AmountInput id="demo-amt" label="Amount" token="USDG" value={amt} onChange={setAmt} balanceLabel="Wallet 1,250.00 USDG" onMax={() => setAmt("1250")} help="About $500.00" />
        </div>
        <div className="nl-card nl-stack" style={{ gap: "var(--space-5)" }}>
          <AmountInput id="demo-err" label="Amount" token="rTSLA" value="9999" onChange={() => {}} balanceLabel="Wallet 12.0000 rTSLA" error="Insufficient balance" />
          <AmountInput id="demo-dis" label="Amount" token="WETH" value="" onChange={() => {}} disabled help="Connect wallet to continue" />
        </div>
      </div>
    </>
  );
}
