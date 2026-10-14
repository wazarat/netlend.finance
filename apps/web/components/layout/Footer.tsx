import { explorerUrl, networkLabel } from "@/config/chain";
import { ThemeToggle } from "./ThemeToggle";

export const REPO_URL = "https://github.com/wazarat/netlend.finance";

export function Footer() {
  return (
    <footer className="nl-footer">
      <div className="nl-container flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <a href="/earn">Earn</a>
            <a href="/borrow">Borrow</a>
            <a href="/portfolio">Portfolio</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source
            </a>
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              Explorer
            </a>
          </nav>
          <ThemeToggle />
        </div>
        <p className="m-0">
          netlend.finance runs on {networkLabel}. Test tokens have no value. Rates are variable, positions can be liquidated, and nothing
          here is investment advice.
        </p>
      </div>
    </footer>
  );
}
