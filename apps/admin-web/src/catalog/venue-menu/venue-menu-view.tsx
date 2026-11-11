import { formatCop } from "#src/catalog/source/money.js";
import type { VenueOffer } from "#src/catalog/source/types.js";
import { OfferChip } from "#src/catalog/status-chip.js";
import styles from "#src/styles/catalog/menu.module.scss";
import ui from "#src/styles/ui.module.scss";

export interface VenueMenuViewProps {
  venueLabel: string;
  offers: VenueOffer[] | undefined;
  isPending: boolean;
  isError: boolean;
  onOpenMenu: () => void;
  onEdit: (productId: string) => void;
  onRemove: (productId: string) => void;
  onReactivate: (productId: string) => void;
}

export function VenueMenuView({
  venueLabel,
  offers,
  isPending,
  isError,
  onOpenMenu,
  onEdit,
  onRemove,
  onReactivate,
}: VenueMenuViewProps) {
  return (
    <div className={styles.content}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>
            Lo que cambia frente a la carta de la marca
          </p>
          <h1 className={ui.title}>Carta en {venueLabel}</h1>
        </div>
        <div className={ui.actions}>
          <button type="button" className={ui.buttonGhost} onClick={onOpenMenu}>
            Ver carta final
          </button>
        </div>
      </header>
      {isPending ? <p className={ui.note}>Cargando los ajustes</p> : null}
      {isError ? (
        <p className={ui.error}>No se pudieron leer los ajustes.</p>
      ) : null}
      {offers ? (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <caption className="srOnly">Ajustes de la sede</caption>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio marca</th>
                <th>Precio sede</th>
                <th>Disponible</th>
                <th>Motivo</th>
                <th>
                  <span className="srOnly">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.productId}>
                  <td>{offer.productName}</td>
                  <td className={ui.money}>{formatCop(offer.brandPrice)}</td>
                  <td className={ui.money}>{formatCop(offer.venuePrice)}</td>
                  <td>
                    <OfferChip
                      availability={offer.availability}
                      label={offer.availabilityLabel}
                    />
                  </td>
                  <td className={ui.meta}>{offer.reason}</td>
                  <td>
                    <OfferAction
                      offer={offer}
                      onEdit={onEdit}
                      onRemove={onRemove}
                      onReactivate={onReactivate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {offers.length === 0 ? (
            <p className={ui.empty}>
              Esta sede usa la carta de la marca sin cambios.
            </p>
          ) : null}
        </div>
      ) : null}
      <p className={ui.note}>
        Un agotado marcado en cocina vuelve a estar disponible al cerrar el día,
        salvo que se marque como permanente.
      </p>
    </div>
  );
}

function OfferAction({
  offer,
  onEdit,
  onRemove,
  onReactivate,
}: {
  offer: VenueOffer;
  onEdit: (productId: string) => void;
  onRemove: (productId: string) => void;
  onReactivate: (productId: string) => void;
}) {
  if (offer.action === "edit") {
    return (
      <button
        type="button"
        className={ui.textButton}
        onClick={() => onEdit(offer.productId)}
      >
        Editar
      </button>
    );
  }
  if (offer.action === "reactivate") {
    return (
      <button
        type="button"
        className={ui.textButton}
        onClick={() => onReactivate(offer.productId)}
      >
        Reactivar
      </button>
    );
  }
  return (
    <button
      type="button"
      className={ui.textButton}
      onClick={() => onRemove(offer.productId)}
    >
      Quitar
    </button>
  );
}
