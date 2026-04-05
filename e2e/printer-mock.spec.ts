import { expect, test } from "@playwright/test";
import {
  installMoonrakerPlaywrightMock,
  MOCK_MOONRAKER_ORIGIN,
  persistedPrinterState,
} from "./helpers/moonrakerPlaywright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("my3dfarm-locale", "ru");
  });
});

test("список принтеров: карточка с моком Moonraker (ready)", async ({ page }) => {
  await installMoonrakerPlaywrightMock(page, "ready");
  await page.addInitScript((payload) => {
    localStorage.setItem("my3dfarm-printers", payload);
  }, persistedPrinterState([{ id: "e2e-mock-1", baseUrl: MOCK_MOONRAKER_ORIGIN, displayName: "Mock Pi" }]));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My3DFarm" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "mock-printer-e2e" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/v0\.9\.3-12-gmock/)).toBeVisible();
  await expect(page.getByText("Готов")).toBeVisible();
});

test("карточка: состояние печати по моку", async ({ page }) => {
  await installMoonrakerPlaywrightMock(page, "printing");
  await page.addInitScript((payload) => {
    localStorage.setItem("my3dfarm-printers", payload);
  }, persistedPrinterState([{ id: "e2e-mock-2", baseUrl: MOCK_MOONRAKER_ORIGIN, displayName: "P" }]));

  await page.goto("/");
  await expect(page.getByText(/benchy\.gcode/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^Печать$/)).toBeVisible();
});

test("кнопка «Изменить» открывает режим редактирования и тайл добавления", async ({ page }) => {
  await page.addInitScript((payload) => {
    localStorage.setItem("my3dfarm-printers", payload);
  }, persistedPrinterState([{ id: "e2e-mock-3", baseUrl: MOCK_MOONRAKER_ORIGIN, displayName: "X" }]));

  await page.goto("/");
  await page.getByRole("button", { name: "Изменить" }).click();
  await expect(page.getByText("Добавить принтер").first()).toBeVisible();
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByRole("heading", { name: "My3DFarm" })).toBeVisible();
});
