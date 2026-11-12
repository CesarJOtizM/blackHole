import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ReinvoiceWindowScreen } from "#src/fiscal/reinvoice-screen.js";
import { ReinvoiceWindowView } from "#src/fiscal/reinvoice-view.js";

const modes = ["same_day", "same_month", "off"] as const;

it("given the reinvoice window, when a mode is chosen, then same_day, same_month, and off are the only choices", () => {
  const onMode = vi.fn();
  render(
    <ReinvoiceWindowView
      mode="same_day"
      permissions={["sale.credit-note"]}
      onMode={onMode}
      onApprove={vi.fn()}
    />,
  );

  for (const mode of modes) {
    expect(screen.getByRole("radio", { name: mode })).toBeTruthy();
  }

  fireEvent.click(screen.getByRole("radio", { name: "same_month" }));
  fireEvent.click(screen.getByRole("radio", { name: "off" }));

  expect(onMode).toHaveBeenNthCalledWith(1, "same_month");
  expect(onMode).toHaveBeenNthCalledWith(2, "off");
});

it("given a session without sale.credit-note, when approval is offered, then the action stays off", () => {
  const onApprove = vi.fn();
  render(
    <ReinvoiceWindowView
      mode="same_day"
      permissions={["sale.charge"]}
      onMode={vi.fn()}
      onApprove={onApprove}
    />,
  );

  const approve = screen.getByRole("button", { name: "Aprobar nota crédito" });

  expect(approve.hasAttribute("disabled")).toBe(true);
  fireEvent.click(approve);
  expect(onApprove).not.toHaveBeenCalled();
});

it("given a holder of sale.credit-note, when approval is clicked, then the approval route is requested", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ outcome: "approved" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const approval = {
    invoiceNumber: "SETP990000001",
    at: "2026-11-11T18:00:00.000Z",
    original: {
      closureId: "closure_front_1",
      referenceCode: "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f",
      status: "accepted" as const,
      buyer: {
        documentType: "13" as const,
        documentNumber: "222222222222" as const,
        name: "Consumidor final" as const,
        responsibility: "R-99-PN" as const,
        email: "facturas@taxpayer.example",
      },
    },
    creditNote: {
      referenceCode: "01932f4a-8c3a-7b2d-8e1f-6a5b4c3d2e20",
      tenantId: "pilot",
      actorId: "user_manager",
      authorizerId: null,
      deviceId: "device_register",
      siteId: "chapinero",
      reason: "Customer asked to re-invoice",
    },
    invoice: {
      closureId: "closure_reinvoice_1",
      referenceCode: "01932f4a-9c3a-7b2d-8e1f-6a5b4c3d2e21",
      taxpayerEmail: "buyer@customer.example",
      documentBalance: 0,
      rules: [],
      siteRangeId: "range-site-1",
    },
  };

  render(
    <ReinvoiceWindowScreen
      permissions={["sale.credit-note"]}
      approval={approval}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Aprobar nota crédito" }));

  expect(await screen.findByText("Nota crédito aprobada.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
  expect(url).toBe("/tenants/pilot/venues/chapinero/reinvoices/approve");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(JSON.parse(init.body ?? "")).toMatchObject({
    ...approval,
    windowMode: "same_day",
  });
});
