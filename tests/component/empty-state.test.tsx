import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import EmptyState from "~/components/empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No machines yet"
        description="Connect your first device to get started."
      />,
    );

    expect(screen.getByText("No machines yet")).toBeInTheDocument();
    expect(screen.getByText("Connect your first device to get started.")).toBeInTheDocument();
  });

  it("renders with primary action", async () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No users"
        description="Create your first user to begin."
        action={{ label: "Create User", onClick: handleClick }}
      />,
    );

    const button = screen.getByRole("button", { name: "Create User" });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders with primary and secondary actions", () => {
    const handlePrimary = vi.fn();
    const handleSecondary = vi.fn();

    render(
      <EmptyState
        title="No data"
        description="Get started by importing data."
        action={{ label: "Import", onClick: handlePrimary }}
        secondaryAction={{ label: "Learn More", onClick: handleSecondary }}
      />,
    );

    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn More" })).toBeInTheDocument();
  });

  it("renders default variant with inbox icon", () => {
    const { container } = render(
      <EmptyState title="Empty" description="No items here." variant="default" />,
    );

    // Inbox icon should be present (aria-hidden)
    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it("renders error variant with alert icon", () => {
    const { container } = render(
      <EmptyState title="Error" description="Something went wrong." variant="error" />,
    );

    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer).toHaveClass("text-red-600");
  });

  it("renders filtered variant", () => {
    render(
      <EmptyState
        title="No results"
        description="No items match your current filters."
        variant="filtered"
      />,
    );

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("No items match your current filters.")).toBeInTheDocument();
  });

  it("icon is hidden from screen readers", () => {
    const { container } = render(<EmptyState title="Test" description="Test description" />);

    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it("action buttons inherit variant prop", () => {
    render(
      <EmptyState
        title="Test"
        description="Test"
        action={{ label: "Primary", variant: "danger" }}
      />,
    );

    // The button should have the danger variant classes
    const button = screen.getByRole("button", { name: "Primary" });
    expect(button).toHaveClass("bg-red-600");
  });
});
