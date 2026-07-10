import { expect, test } from "@playwright/test";

test("app responds with 200 on root path", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});
