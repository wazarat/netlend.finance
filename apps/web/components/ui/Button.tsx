import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost";

type Common = {
  variant?: Variant;
  size?: "md" | "sm";
  block?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "start" | "end";
  className?: string;
  children: ReactNode;
};

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AsLink = Common & { href: string; target?: string; rel?: string; "aria-label"?: string; title?: string };

export type ButtonProps = AsButton | AsLink;

/** Pill button, or a link styled as one when `href` is given. A disabled button's label should say why it is disabled. */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", block, loading, icon: Icon, iconPosition = "start", className, children } = props;
  const cls = ["nl-btn", `nl-btn--${variant}`, size === "sm" && "nl-btn--sm", block && "nl-btn--block", className].filter(Boolean).join(" ");
  const content = (
    <>
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : Icon && iconPosition === "start" ? <Icon aria-hidden="true" strokeWidth={1.5} /> : null}
      {children}
      {!loading && Icon && iconPosition === "end" ? <Icon aria-hidden="true" strokeWidth={1.5} /> : null}
    </>
  );
  if (typeof props.href === "string") {
    const { href, target, rel, "aria-label": ariaLabel, title } = props;
    return (
      <Link href={href} target={target} rel={rel} aria-label={ariaLabel} title={title} className={cls}>
        {content}
      </Link>
    );
  }
  const { variant: _v, size: _s, block: _b, loading: _l, icon: _i, iconPosition: _p, className: _c, children: _ch, href: _h, ...rest } = props as AsButton;
  void _v; void _s; void _b; void _l; void _i; void _p; void _c; void _ch; void _h;
  return (
    <button type="button" {...rest} className={cls} aria-busy={loading || undefined} disabled={rest.disabled || loading}>
      {content}
    </button>
  );
}
