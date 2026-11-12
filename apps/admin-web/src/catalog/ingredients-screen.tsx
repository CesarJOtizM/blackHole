import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "#src/catalog/admin-page.js";
import { scopeFromDraft, useCatalogScope } from "#src/catalog/catalog-scope.js";
import {
  BASE_UNIT,
  type BaseUnit,
  type CatalogScope,
  catalogQueryKey,
  type IngredientForm,
  publishCatalog,
  type UpsertIngredientCommand,
  upsertIngredientCommand,
} from "#src/catalog/cloud-recipe-api.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import { NoticeToast } from "#src/shell/notice-toast.js";
import ui from "#src/styles/ui.module.scss";

const SAMPLE_INGREDIENTS = [
  ["Papa criolla", "kg", "Bodega"],
  ["Entraña", "kg", "Carnes del Llano"],
  ["Limón Tahití", "und", "Plaza"],
  ["Aceite de girasol", "lt", "Almacén"],
  ["Sal", "kg", "Almacén"],
];

export function IngredientsScreen() {
  const queryClient = useQueryClient();
  const { draft, rememberScope } = useCatalogScope();
  const [rows, setRows] = useState(SAMPLE_INGREDIENTS);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [cost, setCost] = useState("");
  const [notice, setNotice] = useState("");
  const publish = useMutation({
    mutationFn: (input: {
      scope: CatalogScope;
      commands: readonly UpsertIngredientCommand[];
    }) => publishCatalog(input.scope, input.commands),
    onSuccess: async (result, input) => {
      if (result.status !== 200) {
        return;
      }

      rememberScope(input.scope);
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKey(input.scope),
      });
    },
  });

  function openDialog() {
    setName("");
    setUnit("kg");
    setCost("");
    setOpen(true);
  }

  function createIngredient() {
    const trimmed = name.trim();
    const nextUnit = unit.trim() || "und";
    setRows((current) => [[trimmed, nextUnit, "Esta sesión"], ...current]);
    setNotice(`${trimmed} queda en el catálogo de esta sesión.`);
    setOpen(false);

    const scope = scopeFromDraft(draft);
    const command = upsertIngredientCommand(
      ingredientDraft(trimmed, nextUnit, cost),
    );
    if (scope !== null && command !== null) {
      publish.mutate({ scope, commands: [command] });
    }
  }

  return (
    <>
      <AdminPage
        title="Ingredientes"
        lede="Versión 12 · Parrilla Norte"
        action={
          <button type="button" className={ui.button} onClick={openDialog}>
            Nuevo ingrediente
          </button>
        }
      >
        <p className={ui.note}>
          Lo que la marca compra y las recetas consumen.
        </p>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <caption className="srOnly">Ingredientes</caption>
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Unidad</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row[0]}-${index}`}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPage>
      <FormDialog
        open={open}
        eyebrow="Se abre desde ingredientes"
        title="Nuevo ingrediente"
        help="Entra a la lista de la marca. Las sedes lo usan cuando una receta lo pide."
        submitLabel="Crear ingrediente"
        fields={[
          { label: "Nombre", value: name, required: true, onChange: setName },
          { label: "Unidad", value: unit, required: true, onChange: setUnit },
          { label: "Costo", value: cost, onChange: setCost },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={createIngredient}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
  );
}

function ingredientDraft(
  name: string,
  unit: string,
  cost: string,
): IngredientForm {
  const digits = cost.replace(/\D/g, "");

  return {
    id: ingredientId(name),
    name,
    baseUnit: baseUnitFrom(unit),
    purchaseUnitName: unit,
    purchaseBaseQuantity: "1",
    recipeUnitName: unit,
    recipeBaseQuantity: "1",
    referenceCostCop: digits.length > 0 ? digits : "0",
  };
}

function ingredientId(name: string): string {
  const id = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return id.length > 0 ? id : "ingrediente";
}

function baseUnitFrom(unit: string): BaseUnit {
  const value = unit.trim().toLowerCase();
  if (value === "g" || value === "kg") {
    return BASE_UNIT.GRAM;
  }
  if (value === "ml" || value === "l" || value === "lt") {
    return BASE_UNIT.MILLILITRE;
  }
  return BASE_UNIT.UNIT;
}
