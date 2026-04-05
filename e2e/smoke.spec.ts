import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("my3dfarm-printers");
    localStorage.setItem("my3dfarm-locale", "ru");
  });
});

test("первый экран — поиск принтеров", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Найдите принтеры" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Искать" })).toBeVisible();
});

test("шестерёнка открывает настройки", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Настройки" }),
  ).toBeVisible();
  await expect(page.getByLabel("Язык")).toBeVisible();
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
