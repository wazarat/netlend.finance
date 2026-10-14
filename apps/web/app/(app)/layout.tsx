import { AppHeader, Footer } from "@/components/layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="nl-container nl-page">{children}</main>
      <Footer />
    </>
  );
}
