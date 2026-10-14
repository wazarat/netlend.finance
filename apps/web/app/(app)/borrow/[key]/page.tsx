import type { Metadata } from "next";
import { registry } from "@netlend/sdk";
import { MarketView } from "./MarketView";

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { key } = await params;
  const m = registry.markets.find((x) => x.key === decodeURIComponent(key));
  return { title: m ? m.name : "Market" };
}

export default async function MarketPage({ params }: Params) {
  const { key } = await params;
  return <MarketView marketKey={decodeURIComponent(key)} />;
}
