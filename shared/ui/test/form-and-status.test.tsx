import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "#ui/components/field.js";
import { StatusChip } from "#ui/components/status-chip.js";

describe("Field", () => {
  it("Given a visible label, When rendered, Then the input is named by that label", () => {
    render(<Field label="Número de comensales" />);

    expect(screen.getByLabelText("Número de comensales")).toBeTruthy();
  });

  it("Given a hint, When rendered, Then the input describes itself with the hint", () => {
    render(<Field label="PIN" hint="Cuatro dígitos" />);

    const input = screen.getByLabelText("PIN");
    const hint = screen.getByText("Cuatro dígitos");
    expect(input.getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("Given an error, When rendered, Then the input is invalid and the error is announced", () => {
    render(<Field label="PIN" error="PIN incorrecto" />);

    const input = screen.getByLabelText("PIN");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("PIN incorrecto");
    expect(input.getAttribute("aria-describedby")).toContain(
      screen.getByRole("alert").id,
    );
  });

  it("Given no error, When rendered, Then the input is not marked invalid", () => {
    render(<Field label="PIN" />);

    expect(
      screen.getByLabelText("PIN").getAttribute("aria-invalid"),
    ).toBeNull();
  });
});

describe("StatusChip", () => {
  it("Given a tone and a text, When rendered, Then the state is readable as text", () => {
    render(<StatusChip tone="check-requested">Cuenta pedida</StatusChip>);

    expect(screen.getByText("Cuenta pedida")).toBeTruthy();
  });

  it("Given an icon, When rendered, Then the icon is hidden so the text carries the state", () => {
    const { container } = render(
      <StatusChip tone="ready" icon="✓">
        Listo
      </StatusChip>,
    );

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "✓",
    );
  });
});
