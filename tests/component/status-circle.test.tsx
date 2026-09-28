import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import StatusCircle from "~/components/status-circle";

describe("StatusCircle", () => {
  test("renders online state", () => {
    render(<StatusCircle isOnline={true} />);
    const svg = screen.getByRole("img");
    expect(svg).toBeInTheDocument();
    expect(svg.querySelector("title")).toHaveTextContent("Online");
  });

  test("renders offline state", () => {
    render(<StatusCircle isOnline={false} />);
    const svg = screen.getByRole("img");
    expect(svg).toBeInTheDocument();
    expect(svg.querySelector("title")).toHaveTextContent("Offline");
  });

  test("applies custom className", () => {
    render(<StatusCircle isOnline={true} className="custom-class" />);
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("class")).toContain("custom-class");
  });
});