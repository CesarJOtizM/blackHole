import { expect, it } from "vitest";

import {
  DiningTable,
  InvalidTableId,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";

const placeTerraceTable = (id = TABLE_ID) =>
  DiningTable.place({
    id,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

it("given a free Terrace table, when opened for 4, then the table is occupied", () => {
  const table = placeTerraceTable();

  expect(table.state).toBe("free");
  expect(table.zone).toBe("Terrace");

  table.open({ diners: 4 });

  expect(table.state).toBe("occupied");
  expect(table.diners).toBe(4);
});

it("given an occupied table, when opened again, then TableAlreadyOccupied and the seating stays", () => {
  const table = placeTerraceTable();
  table.open({ diners: 4 });
  const before = { state: table.state, diners: table.diners };

  const openAgain = () => {
    table.open({ diners: 2 });
  };

  expect(openAgain).toThrow(TableAlreadyOccupied);
  expect({ state: table.state, diners: table.diners }).toEqual(before);
});

it("given a table to clean, when marked ready, then the table is free", () => {
  const table = placeTerraceTable();
  table.open({ diners: 4 });
  table.release();

  expect(table.state).toBe("to_clean");

  table.markReady();

  expect(table.state).toBe("free");
  expect(table.diners).toBe(0);
});

it("given an occupied table, when released, then the table is to_clean", () => {
  const table = placeTerraceTable();
  table.open({ diners: 4 });

  table.release();

  expect(table.state).toBe("to_clean");
});

it("given a check-requested table, when released, then the table is to_clean", () => {
  const table = placeTerraceTable();
  table.open({ diners: 4 });
  table.requestCheck();

  expect(table.state).toBe("check_requested");

  table.release();

  expect(table.state).toBe("to_clean");
});

it("given an identifier without the table_ prefix, when a table is placed, then it is rejected", () => {
  const place = () => {
    DiningTable.place({
      id: "5",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      zone: "Terrace",
    });
  };

  expect(place).toThrow(InvalidTableId);
});
