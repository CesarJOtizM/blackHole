import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { formatCop, parseCop } from "#src/catalog/source/money.js";
import type {
  ProductDetail,
  ProductDraft,
  ProductModifier,
  SaleChannels,
} from "#src/catalog/source/types.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import styles from "#src/styles/catalog/product.module.scss";
import ui from "#src/styles/ui.module.scss";

const categoryLabel = {
  starters: "Entradas",
  cuts: "Cortes",
  mixed: "Parrilla mixta",
  sides: "Acompañantes",
  desserts: "Postres",
  drinks: "Bebidas",
} as const;

const brandLabel = {
  "la-parrilla": "La Parrilla",
  "burger-street": "Burger Street",
} as const;

const taxes = ["INC 8%", "IVA 19%", "Exento"];
const stations = ["Parrilla", "Cocina", "Fritura", "Barra", "Plancha"];

const channels = [
  ["diningRoom", "Salón"],
  ["tableQr", "QR en mesa"],
  ["ownDelivery", "Domicilio propio"],
  ["rappi", "Rappi"],
] as const;

export interface ProductViewProps {
  product: ProductDetail | null | undefined;
  isPending: boolean;
  isError: boolean;
  isSaving: boolean;
  isDuplicating: boolean;
  onSave: (draft: ProductDraft) => Promise<unknown>;
  onDuplicate: (productId: string) => void;
}

export function ProductView({
  product,
  isPending,
  isError,
  isSaving,
  isDuplicating,
  onSave,
  onDuplicate,
}: ProductViewProps) {
  return (
    <div className={styles.content}>
      {isPending ? <p className={ui.note}>Cargando el producto</p> : null}
      {isError ? (
        <p className={ui.error}>No se pudo leer el producto.</p>
      ) : null}
      {product === null ? (
        <p className={ui.empty}>Ese producto no está en la carta.</p>
      ) : null}
      {product ? (
        <ProductEditor
          key={product.id}
          product={product}
          isSaving={isSaving}
          isDuplicating={isDuplicating}
          onSave={onSave}
          onDuplicate={onDuplicate}
        />
      ) : null}
    </div>
  );
}

