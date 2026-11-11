import { afterEach, describe, expect, it } from "vitest";
import {
  addContributor,
  askForFactusDocuments,
  attendancePath,
  auditPath,
  continueWithoutIssuing,
  controlReportPath,
  identityPath,
  listContributors,
  listFactusDocuments,
  listScarcity,
  orderPurchase,
  requestFromWarehouse,
  resetAdminSamples,
  selectScarcity,
  unusualBehaviorPath,
} from "#src/api/admin-api.js";

describe("admin sample api", () => {
  afterEach(() => {
    resetAdminSamples();
  });

  it("Given open alerts, When the inbox is filtered, Then resolved alerts stay out", () => {
    expect(listScarcity("open").map((alert) => alert.id)).toEqual([
      "papa-criolla",
      "churrasco",
    ]);
  });

  it("Given papa criolla, When the warehouse is asked, Then the alert is resolved", () => {
    selectScarcity("papa-criolla");

    expect(requestFromWarehouse("papa-criolla")).toBe(
      "Pedido a la bodega general por Papa criolla.",
    );
    expect(listScarcity("resolved").map((alert) => alert.name)).toContain(
      "Papa criolla",
    );
  });

  it("Given entraña, When a purchase is ordered, Then the alert is resolved", () => {
    expect(orderPurchase("entrana")).toBe(
      "Orden de compra abierta para Entraña.",
    );
    expect(listScarcity("resolved").map((alert) => alert.id)).toContain(
      "entrana",
    );
  });

  it("Given missing Factus documents, When they are requested, Then the missing ones are marked asked", () => {
    expect(askForFactusDocuments()).toBe(
      "Se pidieron los documentos que faltan del NIT.",
    );
    expect(
      listFactusDocuments().find((document) => document.id === "id-card")
        ?.state,
    ).toBe("Pedido");
    expect(continueWithoutIssuing()).toBe(
      "El alta sigue sin emitir documentos.",
    );
  });

  it("Given one taxpayer, When a second NIT is added, Then both stay in the sample", () => {
    expect(addContributor("", "901")).toBe("Escribe el nombre y el NIT.");
    expect(addContributor("Parrilla Norte SAS", "901.556.778-1")).toBeNull();
    expect(listContributors()).toHaveLength(2);
  });

  it("Given the cloud routes we already have, When paths are built, Then they match the API", () => {
    expect(auditPath("pilot")).toBe("/audit?tenantId=pilot");
    expect(attendancePath("policy")).toBe(
      "/tenants/pilot/venues/chapinero/attendance/policy",
    );
    expect(controlReportPath()).toBe(
      "/tenants/pilot/venues/chapinero/control-report",
    );
    expect(unusualBehaviorPath("current")).toBe(
      "/tenants/pilot/venues/chapinero/unusual-behavior?shiftId=current",
    );
    expect(identityPath()).toBe("/tenants/pilot/identity");
  });
});
