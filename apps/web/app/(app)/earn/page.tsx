import type { Metadata } from "next";
import { EarnView } from "./EarnView";

export const metadata: Metadata = { title: "Earn" };

export default function EarnPage() {
  return <EarnView />;
}