function ProductEditor({
  product,
  isSaving,
  isDuplicating,
  onSave,
  onDuplicate,
}: {
  product: ProductDetail;
  isSaving: boolean;
  isDuplicating: boolean;
  onSave: (draft: ProductDraft) => Promise<unknown>;
  onDuplicate: (productId: string) => void;
}) {
  const [photoLabel, setPhotoLabel] = useState("Subir foto");
  const [saved, setSaved] = useState(false);
  const [groupNotice, setGroupNotice] = useState("");
  const [modifiers, setModifiers] = useState(product.modifiers);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<ProductModifier | null>(null);
  const form = useForm({
    defaultValues: valuesFrom(product),
    onSubmit: async ({ value }) => {
      const price = parseCop(value.price);
      const minutes = Number(value.targetMinutes);
      if (
        value.menuName.trim() === "" ||
        value.ticketName.trim() === "" ||
        price === null ||
        !Number.isInteger(minutes) ||
        minutes < 1
      ) {
        return;
      }
      const nextChannels: SaleChannels = {
        diningRoom: value.diningRoom,
        tableQr: value.tableQr,
        ownDelivery: value.ownDelivery,
        rappi: value.rappi,
      };
      await onSave({
        menuName: value.menuName.trim(),
        ticketName: value.ticketName.trim(),
        price,
        tax: value.tax,
        station: value.station,
        targetMinutes: minutes,
        channels: nextChannels,
      });
      setSaved(true);
    },
  });
  const ratio =
    product.price === 0
      ? 0
      : Math.round((product.recipeCost / product.price) * 100);

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setSaved(false);
          void form.handleSubmit();
        }}
      >
        <header className={ui.pageHeader}>
          <div>
            <p className={ui.eyebrow}>
              {categoryLabel[product.categoryId]} ·{" "}
              {brandLabel[product.brandId]}
            </p>
            <h1 className={ui.title}>{product.name}</h1>
          </div>
          <div className={ui.actions}>
            <button
              type="button"
              className={ui.buttonGhost}
              disabled={isDuplicating}
              onClick={() => onDuplicate(product.id)}
            >
              Duplicar
            </button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  className={ui.button}
                  disabled={isSubmitting || isSaving}
                >
                  Guardar
                </button>
              )}
            </form.Subscribe>
          </div>
        </header>
        <div className={styles.grid}>
          <div>
            <div className={styles.fields}>
              <form.Field
                name="menuName"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim() === "" ? "Completa este campo" : undefined,
                }}
              >
                {(field) => (
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Nombre en carta</span>
                    <input
                      className={ui.input}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                    <FieldError message={field.state.meta.errors[0]} />
                  </label>
                )}
              </form.Field>
              <form.Field
                name="ticketName"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim() === "" ? "Completa este campo" : undefined,
                }}
              >
                {(field) => (
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Nombre en comanda</span>
                    <input
                      className={ui.input}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                    <FieldError message={field.state.meta.errors[0]} />
                  </label>
                )}
              </form.Field>
              <form.Field
                name="price"
                validators={{
                  onSubmit: ({ value }) =>
                    parseCop(value) === null ? "Escribe el precio" : undefined,
                }}
              >
                {(field) => (
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Precio con impuesto</span>
                    <input
                      className={ui.input}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                    <FieldError message={field.state.meta.errors[0]} />
                  </label>
                )}
              </form.Field>
              <form.Field name="tax">
                {(field) => (
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Impuesto</span>
                    <select
                      className={ui.select}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    >
                      {taxes.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </form.Field>
              <form.Field name="station">
                {(field) => (
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Estación</span>
                    <select
                      className={ui.select}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    >
                      {stations.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </form.Field>
              <form.Field
                name="targetMinutes"
                validators={{
                  onSubmit: ({ value }) =>
                    Number(value) >= 1 ? undefined : "Escribe los minutos",
                }}
              >
                {(field) => (
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Tiempo objetivo</span>
                    <input
                      className={ui.input}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                    <FieldError message={field.state.meta.errors[0]} />
                  </label>
                )}
              </form.Field>
            </div>
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Variantes</h2>
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>Precio</th>
                      <th>Receta</th>
                      <th>Activa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant) => (
                      <tr key={variant.recipeCode}>
                        <td>{variant.name}</td>
                        <td className={ui.money}>{formatCop(variant.price)}</td>
                        <td className={ui.meta}>{variant.recipeCode}</td>
                        <td className={ui.meta}>
                          {variant.active ? "Sí" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Modificadores</h2>
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Grupo</th>
                      <th>Regla</th>
                      <th>Opciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modifiers.map((modifier) => (
                      <tr key={modifier.group}>
                        <td>
                          <button
                            type="button"
                            className={ui.nameLink}
                            onClick={() => {
                              setGroupKey(modifier.group);
                              setGroupDraft({ ...modifier });
                            }}
                          >
                            {modifier.group}
                          </button>
                        </td>
                        <td className={ui.meta}>{modifier.rule}</td>
                        <td className={ui.meta}>{modifier.options}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {modifiers.length === 0 ? (
                  <p className={ui.empty}>
                    Este producto no tiene modificadores.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
          <aside className={styles.side}>
            <button
              type="button"
              className={styles.photo}
              onClick={() => setPhotoLabel("Foto lista para subir")}
            >
              {photoLabel}
            </button>
            <div className={styles.card}>
              <h2 className={styles.blockTitle}>Se vende en</h2>
              {channels.map(([name, label]) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <div className={styles.channel}>
                      <span>{label}</span>
                      <button
                        type="button"
                        className={field.state.value ? ui.switchOn : ui.switch}
                        role="switch"
                        aria-checked={field.state.value}
                        aria-label={label}
                        onClick={() => field.handleChange(!field.state.value)}
                      >
                        <span className={ui.knob} />
                      </button>
                    </div>
                  )}
                </form.Field>
              ))}
            </div>
            <div className={styles.card}>
              <p className={styles.costLabel}>Costo receta</p>
              <p className={styles.costValue}>
                {formatCop(product.recipeCost)}
              </p>
              <p className={styles.costLabel}>Costo / precio</p>
              <p className={styles.costValue}>{ratio}%</p>
            </div>
          </aside>
        </div>
        {saved ? (
          <p className={ui.note} role="status">
            Guardado en esta sesión. El servidor lo recibirá cuando la carta
            esté conectada.
          </p>
        ) : null}
        {groupNotice.length > 0 ? (
          <p className={ui.note} role="status">
            {groupNotice}
          </p>
        ) : null}
      </form>
      <FormDialog
        open={groupDraft !== null}
        eyebrow="Se abre al elegir el grupo"
        title={groupDraft?.group ?? "Grupo"}
        help="El plato sigue en el editor. Este grupo se cambia aquí, no en la tabla."
        submitLabel="Guardar grupo"
        fields={
          groupDraft
            ? [
                {
                  label: "Nombre del grupo",
                  value: groupDraft.group,
                  required: true,
                  onChange: (group) =>
                    setGroupDraft((current) =>
                      current ? { ...current, group } : current,
                    ),
                },
                {
                  label: "Regla",
                  value: groupDraft.rule,
                  required: true,
                  onChange: (rule) =>
                    setGroupDraft((current) =>
                      current ? { ...current, rule } : current,
                    ),
                },
                {
                  label: "Opciones",
                  value: groupDraft.options,
                  required: true,
                  onChange: (options) =>
                    setGroupDraft((current) =>
                      current ? { ...current, options } : current,
                    ),
                },
              ]
            : []
        }
        onClose={() => {
          setGroupDraft(null);
          setGroupKey(null);
        }}
        onSubmit={() => {
          if (!groupDraft || groupKey === null) {
            return;
          }
          setModifiers((current) =>
            current.map((modifier) =>
              modifier.group === groupKey ? groupDraft : modifier,
            ),
          );
          setGroupNotice("El grupo quedó guardado en el editor.");
          setGroupDraft(null);
          setGroupKey(null);
        }}
      />
    </>
  );
}

function valuesFrom(product: ProductDetail) {
  return {
    menuName: product.name,
    ticketName: product.ticketName,
    price: formatCop(product.price),
    tax: product.tax,
    station: product.station,
    targetMinutes: String(product.targetMinutes),
    diningRoom: product.channels.diningRoom,
    tableQr: product.channels.tableQr,
    ownDelivery: product.channels.ownDelivery,
    rappi: product.channels.rappi,
  };
}

function FieldError({ message }: { message: unknown }) {
  if (message === undefined) {
    return null;
  }
  const text =
    typeof message === "string"
      ? message
      : message !== null &&
          typeof message === "object" &&
          "message" in message &&
          typeof message.message === "string"
        ? message.message
        : "";
  if (text === "") {
    return null;
  }
  return <span className={ui.error}>{text}</span>;
}
