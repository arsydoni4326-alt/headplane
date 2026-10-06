import { expect, test } from "./fixtures";

test.describe("Admin API Keys", () => {
  test("displays list of API keys with metadata", async ({ page, apiKey }) => {
    // Login with API key
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Wait for API keys section to load
    await expect(page.getByText("API Keys")).toBeVisible();

    // Should show at least one API key (the one we're using)
    const apiKeyTable = page.locator("table").filter({ has: page.getByText(/prefix/i) });
    await expect(apiKeyTable).toBeVisible();

    // Check that metadata columns are present
    await expect(page.getByText(/prefix/i)).toBeVisible();
    await expect(page.getByText(/created/i)).toBeVisible();
    await expect(page.getByText(/expiration/i)).toBeVisible();
  });

  test("creates new API key with custom expiration", async ({ page, apiKey }) => {
    // Login with API key
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Click create API key button
    await page.getByRole("button", { name: /create api key/i }).click();

    // Dialog should be visible
    await expect(page.getByText("Create API Key")).toBeVisible();

    // Set custom expiration (e.g., 30 days)
    await page.fill('input[type="number"]', "30");

    // Submit
    await page.getByRole("button", { name: /create/i }).click();

    // Should show the new API key with copy button
    await expect(page.getByText(/API Key Created/i)).toBeVisible();
    await expect(page.getByText(/Save this key now/i)).toBeVisible();

    // Should have a copy button
    const copyButton = page.getByRole("button", { name: /copy/i });
    await expect(copyButton).toBeVisible();

    // Copy the key
    await copyButton.click();
    await expect(page.getByText(/copied/i)).toBeVisible();
  });

  test("identifies service key with badge", async ({ page, apiKey }) => {
    // Login with API key
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Wait for API keys to load
    await expect(page.getByText("API Keys")).toBeVisible();

    // Should show "Service Key" badge for the configured key
    await expect(page.getByText(/service key/i)).toBeVisible();
  });

  test("protects service key from deletion", async ({ page, apiKey }) => {
    // Login with API key
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Wait for API keys to load
    await expect(page.getByText("API Keys")).toBeVisible();

    // Find delete buttons in the service key row
    const serviceKeyRow = page.locator("tr").filter({ hasText: /service key/i });
    const deleteButton = serviceKeyRow.getByRole("button", { name: /delete/i });

    // Delete button should be disabled for service key
    await expect(deleteButton).toBeDisabled();
  });

  test("deletes non-service key with confirmation", async ({ page, apiKey }) => {
    // Login with API key
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    await page.goto("/admin");

    // Create a new API key first
    await page.getByRole("button", { name: /create api key/i }).click();
    await page.getByRole("button", { name: /create/i }).click();

    // Get the key prefix from the display
    const keyInput = page.locator('input[readonly][value*="key_"]');
    const newKey = await keyInput.inputValue();
    const prefix = newKey.substring(0, 8);

    // Close the success dialog
    await page.keyboard.press("Escape");

    // Find and delete the new key
    const newKeyRow = page.locator("tr").filter({ hasText: prefix });
    await newKeyRow.getByRole("button", { name: /delete/i }).click();

    // Confirmation dialog should appear
    await expect(page.getByText(/Delete API Key/i)).toBeVisible();
    await expect(page.getByText(/cannot be undone/i)).toBeVisible();

    // Confirm deletion
    await page
      .getByRole("button", { name: /delete/i })
      .last()
      .click();

    // Key should be removed from list
    await expect(newKeyRow).not.toBeVisible();
  });

  test("shows one-time secret display with warning", async ({ page, apiKey }) => {
    // Login with API key
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "API Key" }).click();
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    await page.goto("/admin");

    // Create new API key
    await page.getByRole("button", { name: /create api key/i }).click();
    await page.getByRole("button", { name: /create/i }).click();

    // Should show warning about one-time display
    await expect(page.getByText(/Save this key now/i)).toBeVisible();
    await expect(page.getByText(/will not be shown again/i)).toBeVisible();

    // Should show the actual key value
    const keyInput = page.locator('input[readonly][value*="key_"]');
    await expect(keyInput).toBeVisible();
    const keyValue = await keyInput.inputValue();
    expect(keyValue).toMatch(/^key_/);
  });
});
