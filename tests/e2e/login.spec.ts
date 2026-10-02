import { expect, test } from "./fixtures";

test.describe("login", () => {
  test("shows an error for an invalid API key", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill("invalid-api-key");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/API key is invalid/i)).toBeVisible();
  });

  test("redirects to machines with a valid API key", async ({ page, apiKey }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);
  });

  test("shows password login by default", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByPlaceholder("API Key")).not.toBeVisible();
  });

  test("toggles between password and API key login", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Password is default
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    
    // Switch to API Key
    await page.getByRole("button", { name: "API Key" }).click();
    await expect(page.getByPlaceholder("API Key")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).not.toBeVisible();
    
    // Switch back to Password
    await page.getByRole("button", { name: "Password" }).click();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByPlaceholder("API Key")).not.toBeVisible();
  });

  test("shows/hides password when toggle is clicked", async ({ page }) => {
    await page.goto("/admin/login");
    const passwordInput = page.getByPlaceholder("Password");
    
    // Initially hidden
    await expect(passwordInput).toHaveAttribute("type", "password");
    
    // Click show
    await page.getByRole("button", { name: "Show" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    
    // Click hide
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
