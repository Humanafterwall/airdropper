import { test, expect } from "@playwright/test";

test("faq and fairness pages load", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/faq");
  await expect(page).toHaveURL(/\/faq$/);

  await page.goto("/fairness");
  await expect(page).toHaveURL(/\/fairness$/);
  await expect(page.getByRole("heading", { name: "Fairness" })).toBeVisible();
});

test("docs and security pages load", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();

  await page.goto("/security");
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
});

test("custom 404 is shown", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/ovo-ne-postoji");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
test("header nav clicks work (desktop)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await page.getByTestId("nav-docs").click();
  await expect(page).toHaveURL(/\/docs$/);

  await page.getByTestId("nav-security").click();
  await expect(page).toHaveURL(/\/security$/);

  await page.getByTestId("nav-faq").click();
  await expect(page).toHaveURL(/\/faq$/);
});
