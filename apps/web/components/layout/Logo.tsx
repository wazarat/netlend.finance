import Image from "next/image";
import Link from "next/link";

/** Full lockup from 720px up, the N mark alone on phones. The reverse lockup is swapped in by CSS in the dark theme. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="nl-header__logo" aria-label="netlend.finance home">
      <Image className="nl-logo--light nl-logo--full" src="/brand/netlend-logo.png" alt="netlend.finance" width={116} height={22} priority />
      <Image className="nl-logo--dark nl-logo--full" src="/brand/netlend-logo-reverse.png" alt="" width={116} height={24} priority />
      <Image className="nl-logo--mark" src="/brand/netlend-icon.png" alt="" width={28} height={24} />
    </Link>
  );
}
