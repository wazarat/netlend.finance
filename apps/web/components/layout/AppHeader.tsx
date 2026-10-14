import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { NetworkChip } from "./NetworkChip";
import { FaucetButton } from "./FaucetButton";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/earn", label: "Earn" },
  { href: "/borrow", label: "Borrow" },
  { href: "/portfolio", label: "Portfolio" },
];

export function AppHeader() {
  return (
    <header className="nl-header">
      <Logo />
      <NavLinks items={NAV} />
      <div className="nl-header__end">
        <NetworkChip />
        <FaucetButton />
        <WalletButton />
      </div>
    </header>
  );
}
