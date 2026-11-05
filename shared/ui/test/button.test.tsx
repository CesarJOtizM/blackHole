import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "#ui/components/button.js";

describe("Button", () => {
  it("Given no type, When rendered, Then it is a button element with type button", () => {
    render(<Button>Cobrar</Button>);

    expect(
      screen.getByRole("button", { name: "Cobrar" }).getAttribute("type"),
    ).toBe("button");
  });

  it("Given a click handler, When pressed, Then the handler is called once", () => {
    const onPress = vi.fn();
    render(<Button onClick={onPress}>Abrir mesa</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Abrir mesa" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("Given the primary variant by default, When rendered, Then it uses the action token", () => {
    render(<Button>Enviar</Button>);

    expect(screen.getByRole("button", { name: "Enviar" }).className).toContain(
      "bg-action",
    );
  });

  it("Given the danger variant, When rendered, Then it uses the danger token", () => {
    render(<Button variant="danger">Anular</Button>);

    expect(screen.getByRole("button", { name: "Anular" }).className).toContain(
      "bg-danger",
    );
  });

  it("Given a disabled button, When rendered, Then it is disabled for assistive tech", () => {
    render(<Button disabled>Enviar</Button>);

    expect(screen.getByRole("button", { name: "Enviar" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});

describe("IconButton", () => {
  it("Given a label, When rendered, Then the accessible name comes from the label", () => {
    render(<IconButton label="Cerrar sesión" icon="×" />);

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
  });

  it("Given an icon, When rendered, Then the icon is hidden from assistive tech", () => {
    const { container } = render(<IconButton label="Añadir" icon="+" />);

    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon?.textContent).toBe("+");
  });
});
