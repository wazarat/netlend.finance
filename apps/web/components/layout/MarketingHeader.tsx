import { Button } from "@/components/ui";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

const NAV = [
  { href: "/#how", label: "Product" },
  { href: "/#faq", label: "Docs" },
  { href: "/#security", label: "Security" },
];

export function MarketingHeader() {
  return (
    <header className="nl-header">
      <Logo />
      <div className="nl-hide-mobile">
        <NavLinks items={NAV} />
      </div>
      <div className="nl-header__end">
        <Button href="/earn" size="sm">
          Launch app
        </Button>
      </div>
    </header>
  );
}
