import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import Chip from "~/components/chip";

describe("Chip", () => {
  test("renders text", () => {
    render(<Chip text="hello" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  test("renders with left icon", () => {
    render(<Chip text="with icon" leftIcon={<span data-testid="left-icon" />} />);
    expect(screen.getByText("with icon")).toBeInTheDocument();
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  test("renders with right icon", () => {
    render(<Chip text="right icon" rightIcon={<span data-testid="right-icon" />} />);
    expect(screen.getByText("right icon")).toBeInTheDocument();
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    render(<Chip text="styled" className="custom-class" />);
    expect(screen.getByText("styled").className).toContain("custom-class");
  });
});