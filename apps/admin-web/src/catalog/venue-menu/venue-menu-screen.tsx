import { useNavigate, useParams } from "@tanstack/react-router";
import {
  useReactivateVenueOffer,
  useRemoveVenueOffer,
  useVenueOffers,
  useVenues,
} from "#src/catalog/source/use-admin.js";
import { VenueMenuView } from "#src/catalog/venue-menu/venue-menu-view.js";
import { TopBar } from "#src/shell/top-bar.js";

export function VenueMenuScreen() {
  const { venueId } = useParams({ from: "/catalog/venues/$venueId" });
  const navigate = useNavigate();
  const venues = useVenues();
  const offers = useVenueOffers(venueId);
  const removeOffer = useRemoveVenueOffer(venueId);
  const reactivateOffer = useReactivateVenueOffer(venueId);
  const venue = venues.data?.find((item) => item.id === venueId);

  return (
    <>
      <TopBar
        current="menu"
        venue={{
          value: venueId,
          options: [
            { value: "all", label: "Todas las sedes" },
            ...(venues.data ?? []).map((item) => ({
              value: item.id,
              label: item.label,
            })),
          ],
          onChange: (next) => {
            if (next === "all") {
              void navigate({ to: "/catalog/menu" });
              return;
            }
            void navigate({
              to: "/catalog/venues/$venueId",
              params: { venueId: next },
            });
          },
        }}
      />
      <VenueMenuView
        venueLabel={venue?.label ?? "la sede"}
        offers={offers.data}
        isPending={offers.isPending}
        isError={offers.isError}
        onOpenMenu={() => {
          void navigate({ to: "/catalog/menu" });
        }}
        onEdit={(productId) => {
          void navigate({
            to: "/catalog/menu/$productId",
            params: { productId },
          });
        }}
        onRemove={(productId) => {
          removeOffer.mutate(productId);
        }}
        onReactivate={(productId) => {
          reactivateOffer.mutate(productId);
        }}
      />
    </>
  );
}
