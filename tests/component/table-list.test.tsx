import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import TableList from "~/components/table-list";

describe("TableList", () => {
  test("renders items", () => {
    render(
      <TableList>
        <TableList.Item>Item 1</TableList.Item>
        <TableList.Item>Item 2</TableList.Item>
      </TableList>,
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  test("renders empty list", () => {
    render(<TableList data-testid="table-list" />);
    expect(screen.getByTestId("table-list")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    render(
      <TableList className="custom-class">
        <TableList.Item className="item-class">Item</TableList.Item>
      </TableList>,
    );
    const item = screen.getByText("Item");
    expect(item.className).toContain("item-class");
  });
});