import { getRouteApi } from "@tanstack/react-router";
import { QrOrdersView } from "#src/catalog/qr-orders/qr-orders-view.js";
import {
  useQrSettings,
  useSaveQrSettings,
  useVenues,
} from "#src/catalog/source/use-admin.js";
import { TopBar } from "#src/shell/top-bar.js";

const qrRoute = getRouteApi("/catalog/qr-orders");

export function QrOrdersScreen() {
  const navigate = qrRoute.useNavigate();
  const { venue: venueId } = qrRoute.useSearch();
  const venues = useVenues();
  const settings = useQrSettings(venueId);
  const save = useSaveQrSettings(venueId);

  return (
    <>
      <TopBar
        current="qr"
        venue={{
          value: venueId,
          options: (venues.data ?? []).map((venue) => ({
            value: venue.id,
            label: venue.label,
          })),
          onChange: (next) => {
            void navigate({ search: { venue: next } });
          },
        }}
      />
      <QrOrdersView
        settings={settings.data}
        isSaving={save.isPending}
        isSaved={save.isSuccess}
        onSave={(next) => {
          save.mutate(next);
        }}
      />
    </>
  );
}
