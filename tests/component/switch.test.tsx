import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import Switch from "~/components/switch";

describe("Switch", () => {
  test("renders with label", () => {
    render(<Switch label="Enable feature" />);
    const switchEl = screen.getByRole("switch", { name: "Enable feature" });
    expect(switchEl).toBeInTheDocument();
  });

  test("renders checked state", () => {
    render(<Switch label="Toggle" checked />);
    const switchEl = screen.getByRole("switch", { name: "Toggle" });
    expect(switchEl).toBeChecked();
  });

  test("renders unchecked state", () => {
    render(<Switch label="Toggle" checked={false} />);
    const switchEl = screen.getByRole("switch", { name: "Toggle" });
    expect(switchEl).not.toBeChecked();
  });

  test("calls onCheckedChange when toggled", async () => {
    const handleChange = vi.fn();
    render(<Switch label="Toggle" onCheckedChange={handleChange} />);

    await userEvent.click(screen.getByRole("switch", { name: "Toggle" }));
    // onCheckedChange receives (checked, event); check only the first arg
    expect(handleChange.mock.calls[0][0]).toBe(true);
  });

  test("disabled switch does not fire onCheckedChange", async () => {
    const handleChange = vi.fn();
    render(<Switch label="Toggle" disabled onCheckedChange={handleChange} />);

    const switchEl = screen.getByRole("switch", { name: "Toggle" });
    // @base-ui/react/switch uses aria-disabled instead of the disabled attribute
    expect(switchEl).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(switchEl);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
