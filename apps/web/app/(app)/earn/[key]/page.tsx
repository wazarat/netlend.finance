import type { Metadata } from "next";
import { registry } from "@netlend/sdk";
import { VaultDetailView } from "./VaultDetailView";

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { key } = await params;
  const v = registry.vaults.find((x) => x.key === decodeURIComponent(key));
  return { title: v ? v.name : "Vault" };
}

export default async function VaultPage({ params }: Params) {
  const { key } = await params;
  return <VaultDetailView vaultKey={decodeURIComponent(key)} />;
}
