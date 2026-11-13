const SESSION_HEADER = "x-session-id";

export const VENUE_SCOPE = {
  tenantId: "pilot",
  venueId: "chapinero",
  sessionId: "admin-web",
  registerId: "register_chapinero",
  stationId: "station_parrilla",
} as const;

const venueBase = `/tenants/${VENUE_SCOPE.tenantId}/venues/${VENUE_SCOPE.venueId}`;

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const cloudState = (
  state: string,
): "free" | "occupied" | "check" | "clean" | null => {
  if (state === "free" || state === "occupied") {
    return state;
  }

  if (state === "check_requested") {
    return "check";
  }

  if (state === "to_clean") {
    return "clean";
  }

  return null;
};

export const readTableMap = (
  body: unknown,
): Array<{
  id: string;
  label: string;
  seats: number;
  state: "free" | "occupied" | "check" | "clean";
  lines: [];
}> | null => {
  const record = readRecord(body);
  const zones = record?.zones;

  if (!Array.isArray(zones)) {
    return null;
  }

  const tables = zones.flatMap((zone) => {
    const listed = readRecord(zone)?.tables;

    if (!Array.isArray(listed)) {
      return [];
    }

    return listed.flatMap((item) => {
      const table = readRecord(item);
      const state =
        table === null || typeof table.state !== "string"
          ? null
          : cloudState(table.state);

      if (
        table === null ||
        typeof table.id !== "string" ||
        typeof table.diners !== "number" ||
        state === null
      ) {
        return [];
      }

      return [
        {
          id: table.id,
          label: table.id,
          seats: table.diners,
          state,
          lines: [],
        },
      ];
    });
  });

  return tables.length === 0 ? null : tables;
};

const minutesSince = (sentAt: string): number => {
  const sent = Date.parse(sentAt);

  if (!Number.isFinite(sent)) {
    return 0;
  }

  return Math.max(0, Math.round((Date.now() - sent) / 60_000));
};

export const readStationQueue = (
  body: unknown,
): Array<{
  id: string;
  tableLabel: string;
  course: string;
  minutes: number;
  lines: string[];
  ready: boolean;
  channel?: "qr_table";
  checkId: string;
  lineId: string;
}> | null => {
  const lines = readRecord(body)?.lines;

  if (!Array.isArray(lines)) {
    return null;
  }

  const tickets = lines.flatMap((item) => {
    const line = readRecord(item);

    if (
      line === null ||
      typeof line.lineId !== "string" ||
      typeof line.tableId !== "string" ||
      typeof line.checkId !== "string" ||
      typeof line.name !== "string" ||
      typeof line.sentAt !== "string" ||
      (line.state !== "sent" &&
        line.state !== "in_preparation" &&
        line.state !== "ready")
    ) {
      return [];
    }

    return [
      {
        id: line.lineId,
        tableLabel: line.tableId,
        course: "Fuego",
        minutes: minutesSince(line.sentAt),
        lines: [line.name],
        ready: line.state === "ready",
        channel: line.channel === "qr_table" ? "qr_table" : undefined,
        checkId: line.checkId,
        lineId: line.lineId,
      },
    ];
  });

  return tickets.length === 0 ? null : tickets;
};

const postJson = async (path: string, body: unknown): Promise<boolean> => {
  if (typeof fetch !== "function") {
    return false;
  }

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SESSION_HEADER]: VENUE_SCOPE.sessionId,
      },
      body: JSON.stringify(body),
    });

    return response.ok;
  } catch {
    return false;
  }
};

const getJson = async (path: string): Promise<unknown | null> => {
  if (typeof fetch !== "function") {
    return null;
  }

  try {
    const response = await fetch(path, {
      headers: { [SESSION_HEADER]: VENUE_SCOPE.sessionId },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
};

export const loadVenueCloud = async (): Promise<{
  tables: ReturnType<typeof readTableMap>;
  tickets: ReturnType<typeof readStationQueue>;
}> => {
  const [map, queue] = await Promise.all([
    getJson(`${venueBase}/table-map`),
    getJson(`${venueBase}/stations/${VENUE_SCOPE.stationId}/queue`),
  ]);

  return {
    tables: readTableMap(map),
    tickets: readStationQueue(queue),
  };
};

export const postClock = async (
  kind: "clock_in" | "clock_out",
  pin: string,
): Promise<boolean> => {
  const coordinates = await readCoordinates();

  if (coordinates === null) {
    return false;
  }

  return postJson(`${venueBase}/clock-entries`, {
    pin,
    kind,
    coordinates,
    commandId: crypto.randomUUID(),
  });
};

export const postOpenShift = (openingFloatCop: number): Promise<boolean> =>
  postJson(`${venueBase}/cash-registers/${VENUE_SCOPE.registerId}/open`, {
    shiftId: `shift_${crypto.randomUUID()}`,
    openingFloatCop,
  });

export const postOpenTable = (
  tableId: string,
  checkId: string,
  diners: number,
): Promise<boolean> =>
  postJson(`${venueBase}/dining-tables/${tableId}/open`, {
    checkId,
    diners,
  });

export const postSendCourse = (checkId: string): Promise<boolean> =>
  postJson(`${venueBase}/checks/${checkId}/send`, { course: 1 });

export const postRequestCheck = (checkId: string): Promise<boolean> =>
  postJson(`${venueBase}/checks/${checkId}/bill`, {});

export const postReleaseTable = (tableId: string): Promise<boolean> =>
  postJson(`${venueBase}/dining-tables/${tableId}/release`, {});

export const postLineReady = (
  checkId: string,
  lineId: string,
): Promise<boolean> =>
  postJson(`${venueBase}/checks/${checkId}/lines/${lineId}/ready`, {});

const readCoordinates = async (): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  if (typeof navigator === "undefined" || navigator.geolocation === undefined) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { timeout: 3000 },
    );
  });
};
