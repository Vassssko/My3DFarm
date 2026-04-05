import clsx from "clsx";
import type { CardStatus } from "../moonraker/snapshot";

/** Card LED: Moonraker state, or dirty git build while otherwise ready. */
export type StatusDotKind = CardStatus | "dirtyBuild";

const colors: Record<StatusDotKind, { bg: string; glow?: string; pulse?: boolean }> = {
  ready: { bg: "var(--success)", glow: "rgba(52, 199, 89, 0.45)" },
  dirtyBuild: { bg: "var(--printing)", glow: "rgba(255, 159, 10, 0.5)" },
  printing: { bg: "var(--printing)", glow: "rgba(255, 149, 0, 0.5)", pulse: true },
  error: { bg: "var(--warning)", glow: "rgba(255, 59, 48, 0.45)" },
  offline: { bg: "var(--offline)", glow: "rgba(142, 142, 147, 0.35)" },
};

type StatusDotProps = {
  status: StatusDotKind;
  /** `sm` for dense printer cards */
  size?: "sm" | "md";
};

export function StatusDot({ status, size = "md" }: StatusDotProps) {
  const c = colors[status];
  const glowPx = size === "sm" ? 6 : 10;
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block shrink-0 rounded-full",
        size === "sm" ? "h-[9px] w-[9px]" : "h-3 w-3",
        c.pulse && "animate-pulse",
      )}
      style={{
        backgroundColor: c.bg,
        boxShadow: c.glow ? `0 0 ${glowPx}px ${c.glow}` : undefined,
      }}
    />
  );
}
