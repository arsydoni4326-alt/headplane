import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import Select from "~/components/select";

describe("Select", () => {
  test("renders a controlled selection from its items", () => {
    render(
      <Select
        aria-label="Role"
        items={[
          { value: "member", label: "Member" },
          { value: "admin", label: "Admin" },
        ]}
        value="member"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("Member");
  });

  test("reports the selected item value", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Select
        aria-label="Role"
        items={[
          { value: "member", label: "Member" },
          { value: "admin", label: "Admin" },
        ]}
        onValueChange={onValueChange}
        value="member"
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Admin"));

    expect(onValueChange).toHaveBeenCalledWith("admin");
  });
});
