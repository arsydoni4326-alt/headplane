import { expect, test } from "./fixtures";

test.describe("Admin Password Reset", () => {
  test("resets password and invalidates sessions", async ({ page }) => {
    // Setup: Create a temporary config with a known password
    // Note: This test assumes we're in single-admin mode with password login enabled

    // Login with initial credentials (from e2e config)
    await page.goto("/admin/login");
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill("admin-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");
    await expect(page.getByText("Administration")).toBeVisible();

    // Verify single-admin notice is shown
    await expect(page.getByText(/Single Local Administrator Mode/i)).toBeVisible();

    // Fill password reset form
    await page.fill("#current_password", "admin-password");
    await page.fill("#new_password", "new-password-123");
    await page.fill("#confirm_password", "new-password-123");

    // Submit the form
    await page.getByRole("button", { name: "Reset Password" }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Old password should fail
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill("admin-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();

    // New password should work
    await page.getByPlaceholder("Password").fill("new-password-123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);
  });

  test("validates current password", async ({ page }) => {
    // Login first
    await page.goto("/admin/login");
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill("admin-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Try to reset with incorrect current password
    await page.fill("#current_password", "wrong-password");
    await page.fill("#new_password", "new-password-123");
    await page.fill("#confirm_password", "new-password-123");
    await page.getByRole("button", { name: "Reset Password" }).click();

    // Should show error
    await expect(page.getByText(/current password is incorrect/i)).toBeVisible();

    // Should still be on admin page (not redirected)
    await expect(page).toHaveURL(/\/admin/);
  });

  test("validates password confirmation matching", async ({ page }) => {
    // Login first
    await page.goto("/admin/login");
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill("admin-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Try to reset with mismatched passwords
    await page.fill("#current_password", "admin-password");
    await page.fill("#new_password", "new-password-123");
    await page.fill("#confirm_password", "different-password");
    await page.getByRole("button", { name: "Reset Password" }).click();

    // Should show error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("enforces minimum password length", async ({ page }) => {
    // Login first
    await page.goto("/admin/login");
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill("admin-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Try to reset with short password
    await page.fill("#current_password", "admin-password");
    await page.fill("#new_password", "short");
    await page.fill("#confirm_password", "short");
    await page.getByRole("button", { name: "Reset Password" }).click();

    // Should show error
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("requires all fields", async ({ page }) => {
    // Login first
    await page.goto("/admin/login");
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill("admin-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);

    // Navigate to admin page
    await page.goto("/admin");

    // Try to submit with missing fields
    await page.fill("#current_password", "admin-password");
    // Leave new password fields empty
    await page.getByRole("button", { name: "Reset Password" }).click();

    // Should show validation error
    await expect(page.getByText(/all fields are required/i)).toBeVisible();
  });

  test("shows immutable config guidance when config is read-only", async () => {
    // This test would require mocking a read-only config scenario
    // For now, we document the expected behavior:
    // - When config file is read-only (e.g., mounted ConfigMap)
    // - Password reset form should show a notice
    // - Notice should mention using CLI tool for password reset
    // - Form submission should be disabled or show error

    // TODO: Implement this test when we have a way to simulate read-only config
    test.skip();
  });
});
