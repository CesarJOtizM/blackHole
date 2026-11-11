import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeView } from "#src/home/home-view.js";

describe("HomeView", () => {
  it("Given today's board, When rendered, Then Carolina sees the live venues", () => {
    render(<HomeView onOpen={vi.fn()} onExport={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Buen día, Carolina" }),
    ).toBeTruthy();
    expect(screen.getByText("Chapinero")).toBeTruthy();
  });

  it("Given a rejected invoice, When it is opened, Then the screen receives the fiscal path", () => {
    const onOpen = vi.fn();
    render(<HomeView onOpen={onOpen} onExport={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Factura rechazada por la DIAN/ }),
    );

    expect(onOpen).toHaveBeenCalledWith("/fiscal/documents");
  });
});
