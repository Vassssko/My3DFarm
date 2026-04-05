import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export type MassDeployFeedItem = {
  id: string;
  /** SSH target (often IP). */
  sshHost: string;
  /** Moonraker host / display name for humans. */
  hostLabel: string;
  ok: boolean;
  message: string;
};

const VISIBLE_ROWS = 5;

/** Stronger fade at top/bottom of the viewport; center row is brightest. */
function opacityForSlot(slotIndex: number, slotCount: number): number {
  if (slotCount <= 0) {
    return 1;
  }
  if (slotCount === 1) {
    return 1;
  }
  const mid = (slotCount - 1) / 2;
  const d = Math.abs(slotIndex - mid) / mid;
  return Math.max(0.18, 1 - d * 0.82);
}

export function MassKeyDeployFeed({ items }: { items: MassDeployFeedItem[] }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const visible = items.slice(-VISIBLE_ROWS);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="relative min-h-[9.5rem] overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/25 py-1 pl-2 pr-1"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
      }}
    >
      <div className="flex min-h-[9.5rem] flex-col justify-end gap-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((row, i) => {
            const slotOpacity = opacityForSlot(i, visible.length);
            return (
              <motion.div
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                initial={reduceMotion ? { opacity: slotOpacity, y: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: slotOpacity, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                key={row.id}
                layout
                transition={{
                  duration: reduceMotion ? 0.01 : 0.32,
                  ease: [0.2, 0.9, 0.2, 1],
                }}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--glass-bg)]/80 shadow-sm">
                  {row.ok ? (
                    <Check aria-hidden className="size-4 text-[var(--success)]" strokeWidth={2.5} />
                  ) : (
                    <X aria-hidden className="size-4 text-[var(--warning)]" strokeWidth={2.5} />
                  )}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="font-mono text-[13px] font-medium text-[var(--text-primary)]">
                    {row.sshHost}
                  </div>
                  <div className="truncate text-[11px] text-[var(--text-secondary)]">
                    {row.hostLabel}
                    {!row.ok && row.message ? (
                      <span className="text-[var(--warning)]"> — {row.message}</span>
                    ) : null}
                  </div>
                </div>
                <span className="sr-only">
                  {row.ok ? t("settings.massKeyRowOk") : t("settings.massKeyRowFail")}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
