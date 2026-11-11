import type {
  ProductStatus,
  VenueAvailability,
} from "#src/catalog/source/types.js";
import ui from "#src/styles/ui.module.scss";

const productClass: Record<ProductStatus, string> = {
  "on-menu": ui.chipGo,
  "paused-today": ui.chipStamp,
  "venue-only": ui.chipHold,
};

const productLabel: Record<ProductStatus, string> = {
  "on-menu": "En carta",
  "paused-today": "Pausado hoy",
  "venue-only": "Solo en sede",
};

export function ProductStatusChip({
  status,
  venueName,
}: {
  status: ProductStatus;
  venueName?: string;
}) {
  const label =
    status === "venue-only" && venueName !== undefined
      ? `Solo ${venueName}`
      : productLabel[status];
  return <span className={productClass[status]}>{label}</span>;
}

const offerClass: Record<VenueAvailability, string> = {
  yes: ui.chipGo,
  "here-only": ui.chipStamp,
  "sold-out-today": ui.chipStamp,
  hidden: ui.chipInk,
  scheduled: ui.chipInk,
};

export function OfferChip({
  availability,
  label,
}: {
  availability: VenueAvailability;
  label: string;
}) {
  return <span className={offerClass[availability]}>{label}</span>;
}
