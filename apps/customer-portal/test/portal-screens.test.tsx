import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BillingDataScreen } from "#src/billing-data-screen.js";
import { InvoiceLinkScreen } from "#src/invoice-link-screen.js";

it("given a pre-bill token, when /d/:token is shown, then the customer can submit billing data", () => {
  render(<BillingDataScreen token="pre-bill-token" />);

  expect(
    screen.getByRole("heading", { name: "Factura a tu nombre" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("Cédula")).toBeTruthy();
  expect(screen.getByLabelText("Correo")).toBeTruthy();
  expect(screen.getByLabelText("Municipio")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Enviar datos" }));
  expect(screen.getByRole("status").textContent).toMatch(/datos enviados/i);
});

it("given a one-time code, when the customer types it, then the screen keeps it only in that field", () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  render(<BillingDataScreen token="pre-bill-token" />);
  const code = screen.getByLabelText("Código de un solo uso");

  fireEvent.change(code, { target: { value: "482915" } });

  expect((code as HTMLInputElement).value).toBe("482915");
  expect(window.localStorage.getItem("482915")).toBeNull();
  expect(window.sessionStorage.getItem("482915")).toBeNull();
  expect(setItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Enviar datos" }));
  expect((code as HTMLInputElement).value).toBe("");
  expect(setItem).not.toHaveBeenCalled();
  setItem.mockRestore();
});

it("given an invoice link, when it is pending and then accepted, then the screen shows in process and then the PDF", () => {
  const view = render(
    <InvoiceLinkScreen link="ref.hmac" status="in_process" />,
  );

  expect(screen.getByRole("status").textContent).toMatch(/in process/i);
  expect(screen.queryByRole("link", { name: "PDF" })).toBeNull();

  view.rerender(<InvoiceLinkScreen link="ref.hmac" status="ready" />);

  expect(
    screen.getByRole("link", { name: "PDF" }).getAttribute("href"),
  ).toContain("ref.hmac");
});
