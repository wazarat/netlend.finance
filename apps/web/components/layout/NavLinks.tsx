"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items, ariaLabel = "Main" }: { items: NavItem[]; ariaLabel?: string }) {
  const pathname = usePathname();
  return (
    <nav className="nl-nav" aria-label={ariaLabel}>
      {items.map((it) => {
        const path = it.href.split("#")[0];
        const active = path !== "" && path !== "/" && pathname.startsWith(path);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
