import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import { SheetJsHoursWorkbook } from "#adapters/xlsx/hours-workbook.js";

const HEADERS = [
  "userId",
  "workedMinutes",
  "latenessMinutes",
  "earlyLeaveMinutes",
  "offScheduleMinutes",
  "absent",
] as const;

it("given corrected hours for one worker, when the workbook is written, then the sheet lists those hours and has no salary column", async () => {
  const bytes = await new SheetJsHoursWorkbook().write({
    tenantId: "organization_tenant_1",
    venueId: "venue_1",
    from: "2026-10-19T05:00:00.000Z",
    to: "2026-10-26T05:00:00.000Z",
    rows: [
      {
        userId: "user_cashier",
        workedMinutes: 480,
        latenessMinutes: 7,
        earlyLeaveMinutes: 0,
        offScheduleMinutes: 0,
        absent: false,
      },
    ],
  });

  const book = XLSX.read(bytes, { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet ?? {}, {
    header: 1,
  });
  const headers = grid[0] ?? [];

  expect(headers).toEqual([...HEADERS]);
  expect(JSON.stringify(grid).toLowerCase()).not.toMatch(/salary|salario|wage/);
  expect(grid[1]).toEqual(["user_cashier", 480, 7, 0, 0, false]);
});
