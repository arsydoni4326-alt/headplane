import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoadingSpinner from "~/components/loading-spinner";

describe("LoadingSpinner", () => {
  it("renders with default props", () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-label", "Loading");
  });

  it("renders with custom label", () => {
    render(<LoadingSpinner label="Loading machines..." />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading machines...");
    expect(screen.getByText("Loading machines...")).toBeInTheDocument();
  });

  it("applies size variants correctly", () => {
    const { rerender, container } = render(<LoadingSpinner size="sm" />);
    expect(container.querySelector(".h-4")).toBeInTheDocument();

    rerender(<LoadingSpinner size="md" />);
    expect(container.querySelector(".h-8")).toBeInTheDocument();

    rerender(<LoadingSpinner size="lg" />);
    expect(container.querySelector(".h-12")).toBeInTheDocument();
  });

  it("has aria-live=polite for screen readers", () => {
    render(<LoadingSpinner label="Loading data" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("icon is hidden from screen readers", () => {
    const { container } = render(<LoadingSpinner />);
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
