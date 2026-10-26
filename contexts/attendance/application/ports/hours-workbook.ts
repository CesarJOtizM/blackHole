export interface HoursWorkbookRow {
  userId: string;
  workedMinutes: number;
  latenessMinutes: number;
  earlyLeaveMinutes: number;
  offScheduleMinutes: number;
  absent: boolean;
}

export interface HoursWorkbookSheet {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
  rows: readonly HoursWorkbookRow[];
}

export abstract class HoursWorkbook {
  abstract write(sheet: HoursWorkbookSheet): Promise<Uint8Array>;
}
