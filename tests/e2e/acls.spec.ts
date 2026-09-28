import { expect, test } from "./fixtures";

test.describe("acls", () => {
  test("loads the ACL page with the editor tabs", async ({ authedPage }) => {
    await authedPage.goto("/admin/acls");
    await expect(
      authedPage.getByRole("heading", { name: "Access Control List (ACL)" }),
    ).toBeVisible();
    await expect(authedPage.getByRole("tab", { name: "Rules" })).toBeVisible();
    await expect(authedPage.getByRole("tab", { name: "Tags & Groups" })).toBeVisible();
    await expect(authedPage.getByRole("tab", { name: "Edit file" })).toBeVisible();
  });

  test("opens the file editor tab", async ({ authedPage }) => {
    await authedPage.goto("/admin/acls");
    await authedPage.getByRole("tab", { name: "Edit file" }).click();
    // The CodeMirror editor is rendered lazily; wait for it to appear.
    await expect(authedPage.locator(".cm-editor").first()).toBeVisible();
  });
});
