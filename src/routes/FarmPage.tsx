import { useEffect } from "react";
import { PrinterDiscovery } from "../components/PrinterDiscovery";
import { PrinterList } from "../components/PrinterList";
import { usePrinterStore } from "../store/printerStore";

export function FarmPage() {
  const printers = usePrinterStore((s) => s.printers);
  const setGridEditMode = usePrinterStore((s) => s.setGridEditMode);

  useEffect(() => {
    if (printers.length === 0) {
      setGridEditMode(false);
    }
  }, [printers.length, setGridEditMode]);

  if (printers.length === 0) {
    return <PrinterDiscovery />;
  }
  return <PrinterList />;
}
