import { formatCop } from "#src/catalog/source/money.js";
import type {
  Brand,
  BrandId,
  Category,
  CategoryId,
  MenuProduct,
  ModifierGroup,
} from "#src/catalog/source/types.js";
import { ProductStatusChip } from "#src/catalog/status-chip.js";
import styles from "#src/styles/catalog/menu.module.scss";
import ui from "#src/styles/ui.module.scss";

export type MenuSection = "products" | "modifiers" | "categories";

export interface MenuViewProps {
  brandLabel: string;
  productCount: number;
  section: MenuSection;
  brandId: BrandId;
  brands: Brand[];
  categoryId: CategoryId;
  categories: Category[];
  products: MenuProduct[];
  productsPending: boolean;
  productsError: boolean;
  categoryName: string;
  groups: ModifierGroup[];
  importPending: boolean;
  importDone: boolean;
  createPending: boolean;
  onBrand: (brandId: BrandId) => void;
  onSection: (section: MenuSection) => void;
  onCategory: (categoryId: CategoryId) => void;
  onImport: () => void;
  onCreate: () => void;
  onOpenProduct: (productId: string) => void;
}

export function MenuView({
  brandLabel,
  productCount,
  section,
  brandId,
  brands,
  categoryId,
  categories,
  products,
  productsPending,
  productsError,
  categoryName,
  groups,
  importPending,
  importDone,
  createPending,
  onBrand,
  onSection,
  onCategory,
  onImport,
  onCreate,
  onOpenProduct,
}: MenuViewProps) {
  return (
    <div className={styles.content}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>
            {brandLabel} · {productCount} productos
          </p>
          <h1 className={ui.title}>Carta</h1>
        </div>
        {section === "products" ? (
          <div className={ui.actions}>
            <button
              type="button"
              className={ui.buttonGhost}
              disabled={importPending}
              onClick={onImport}
            >
              Importar Excel
            </button>
            <button
              type="button"
              className={ui.button}
              disabled={createPending}
              onClick={onCreate}
            >
              Nuevo producto
            </button>
          </div>
        ) : null}
      </header>
      <ul className={ui.tabs}>
        {brands.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={
                section === "products" && item.id === brandId
                  ? ui.tabActive
                  : ui.tab
              }
              onClick={() => onBrand(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={section === "modifiers" ? ui.tabActive : ui.tab}
            onClick={() => onSection("modifiers")}
          >
            Modificadores
          </button>
        </li>
        <li>
          <button
            type="button"
            className={section === "categories" ? ui.tabActive : ui.tab}
            onClick={() => onSection("categories")}
          >
            Categorías
          </button>
        </li>
      </ul>
      {section === "products" ? (
        <div className={styles.layout}>
          <div>
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.id === categoryId
                    ? styles.categoryActive
                    : styles.category
                }
                aria-current={item.id === categoryId ? "true" : undefined}
                onClick={() => onCategory(item.id)}
              >
                <span>{item.name}</span>
                <span className={styles.count}>{item.productCount}</span>
              </button>
            ))}
          </div>
          <ProductTable
            title={categoryName}
            isPending={productsPending}
            isError={productsError}
            products={products}
            onOpenProduct={onOpenProduct}
          />
        </div>
      ) : null}
      {section === "modifiers" ? <ModifierTable groups={groups} /> : null}
      {section === "categories" ? (
        <CategoryTable categories={categories} />
      ) : null}
      {importDone ? (
        <p className={ui.note} role="status">
          Se agregó un producto de muestra. La importación real reemplaza este
          resultado cuando el archivo llegue al servidor.
        </p>
      ) : null}
    </div>
  );
}

function ProductTable({
  title,
  isPending,
  isError,
  products,
  onOpenProduct,
}: {
  title: string;
  isPending: boolean;
  isError: boolean;
  products: MenuProduct[];
  onOpenProduct: (productId: string) => void;
}) {
  if (isPending) {
    return <p className={ui.note}>Cargando la carta</p>;
  }
  if (isError) {
    return <p className={ui.error}>No se pudo leer la carta.</p>;
  }
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <caption className="srOnly">{title}</caption>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>IVA/INC</th>
            <th>Estación</th>
            <th>Modif.</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {products.map((item) => (
            <tr key={item.id}>
              <td>
                <button
                  type="button"
                  className={ui.nameLink}
                  onClick={() => onOpenProduct(item.id)}
                >
                  {item.name}
                </button>
              </td>
              <td className={ui.money}>{formatCop(item.price)}</td>
              <td className={ui.meta}>{item.tax}</td>
              <td className={ui.meta}>{item.station}</td>
              <td className={ui.meta}>{item.modifierCount}</td>
              <td>
                <ProductStatusChip
                  status={item.status}
                  venueName={item.venueName}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 ? (
        <p className={ui.empty}>Esta categoría no tiene productos.</p>
      ) : null}
    </div>
  );
}

function ModifierTable({ groups }: { groups: ModifierGroup[] }) {
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <caption className="srOnly">Modificadores de la marca</caption>
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Regla</th>
            <th>Opciones</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td>{group.group}</td>
              <td className={ui.meta}>{group.rule}</td>
              <td className={ui.meta}>{group.options}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {groups.length === 0 ? (
        <p className={ui.empty}>Esta marca no tiene modificadores.</p>
      ) : null}
    </div>
  );
}

function CategoryTable({ categories }: { categories: Category[] }) {
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <caption className="srOnly">Categorías de la carta</caption>
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Productos</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td className={ui.meta}>{item.productCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
