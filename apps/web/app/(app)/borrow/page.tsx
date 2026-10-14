import type { Metadata } from "next";
import { BorrowView } from "./BorrowView";

export const metadata: Metadata = { title: "Borrow" };

export default function BorrowPage() {
  return <BorrowView />;
}
