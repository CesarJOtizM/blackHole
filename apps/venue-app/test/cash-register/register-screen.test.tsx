import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RegisterScreen } from "#src/cash-register/register-screen.js";
import { ServiceProvider } from "#src/service/service-session.js";

it("given billing data received, when the cashier has not chosen, then the charge stays off", () => {
  render(
    <ServiceProvider>
      <RegisterScreen />
    </ServiceProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir turno" }));
  const charge = screen.getByRole("button", {
    name: "Cobrar e imprimir factura",
  });

  expect(screen.getByText("Datos recibidos")).toBeTruthy();
  expect(charge.hasAttribute("disabled")).toBe(true);
});

it("given billing data received, when the cashier chooses the portal data, then the charge can proceed", () => {
  render(
    <ServiceProvider>
      <RegisterScreen />
    </ServiceProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir turno" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Usar datos del portal" }),
  );

  expect(
    screen
      .getByRole("button", { name: "Cobrar e imprimir factura" })
      .hasAttribute("disabled"),
  ).toBe(false);
});

it("given a stale qr payment, when the cashier counts cash, then the pending payment is visible and qr stays apart from cash", () => {
  render(
    <ServiceProvider>
      <RegisterScreen
        stalePayments={[{ reference: "qrpay_stale" }]}
        qrCop={120_000}
        expectedCashCop={200_000}
      />
    </ServiceProvider>,
  );

  expect(screen.getByText("Datos recibidos")).toBeTruthy();
  expect(screen.getByText("Pago QR pendiente")).toBeTruthy();
  expect(screen.getByText("qrpay_stale")).toBeTruthy();
  expect(screen.getByText(/QR\s+\$\s*120\.000/)).toBeTruthy();
  expect(screen.getByText(/Efectivo esperado\s+\$\s*200\.000/)).toBeTruthy();
  expect(screen.getByText(/Contado\s+\$\s*0/)).toBeTruthy();
});
