import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductStatusChip } from "#src/catalog/status-chip.js";

describe("ProductStatusChip", () => {
  it("Given a product on the menu, When rendered, Then it says it is on the menu", () => {
    render(<ProductStatusChip status="on-menu" />);

    expect(screen.getByText("En carta")).toBeTruthy();
  });

  it("Given a venue-only product, When rendered, Then it names that venue", () => {
    render(<ProductStatusChip status="venue-only" venueName="Usaquén" />);

    expect(screen.getByText("Solo Usaquén")).toBeTruthy();
  });
});
