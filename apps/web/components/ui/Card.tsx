import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
  href?: string;
  className?: string;
  as?: "div" | "section" | "article";
};

/** Surface with a hairline, radius-lg and shadow-card. With `href` the whole card is a link. */
export function Card({ icon: Icon, eyebrow, title, children, href, className, as: Tag = "div" }: Props) {
  const cls = ["nl-card", className].filter(Boolean).join(" ");
  const body = (
    <>
      {Icon && (
        <div className="nl-card__icon">
          <Icon aria-hidden="true" strokeWidth={1.5} />
        </div>
      )}
      {eyebrow && <div className="t-eyebrow">{eyebrow}</div>}
      {title && <h3 className={["nl-card__title", !Icon && "nl-card__title--tight"].filter(Boolean).join(" ")}>{title}</h3>}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return <Tag className={cls}>{body}</Tag>;
}
