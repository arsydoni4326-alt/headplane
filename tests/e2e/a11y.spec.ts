import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

const ROUTES = [
  { path: "/admin/machines", name: "machines" },
  { path: "/admin/acls", name: "acls" },
  { path: "/admin/dns", name: "dns" },
  { path: "/admin/users", name: "users" },
  { path: "/admin/settings", name: "settings" },
  { path: "/admin/audit", name: "audit" },
];

test.describe("accessibility", () => {
  for (const route of ROUTES) {
    test(`${route.name} page has no critical or serious violations`, async ({ authedPage }) => {
      await authedPage.goto(route.path);

      const results = await new AxeBuilder({ page: authedPage }).analyze();

      const blocking = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );

      expect(
        blocking,
        blocking
          .map((v) => `${v.id}: ${v.help} (${v.impact}) — ${v.nodes.length} node(s)`)
          .join("\n"),
      ).toEqual([]);
    });
  }

  test("empty state components are accessible", async ({ authedPage }) => {
    // Test empty states by navigating to routes that might show them
    // The machines page with no machines should show an empty state
    await authedPage.goto("/admin/machines");

    const results = await new AxeBuilder({ page: authedPage }).analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    expect(
      blocking,
      blocking
        .map((v) => `${v.id}: ${v.help} (${v.impact}) — ${v.nodes.length} node(s)`)
        .join("\n"),
    ).toEqual([]);
  });

  test("loading states are accessible", async ({ authedPage }) => {
    // Loading states should have proper ARIA attributes
    await authedPage.goto("/admin/machines");

    // Check for any loading indicators with role="status"
    const loadingIndicators = authedPage.locator('[role="status"]');

    // If loading indicators are present, verify they have aria-live
    const count = await loadingIndicators.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const indicator = loadingIndicators.nth(i);
        await expect(indicator).toHaveAttribute("aria-live");
      }
    }
  });

  test("icon-only buttons have accessible names", async ({ authedPage }) => {
    await authedPage.goto("/admin/machines");

    // Find all buttons
    const buttons = authedPage.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const textContent = await button.textContent();

      // If button has no text content, it should have aria-label
      if (!textContent || textContent.trim() === "") {
        const ariaLabel = await button.getAttribute("aria-label");
        const ariaLabelledBy = await button.getAttribute("aria-labelledby");
        const srOnly = await button.locator(".sr-only").count();

        expect(
          ariaLabel || ariaLabelledBy || srOnly > 0,
          `Button at index ${i} has no text and no accessible name`,
        ).toBeTruthy();
      }
    }
  });
});
