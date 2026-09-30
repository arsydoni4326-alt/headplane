import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import TokenList from "~/components/token-list";

// Helper: find the "add" button — it's a button containing a Plus SVG icon.
function findAddBtn(container: HTMLElement): HTMLElement | null {
  const btns = container.querySelectorAll("button");
  for (const btn of btns) {
    if (btn.querySelector("svg.lucide-plus")) {
      return btn as HTMLElement;
    }
  }
  return null;
}

// Helper: find remove buttons — buttons containing an X SVG icon.
function findRemoveBtns(container: HTMLElement): HTMLElement[] {
  const btns = container.querySelectorAll("button");
  return Array.from(btns).filter((btn) => btn.querySelector("svg.lucide-x"));
}

describe("TokenList", () => {
  test("renders with values", () => {
    render(
      <TokenList
        label="Tags"
        values={["tag:web", "tag:db"]}
        onChange={() => {}}
        emptyText="No tags"
      />,
    );
    expect(screen.getByText("tag:web")).toBeInTheDocument();
    expect(screen.getByText("tag:db")).toBeInTheDocument();
    expect(screen.queryByText("No tags")).not.toBeInTheDocument();
  });

  test("renders empty state", () => {
    render(<TokenList label="Tags" values={[]} onChange={() => {}} emptyText="No tags" />);
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });

  test("renders label and description", () => {
    render(
      <TokenList
        label="Tags"
        description="Add some tags"
        values={[]}
        onChange={() => {}}
        emptyText="No tags"
      />,
    );
    const labelElements = screen.getAllByText("Tags");
    expect(labelElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Add some tags")).toBeInTheDocument();
  });

  test("adds a value via input and button", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenList
        label="Tags"
        values={[]}
        onChange={onChange}
        emptyText="No tags"
        placeholder="Add a tag"
      />,
    );
    const input = screen.getByPlaceholderText("Add a tag");
    await userEvent.type(input, "tag:web");
    const addBtn = findAddBtn(container);
    expect(addBtn).not.toBeNull();
    await userEvent.click(addBtn!);
    expect(onChange).toHaveBeenCalledWith(["tag:web"]);
  });

  test("adds a value via Enter key", async () => {
    const onChange = vi.fn();
    render(
      <TokenList
        label="Tags"
        values={[]}
        onChange={onChange}
        emptyText="No tags"
        placeholder="Add a tag"
      />,
    );
    const input = screen.getByPlaceholderText("Add a tag");
    await userEvent.type(input, "tag:web{Enter}");
    expect(onChange).toHaveBeenCalledWith(["tag:web"]);
  });

  test("removes a value", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenList label="Tags" values={["tag:web"]} onChange={onChange} emptyText="No tags" />,
    );
    const removeBtns = findRemoveBtns(container);
    expect(removeBtns.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(removeBtns[0]);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test("does not add duplicate values", async () => {
    const onChange = vi.fn();
    render(
      <TokenList
        label="Tags"
        values={["tag:web"]}
        onChange={onChange}
        emptyText="No tags"
        placeholder="Add a tag"
      />,
    );
    const input = screen.getByPlaceholderText("Add a tag");
    await userEvent.type(input, "tag:web{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("does not add empty values", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenList label="Tags" values={[]} onChange={onChange} emptyText="No tags" />,
    );
    const addBtn = findAddBtn(container);
    expect(addBtn).not.toBeNull();
    expect(addBtn).toBeDisabled();
  });

  test("shows suggestions", () => {
    render(
      <TokenList
        label="Tags"
        values={["tag:web"]}
        onChange={() => {}}
        emptyText="No tags"
        suggestions={["tag:db", "tag:web"]}
      />,
    );
    expect(screen.getByText("tag:db")).toBeInTheDocument();
    const tagWebElements = screen.getAllByText("tag:web");
    expect(tagWebElements.length).toBe(1);
  });

  test("clicking suggestion adds the value", async () => {
    const onChange = vi.fn();
    render(
      <TokenList
        label="Tags"
        values={[]}
        onChange={onChange}
        emptyText="No tags"
        suggestions={["tag:db"]}
      />,
    );
    await userEvent.click(screen.getByText("tag:db"));
    expect(onChange).toHaveBeenCalledWith(["tag:db"]);
  });

  test("validates input via validate function", async () => {
    const onChange = vi.fn();
    render(
      <TokenList
        label="Tags"
        values={[]}
        onChange={onChange}
        emptyText="No tags"
        placeholder="Add a tag"
        validate={(v) => v.startsWith("tag:")}
      />,
    );
    const input = screen.getByPlaceholderText("Add a tag");
    await userEvent.type(input, "invalid{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("normalizes input via normalize function", async () => {
    const onChange = vi.fn();
    render(
      <TokenList
        label="Tags"
        values={[]}
        onChange={onChange}
        emptyText="No tags"
        placeholder="Add a tag"
        normalize={(v) => v.toLowerCase()}
      />,
    );
    const input = screen.getByPlaceholderText("Add a tag");
    await userEvent.type(input, "TAG:Web{Enter}");
    expect(onChange).toHaveBeenCalledWith(["tag:web"]);
  });

  test("disabled state prevents interaction", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenList
        label="Tags"
        values={["tag:web"]}
        onChange={onChange}
        emptyText="No tags"
        isDisabled
      />,
    );
    const allButtons = container.querySelectorAll("button");
    expect(allButtons.length).toBeGreaterThan(0);
    allButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
