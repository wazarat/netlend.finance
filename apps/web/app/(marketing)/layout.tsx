import { Footer, MarketingHeader } from "@/components/layout";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
      <Footer />
    </>
  );
}
