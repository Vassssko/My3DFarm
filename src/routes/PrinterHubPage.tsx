import { Navigate, useParams } from "react-router-dom";
import { PrinterOpsHub } from "../components/PrinterOpsHub";
import { usePrinterStore } from "../store/printerStore";

export function PrinterHubPage() {
  const { printerId } = useParams<{ printerId: string }>();
  const printer = usePrinterStore((s) => s.printers.find((p) => p.id === printerId));

  if (!printerId || !printer) {
    return <Navigate replace to="/" />;
  }

  /** Same flex contract as FarmPage; max-width keeps wide windows readable (farm often fullscreen). */
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl min-w-0 flex-1 flex-col">
        <PrinterOpsHub printer={printer} />
      </div>
    </div>
  );
}
