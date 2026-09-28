import { expect, test } from "./fixtures";

test.describe("login", () => {
  test("shows an error for an invalid API key", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByPlaceholder("API Key").fill("invalid-api-key");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/API key is invalid/i)).toBeVisible();
  });

  test("redirects to machines with a valid API key", async ({ page, apiKey }) => {
    await page.goto("/admin/login");
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);
  });
});
