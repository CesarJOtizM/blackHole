import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import {
  useAddTable,
  useRegenerateQr,
  useTables,
  useVenues,
  useZones,
} from "#src/catalog/source/use-admin.js";
import { TablesView } from "#src/catalog/tables/tables-view.js";
import { TopBar } from "#src/shell/top-bar.js";

const tablesRoute = getRouteApi("/catalog/tables");

export function TablesScreen() {
  const navigate = tablesRoute.useNavigate();
  const { venue: venueId } = tablesRoute.useSearch();
  const venues = useVenues();
  const zones = useZones(venueId);
  const [zoneId, setZoneId] = useState("salon");
  const tables = useTables(venueId, zoneId);
  const addTable = useAddTable(venueId, zoneId);
  const regenerate = useRegenerateQr(venueId, zoneId);
  const [selectedId, setSelectedId] = useState("chapinero-08");
  const selected =
    tables.data?.find((table) => table.id === selectedId) ?? tables.data?.[0];
  const zone = zones.data?.find((item) => item.id === zoneId);
  const venue = venues.data?.find((item) => item.id === venueId);

  return (
    <>
      <TopBar
        current="tables"
        venue={{
          value: venueId,
          options: (venues.data ?? []).map((item) => ({
            value: item.id,
            label: item.label,
          })),
          onChange: (next) => {
            void navigate({
              // The registered route tree does not expose this route's search.
              search: {
                venue: next === "usaquen" ? "usaquen" : "chapinero",
              } as never,
            });
          },
        }}
      />
      <TablesView
        zoneName={zone?.name ?? venue?.label ?? "Salón"}
        tableCount={tables.data?.length ?? 0}
        zones={zones.data ?? []}
        zoneId={zoneId}
        tables={tables.data ?? []}
        selected={selected}
        addPending={addTable.isPending}
        onZone={setZoneId}
        onSelect={setSelectedId}
        onAdd={() => {
          addTable.mutate(undefined, {
            onSuccess: (table) => setSelectedId(table.id),
          });
        }}
        onRegenerate={(tableId) => {
          regenerate.mutate(tableId);
        }}
      />
    </>
  );
}
