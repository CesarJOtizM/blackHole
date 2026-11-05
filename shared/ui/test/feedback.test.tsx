import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, ScreenError, Skeleton } from "#ui/components/feedback.js";

describe("Skeleton", () => {
  it("Given a loading block, When rendered, Then it is hidden from assistive tech", () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("Given a loading block, When rendered, Then reduced motion disables its animation", () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild?.className).toContain(
      "motion-reduce:animate-none",
    );
  });
});

describe("EmptyState", () => {
  it("Given a title and a description, When rendered, Then both are visible text", () => {
    render(
      <EmptyState title="Sin mesas abiertas">
        Abre una mesa para empezar.
      </EmptyState>,
    );

    expect(
      screen.getByRole("heading", { name: "Sin mesas abiertas" }),
    ).toBeTruthy();
    expect(screen.getByText("Abre una mesa para empezar.")).toBeTruthy();
  });
});

describe("ScreenError", () => {
  it("Given an error message, When rendered, Then it is announced as an alert", () => {
    render(
      <ScreenError title="No se pudo cargar" message="Revisa la conexión." />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Revisa la conexión.",
    );
  });

  it("Given a retry handler, When the retry button is pressed, Then the handler runs", () => {
    const onRetry = vi.fn();
    render(
      <ScreenError
        title="No se pudo cargar"
        message="Revisa la conexión."
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("Given no retry handler, When rendered, Then no retry button is offered", () => {
    render(
      <ScreenError title="Sin acceso" message="Pide acceso al encargado." />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
