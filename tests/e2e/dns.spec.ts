import { expect, test } from "./fixtures";

test.describe("dns", () => {
  test("loads the DNS settings page", async ({ authedPage }) => {
    await authedPage.goto("/admin/dns");
    await expect(authedPage.getByRole("heading", { name: "Magic DNS" })).toBeVisible();
    // The tailnet name from the test Headscale config.
    await expect(authedPage.getByText("example.com").first()).toBeVisible();
  });
});
