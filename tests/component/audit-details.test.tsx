import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, test } from "vitest";

import { AuditLogContent } from "~/routes/audit/overview";

function renderAuditLog() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <AuditLogContent
            loaderData={{
              action: null,
              actorName: null,
              page: 1,
              records: [
                {
                  action: "machine.rename",
                  actorId: "user-1",
                  actorName: "Administrator",
                  createdAt: new Date("2026-10-08T12:00:00.000Z"),
                  details: { newName: "edge-1", previousName: "edge" },
                  id: "audit-1",
                  resourceId: "machine-1",
                  resourceType: "machine",
                },
              ],
              total: 1,
            }}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("AuditLogPage", () => {
  test("opens the selected entry's details from the Actions column", async () => {
    const user = userEvent.setup();
    renderAuditLog();

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByText(/newName/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View details" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Audit entry details" })).toBeVisible();
    expect(within(dialog).getByText("Machine renamed")).toBeVisible();
    expect(within(dialog).getByText("machine: machine-1")).toBeVisible();
    expect(
      within(dialog).getByText(
        (content, element) => element?.tagName === "PRE" && content.includes('"newName": "edge-1"'),
      ),
    ).toBeVisible();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("heading", { name: "Audit entry details" })).not.toBeInTheDocument();
  });
});
