import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { UserAvatar } from "~/layout/header";

describe("UserAvatar", () => {
  test("renders a configured avatar with circular, fixed-size styling", () => {
    render(<UserAvatar name="Administrator" picture="https://example.com/avatar.png" />);

    const avatar = screen.getByRole("img", { name: "Administrator's avatar" });
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(avatar).toHaveClass("size-8", "rounded-full", "object-cover");
  });

  test("layers the configured avatar above the SVG fallback without waiting for a load event", () => {
    const { container } = render(
      <UserAvatar name="Administrator" picture="https://example.com/avatar.png" />,
    );
    const avatar = screen.getByRole("img", { name: "Administrator's avatar" });

    expect(avatar).not.toHaveClass("opacity-0");
    expect(avatar).toHaveClass("z-10");
    expect(container.querySelector("svg")).toHaveClass("absolute", "inset-0", "size-8");
  });

  test("renders the SVG fallback when no avatar is configured", () => {
    const { container } = render(<UserAvatar name="Administrator" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("size-8");
  });

  test("replaces a failed avatar image with the SVG fallback", () => {
    const { container } = render(
      <UserAvatar name="Administrator" picture="https://example.com/missing.png" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Administrator's avatar" }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("size-8");
  });
});
