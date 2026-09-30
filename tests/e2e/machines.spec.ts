import { expect, test } from "./fixtures";

test.describe("machines", () => {
  test("loads the machines page with the machine table", async ({ authedPage }) => {
    await expect(authedPage.getByRole("heading", { name: "Machines" })).toBeVisible();
    await expect(authedPage.getByPlaceholder("Search by name or IP address...")).toBeVisible();
    // A fresh Headscale has no machines.
    await expect(authedPage.getByText("0 machines")).toBeVisible();
  });

  test("search input filters the machine list", async ({ authedPage }) => {
    const search = authedPage.getByPlaceholder("Search by name or IP address...");
    await search.fill("nonexistent-machine");
    await expect(authedPage.getByText(/Showing 0 of 0 machines/)).toBeVisible();
    await expect(authedPage.getByText("No machines match the current filters")).toBeVisible();
  });
});
