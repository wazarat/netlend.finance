/** Placeholder sized like the content it stands in for. Never a made-up number. */
export function Skeleton({ width = "6ch", height = "1em", className }: { width?: string | number; height?: string | number; className?: string }) {
  return <span aria-hidden="true" className={["nl-skeleton", className].filter(Boolean).join(" ")} style={{ width, height }} />;
}
