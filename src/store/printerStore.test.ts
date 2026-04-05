import { beforeEach, describe, expect, it } from "vitest";
import { usePrinterStore } from "./printerStore";

describe("printerStore", () => {
  beforeEach(() => {
    localStorage.removeItem("my3dfarm-printers");
    usePrinterStore.setState({
      printers: [],
      newFromDiscoveryIds: [],
      pendingRemovalIds: [],
      removalExitIds: [],
      discoveryOpen: false,
      gridEditMode: false,
    });
  });

  it("addPrinters appends with ids and closes discovery", () => {
    usePrinterStore.getState().setDiscoveryOpen(true);
    usePrinterStore.getState().addPrinters([
      { baseUrl: "http://192.0.2.1:7125", displayName: "A" },
    ]);
    const { printers, discoveryOpen } = usePrinterStore.getState();
    expect(discoveryOpen).toBe(false);
    expect(printers).toHaveLength(1);
    expect(printers[0].baseUrl).toBe("http://192.0.2.1:7125");
    expect(printers[0].displayName).toBe("A");
    expect(printers[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("removePrinter filters by id", () => {
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://a", displayName: "A" }]);
    const id = usePrinterStore.getState().printers[0].id;
    usePrinterStore.getState().removePrinter(id);
    expect(usePrinterStore.getState().printers).toHaveLength(0);
  });

  it("updatePrinter patches fields", () => {
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://a", displayName: "A" }]);
    const id = usePrinterStore.getState().printers[0].id;
    usePrinterStore.getState().updatePrinter(id, { displayName: "B", apiKey: "secret" });
    const p = usePrinterStore.getState().printers[0];
    expect(p.displayName).toBe("B");
    expect(p.apiKey).toBe("secret");
  });

  it("addPrinters appends newFromDiscoveryIds only in grid edit mode", () => {
    usePrinterStore.getState().setGridEditMode(true);
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.10:7125", displayName: "N" }]);
    const id = usePrinterStore.getState().printers[0].id;
    expect(usePrinterStore.getState().newFromDiscoveryIds).toContain(id);
    usePrinterStore.getState().setGridEditMode(false);
    expect(usePrinterStore.getState().newFromDiscoveryIds).toHaveLength(0);
    expect(usePrinterStore.getState().printers).toHaveLength(0);
  });

  it("confirmDiscoveryPrinter then Done keeps printer in farm", () => {
    usePrinterStore.getState().setGridEditMode(true);
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.10:7125", displayName: "N" }]);
    const id = usePrinterStore.getState().printers[0].id;
    usePrinterStore.getState().confirmDiscoveryPrinter(id);
    expect(usePrinterStore.getState().newFromDiscoveryIds).toHaveLength(0);
    usePrinterStore.getState().setGridEditMode(false);
    expect(usePrinterStore.getState().printers).toHaveLength(1);
    expect(usePrinterStore.getState().printers[0].id).toBe(id);
  });

  it("Done removes only unconfirmed discovery printers", () => {
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.1:7125", displayName: "Old" }]);
    const oldId = usePrinterStore.getState().printers[0].id;
    usePrinterStore.getState().setGridEditMode(true);
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.10:7125", displayName: "New" }]);
    expect(usePrinterStore.getState().printers).toHaveLength(2);
    usePrinterStore.getState().setGridEditMode(false);
    expect(usePrinterStore.getState().printers).toHaveLength(1);
    expect(usePrinterStore.getState().printers[0].id).toBe(oldId);
  });

  it("togglePendingRemoval then Done stages fly-out then completeRemovalExit removes printer", () => {
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.1:7125", displayName: "A" }]);
    const id = usePrinterStore.getState().printers[0].id;
    usePrinterStore.getState().setGridEditMode(true);
    usePrinterStore.getState().togglePendingRemoval(id);
    expect(usePrinterStore.getState().pendingRemovalIds).toContain(id);
    usePrinterStore.getState().setGridEditMode(false);
    expect(usePrinterStore.getState().printers).toHaveLength(1);
    expect(usePrinterStore.getState().removalExitIds).toContain(id);
    expect(usePrinterStore.getState().pendingRemovalIds).toHaveLength(0);
    usePrinterStore.getState().completeRemovalExit();
    expect(usePrinterStore.getState().printers).toHaveLength(0);
    expect(usePrinterStore.getState().removalExitIds).toHaveLength(0);
  });

  it("togglePendingRemoval twice then Done keeps printer", () => {
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.1:7125", displayName: "A" }]);
    const id = usePrinterStore.getState().printers[0].id;
    usePrinterStore.getState().setGridEditMode(true);
    usePrinterStore.getState().togglePendingRemoval(id);
    usePrinterStore.getState().togglePendingRemoval(id);
    usePrinterStore.getState().setGridEditMode(false);
    expect(usePrinterStore.getState().printers).toHaveLength(1);
    expect(usePrinterStore.getState().printers[0].id).toBe(id);
  });

  it("addPrinters keeps printers sorted by IPv4 ascending", () => {
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.10:7125", displayName: "High" }]);
    usePrinterStore.getState().addPrinters([{ baseUrl: "http://192.0.2.2:7125", displayName: "Low" }]);
    const bases = usePrinterStore.getState().printers.map((p) => p.baseUrl);
    expect(bases[0]).toContain("192.0.2.2");
    expect(bases[1]).toContain("192.0.2.10");
  });

  it("addPrinters skips duplicate baseUrl (normalized)", () => {
    usePrinterStore.getState().addPrinters([
      { baseUrl: "http://192.0.2.1:7125", displayName: "A" },
    ]);
    usePrinterStore.getState().addPrinters([
      { baseUrl: "http://192.0.2.1:7125///", displayName: "B" },
    ]);
    expect(usePrinterStore.getState().printers).toHaveLength(1);
    expect(usePrinterStore.getState().printers[0].displayName).toBe("A");
  });
});
