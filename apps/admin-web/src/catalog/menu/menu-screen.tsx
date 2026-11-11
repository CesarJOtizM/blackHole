import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { type MenuSection, MenuView } from "#src/catalog/menu/menu-view.js";
import type { BrandId, CategoryId } from "#src/catalog/source/types.js";
import {
  useBrands,
  useCategories,
  useCreateProduct,
  useImportProduct,
  useModifierGroups,
  useProductCount,
  useProducts,
  useVenues,
} from "#src/catalog/source/use-admin.js";
import { TopBar } from "#src/shell/top-bar.js";

export function MenuScreen() {
  const navigate = useNavigate();
  const brands = useBrands();
  const venues = useVenues();
  const [brandId, setBrandId] = useState<BrandId>("la-parrilla");
  const [section, setSection] = useState<MenuSection>("products");
  const [categoryId, setCategoryId] = useState<CategoryId>("cuts");
  const categories = useCategories(brandId);
  const products = useProducts(brandId, categoryId);
  const groups = useModifierGroups(brandId);
  const productCount = useProductCount(brandId);
  const createProduct = useCreateProduct();
  const importProduct = useImportProduct();
  const brand = brands.data?.find((item) => item.id === brandId);
  const category = categories.data?.find((item) => item.id === categoryId);

  return (
    <>
      <TopBar
        current="menu"
        venue={{
          value: "all",
          options: [
            { value: "all", label: "Todas las sedes" },
            ...(venues.data ?? []).map((venue) => ({
              value: venue.id,
              label: venue.label,
            })),
          ],
          onChange: (venueId) => {
            if (venueId === "all") {
              return;
            }
            void navigate({
              to: "/catalog/venues/$venueId",
              params: { venueId },
            });
          },
        }}
      />
      <MenuView
        brandLabel={brand?.label ?? "Marca"}
        productCount={productCount.data ?? 0}
        section={section}
        brandId={brandId}
        brands={brands.data ?? []}
        categoryId={categoryId}
        categories={categories.data ?? []}
        products={products.data ?? []}
        productsPending={products.isPending}
        productsError={products.isError}
        categoryName={category?.name ?? "Productos"}
        groups={groups.data ?? []}
        importPending={importProduct.isPending}
        importDone={importProduct.isSuccess}
        createPending={createProduct.isPending}
        onBrand={(nextBrand) => {
          setBrandId(nextBrand);
          setSection("products");
        }}
        onSection={setSection}
        onCategory={setCategoryId}
        onImport={() => {
          importProduct.mutate({ brandId, categoryId });
        }}
        onCreate={() => {
          createProduct.mutate(
            { brandId, categoryId },
            {
              onSuccess: (created) => {
                void navigate({
                  to: "/catalog/menu/$productId",
                  params: { productId: created.id },
                });
              },
            },
          );
        }}
        onOpenProduct={(productId) => {
          void navigate({
            to: "/catalog/menu/$productId",
            params: { productId },
          });
        }}
      />
    </>
  );
}
