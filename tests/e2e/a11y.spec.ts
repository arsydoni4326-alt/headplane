import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

const ROUTES = [
  { path: "/admin/machines", name: "machines" },
  { path: "/admin/acls", name: "acls" },
  { path: "/admin/dns", name: "dns" },
  { path: "/admin/users", name: "users" },
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
});
