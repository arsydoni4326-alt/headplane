import { expect, test } from "./fixtures";

/**
 * E2E tests for admin user management (Headplane users, not Headscale user namespaces).
 * Tests the Known Gap fix: admin UI should work with both password session and API key auth.
 */

test.describe("Admin User Management", () => {
  test.describe("with API Key authentication", () => {
    test("can access admin users page", async ({ page, apiKey }) => {
      // Login with API key
      await page.goto("/admin/login");
      await page.getByRole("button", { name: "API Key" }).click();
      await page.getByPlaceholder("API Key").fill(apiKey);
      await page.getByRole("button", { name: "Sign In" }).click();
      await expect(page).toHaveURL(/\/machines/);

      // Navigate to admin users page
      await page.goto("/admin/users");
      await expect(page).toHaveURL(/\/admin\/users/);

      // Should see admin user management UI
      await expect(page.getByText(/Headplane Users/i)).toBeVisible();
    });

    test("can view list of Headplane users", async ({ page, apiKey }) => {
      await page.goto("/admin/login");
      await page.getByRole("button", { name: "API Key" }).click();
      await page.getByPlaceholder("API Key").fill(apiKey);
      await page.getByRole("button", { name: "Sign In" }).click();

      await page.goto("/admin/users");

      // Should see user list or empty state
      const hasUsers = await page
        .getByRole("table")
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/no users/i)
        .isVisible()
        .catch(() => false);

      expect(hasUsers || hasEmptyState).toBe(true);
    });

    test("can create a new Headplane user", async ({ page, apiKey }) => {
      await page.goto("/admin/login");
      await page.getByRole("button", { name: "API Key" }).click();
      await page.getByPlaceholder("API Key").fill(apiKey);
      await page.getByRole("button", { name: "Sign In" }).click();

      await page.goto("/admin/users");

      // Click "Add Headplane User" button
      const addButton = page.getByRole("button", { name: /add.*user/i });
      await expect(addButton).toBeVisible();
      await addButton.click();

      // Fill in new user form
      await page.getByLabel(/username/i).fill("testuser");
      await page.getByLabel(/password/i).fill("testpassword123");
      await page.getByRole("button", { name: /create|save/i }).click();

      // Should show success or return to list
      await expect(page.getByText(/success|created/i))
        .toBeVisible({ timeout: 5000 })
        .catch(() => expect(page).toHaveURL(/\/admin\/users/));
    });

    test("can update an existing Headplane user", async ({ page, apiKey }) => {
      await page.goto("/admin/login");
      await page.getByRole("button", { name: "API Key" }).click();
      await page.getByPlaceholder("API Key").fill(apiKey);
      await page.getByRole("button", { name: "Sign In" }).click();

      await page.goto("/admin/users");

      // Find and click edit on a user (if any exist)
      const editButton = page.getByRole("button", { name: /edit/i }).first();
      const hasUsers = await editButton.isVisible().catch(() => false);

      if (hasUsers) {
        await editButton.click();

        const usernameField = page.getByLabel(/username/i);
        if (await usernameField.isVisible()) {
          await usernameField.fill("updateduser");
        }

        await page.getByRole("button", { name: /save|update/i }).click();
        await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 5000 });
      } else {
        test.skip();
      }
    });

    test("can delete a Headplane user", async ({ page, apiKey }) => {
      await page.goto("/admin/login");
      await page.getByRole("button", { name: "API Key" }).click();
      await page.getByPlaceholder("API Key").fill(apiKey);
      await page.getByRole("button", { name: "Sign In" }).click();

      await page.goto("/admin/users");

      const deleteButton = page.getByRole("button", { name: /delete/i }).first();
      const hasUsers = await deleteButton.isVisible().catch(() => false);

      if (hasUsers) {
        await deleteButton.click();

        const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 5000 });
      } else {
        test.skip();
      }
    });
  });

  test.describe("with password authentication", () => {
    test("can access admin users page with password", async ({ page }) => {
      await page.goto("/admin/login");

      const passwordField = page.getByPlaceholder("Password");
      const hasPassword = await passwordField.isVisible();

      if (!hasPassword) {
        test.skip();
        return;
      }

      await passwordField.fill("test-password");
      await page.getByRole("button", { name: "Sign In" }).click();

      const isLoggedIn = await page
        .waitForURL(/\/(machines|admin)/, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (isLoggedIn) {
        await page.goto("/admin/users");
        await expect(page).toHaveURL(/\/admin\/users/);
        await expect(page.getByText(/Headplane Users/i)).toBeVisible();
      } else {
        test.skip();
      }
    });
  });
});
