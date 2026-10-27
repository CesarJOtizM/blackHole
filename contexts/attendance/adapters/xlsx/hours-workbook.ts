import * as XLSX from "xlsx";
import {
  HoursWorkbook,
  type HoursWorkbookRow,
  type HoursWorkbookSheet,
} from "#application/ports/hours-workbook.js";

const HEADERS = [
  "userId",
  "workedMinutes",
  "latenessMinutes",
  "earlyLeaveMinutes",
  "offScheduleMinutes",
  "absent",
] as const;

const cells = (
  row: HoursWorkbookRow,
): Record<(typeof HEADERS)[number], string | number | boolean> => ({
  userId: row.userId,
  workedMinutes: row.workedMinutes,
  latenessMinutes: row.latenessMinutes,
  earlyLeaveMinutes: row.earlyLeaveMinutes,
  offScheduleMinutes: row.offScheduleMinutes,
  absent: row.absent,
});

export class SheetJsHoursWorkbook extends HoursWorkbook {
  override async write(sheet: HoursWorkbookSheet): Promise<Uint8Array> {
    const grid = XLSX.utils.json_to_sheet(sheet.rows.map(cells), {
      header: [...HEADERS],
    });
    const book = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(book, grid, "hours");

    return new Uint8Array(
      XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Uint8Array,
    );
  }
}
