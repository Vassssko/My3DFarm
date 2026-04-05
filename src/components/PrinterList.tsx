import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { getFarmGridColumns } from "../lib/farmGridColumns";
import { usePrinterStore, type SavedPrinter } from "../store/printerStore";
import { AddPrinterTile } from "./AddPrinterTile";
import { PrinterCard } from "./PrinterCard";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

function useFarmGridColumnCount(): number {
  const [cols, setCols] = useState(() =>
    typeof window !== "undefined" ? getFarmGridColumns(window.innerWidth) : 4,
  );
  const colsRef = useRef(cols);
  colsRef.current = cols;

  useEffect(() => {
    const applyColumns = () => {
      const next = getFarmGridColumns(window.innerWidth);
      if (next === colsRef.current) {
        return;
      }
      const commit = () => {
        flushSync(() => setCols(next));
      };
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        commit();
        return;
      }
      const doc = document as DocumentWithViewTransition;
      if (typeof doc.startViewTransition === "function") {
        doc.startViewTransition(commit);
      } else {
        commit();
      }
    };

    applyColumns();
    window.addEventListener("resize", applyColumns, { passive: true });
    return () => window.removeEventListener("resize", applyColumns);
  }, []);

  return cols;
}

function cellViewTransitionStyle(name: string): CSSProperties {
  return { viewTransitionName: name } as CSSProperties;
}

function FarmPrinterCell({
  printer,
  gridEditMode,
  isFlyingOut,
  onFlyOutAnimationDone,
  outerStyle,
}: {
  printer: SavedPrinter;
  gridEditMode: boolean;
  isFlyingOut: boolean;
  onFlyOutAnimationDone: () => void;
  outerStyle: CSSProperties;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex h-full min-h-0" style={outerStyle}>
      <motion.div
        animate={
          isFlyingOut && !reduceMotion
            ? {
                opacity: 0,
                scale: 0.66,
                y: 64,
                z: -260,
                rotateX: 18,
              }
            : {
                opacity: 1,
                scale: 1,
                y: 0,
                z: 0,
                rotateX: 0,
              }
        }
        className={clsx(
          "relative flex h-full min-h-0 w-full",
          isFlyingOut && "pointer-events-none z-30",
        )}
        initial={false}
        onAnimationComplete={() => {
          if (isFlyingOut && !reduceMotion) {
            onFlyOutAnimationDone();
          }
        }}
        style={{
          transformOrigin: "50% 36%",
          transformStyle: "preserve-3d",
        }}
        transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
      >
        <PrinterCard className="w-full min-w-0" editMode={gridEditMode} printer={printer} />
      </motion.div>
    </div>
  );
}

export function PrinterList() {
  const printers = usePrinterStore((s) => s.printers);
  const gridEditMode = usePrinterStore((s) => s.gridEditMode);
  const removalExitIds = usePrinterStore((s) => s.removalExitIds);
  const completeRemovalExit = usePrinterStore((s) => s.completeRemovalExit);
  const columnCount = useFarmGridColumnCount();
  const reduceMotion = useReducedMotion();

  const exitBatchRef = useRef<{ ids: Set<string> } | null>(null);
  const doneFlyRef = useRef(new Set<string>());

  useEffect(() => {
    if (removalExitIds.length > 0) {
      exitBatchRef.current = { ids: new Set(removalExitIds) };
    } else {
      exitBatchRef.current = null;
      doneFlyRef.current.clear();
    }
  }, [removalExitIds]);

  useEffect(() => {
    if (!reduceMotion || removalExitIds.length === 0) {
      return;
    }
    completeRemovalExit();
  }, [reduceMotion, removalExitIds, completeRemovalExit]);

  const handleFlyOutDone = useCallback(
    (id: string) => {
      const batch = exitBatchRef.current;
      if (!batch || !batch.ids.has(id) || doneFlyRef.current.has(id)) {
        return;
      }
      doneFlyRef.current.add(id);
      if (doneFlyRef.current.size >= batch.ids.size) {
        completeRemovalExit();
        doneFlyRef.current.clear();
      }
    },
    [completeRemovalExit],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-3">
      <motion.div className="min-h-0 flex-1 overflow-y-auto" layoutScroll>
        <motion.div
          animate={{ opacity: 1 }}
          className="grid gap-2"
          initial={{ opacity: 0 }}
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            perspective: "1100px",
          }}
          transition={{ duration: 0.25 }}
        >
          {printers.map((p) => {
            const isFlyingOut = removalExitIds.includes(p.id);
            const outer: CSSProperties = {
              ...cellViewTransitionStyle(`farm-printer-${p.id}`),
              perspective: "1000px",
            };
            return (
              <FarmPrinterCell
                gridEditMode={gridEditMode}
                isFlyingOut={isFlyingOut}
                key={p.id}
                onFlyOutAnimationDone={() => handleFlyOutDone(p.id)}
                outerStyle={outer}
                printer={p}
              />
            );
          })}
          {gridEditMode ? (
            <div
              className="flex h-full min-h-0"
              style={cellViewTransitionStyle("farm-add-printer")}
            >
              <AddPrinterTile />
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </div>
  );
}
