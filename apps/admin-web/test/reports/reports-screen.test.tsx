import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteReportPanel } from "#src/reports/reports-screen.js";

const bogotaNow = () => Date.parse("2026-11-11T18:00:00.000Z");

const emptySales = {
  family: "sales" as const,
  report: {
    grossCop: null,
    netCop: null,
    ticketCount: null,
  },
};

describe("site reports screen", () => {
  it("Given the afternoon in Bogota, When the sales section opens, Then the read uses today's Bogota bounds", async () => {
    const readReport = vi.fn(async () => emptySales);

    render(
      <SiteReportPanel
        family="sales"
        now={bogotaNow}
        readReport={readReport}
      />,
    );

    expect(await screen.findByText("Hoy en Bogotá")).toBeTruthy();
    expect(readReport).toHaveBeenCalledWith({
      family: "sales",
      from: "2026-11-11T05:00:00.000Z",
      to: "2026-11-12T05:00:00.000Z",
    });
  });

  it("Given a chosen history range, When the reader applies it, Then the read uses that range", async () => {
    const readReport = vi.fn(async () => ({
      family: "sales" as const,
      report: { grossCop: 12000, netCop: 10000, ticketCount: 2 },
    }));

    render(
      <SiteReportPanel
        family="sales"
        now={bogotaNow}
        readReport={readReport}
      />,
    );

    expect(await screen.findByText("12000")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-11-01T05:00:00.000Z" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-11-02T05:00:00.000Z" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ver historial" }));

    await waitFor(() => {
      expect(readReport).toHaveBeenCalledWith({
        family: "sales",
        from: "2026-11-01T05:00:00.000Z",
        to: "2026-11-02T05:00:00.000Z",
      });
    });
  });

  it("Given an empty sales section, When it is shown, Then the section stays empty and does not show zero", async () => {
    const readReport = vi.fn(async () => emptySales);

    render(
      <SiteReportPanel
        family="sales"
        now={bogotaNow}
        readReport={readReport}
      />,
    );

    expect(await screen.findByText("Sin datos")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("Given a failed read, When the section loads, Then the failure is not shown as zero", async () => {
    const readReport = vi.fn(async () => {
      throw new Error("down");
    });

    render(
      <SiteReportPanel
        family="sales"
        now={bogotaNow}
        readReport={readReport}
      />,
    );

    expect(await screen.findByText("No se pudo leer")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});
