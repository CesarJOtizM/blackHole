import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage } from "#src/catalog/admin-page.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import { NoticeToast } from "#src/shell/notice-toast.js";
import ui from "#src/styles/ui.module.scss";

interface RecipeRow {
  name: string;
  cost: string;
  foodCost: string;
  detail: boolean;
}

const SAMPLE_RECIPES: RecipeRow[] = [
  { name: "Churrasco 300 g", cost: "$18.400", foodCost: "32%", detail: true },
  {
    name: "Hamburguesa de la casa",
    cost: "$9.200",
    foodCost: "28%",
    detail: false,
  },
  { name: "Papas criollas", cost: "$3.400", foodCost: "22%", detail: false },
  { name: "Limonada natural", cost: "$1.100", foodCost: "18%", detail: false },
];

export function RecipesScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(SAMPLE_RECIPES);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [notice, setNotice] = useState("");

  function openRecipe(recipe: RecipeRow) {
    if (!recipe.detail) {
      return;
    }
    void navigate({ to: "/inventory/recipes/churrasco" });
  }

  return (
    <>
      <AdminPage
        title="Recetas"
        lede="Costo de la carta"
        action={
          <button
            type="button"
            className={ui.button}
            onClick={() => {
              setName("");
              setProduct("");
              setOpen(true);
            }}
          >
            Nueva receta
          </button>
        }
      >
        <p className={ui.note}>
          El costo de cada plato. Abrir una receta muestra sus líneas.
        </p>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <caption className="srOnly">Recetas</caption>
            <thead>
              <tr>
                <th>Receta</th>
                <th>Costo</th>
                <th>Food cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((recipe, index) => (
                <tr key={`${recipe.name}-${index}`}>
                  <td>
                    {recipe.detail ? (
                      <button
                        type="button"
                        className={ui.textButton}
                        onClick={() => openRecipe(recipe)}
                      >
                        {recipe.name}
                      </button>
                    ) : (
                      recipe.name
                    )}
                  </td>
                  <td>{recipe.cost}</td>
                  <td>{recipe.foodCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPage>
      <FormDialog
        open={open}
        eyebrow="Se abre desde recetas"
        title="Nueva receta"
        help="La receta entra a la lista. El costo y las líneas se arman al abrirla."
        submitLabel="Crear receta"
        fields={[
          { label: "Nombre", value: name, required: true, onChange: setName },
          { label: "Producto", value: product, onChange: setProduct },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          const trimmed = name.trim();
          setRows((current) => [
            {
              name:
                product.trim().length > 0
                  ? `${trimmed} · ${product.trim()}`
                  : trimmed,
              cost: "—",
              foodCost: "—",
              detail: false,
            },
            ...current,
          ]);
          setNotice(`${trimmed} queda en la lista de esta sesión.`);
          setOpen(false);
        }}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
  );
}
