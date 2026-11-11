import { useNavigate, useParams } from "@tanstack/react-router";
import { ProductView } from "#src/catalog/product/product-view.js";
import {
  useDuplicateProduct,
  useProduct,
  useSaveProduct,
  useVenues,
} from "#src/catalog/source/use-admin.js";
import { TopBar } from "#src/shell/top-bar.js";

export function ProductScreen() {
  const { productId } = useParams({ from: "/catalog/menu/$productId" });
  const product = useProduct(productId);
  const venues = useVenues();
  const save = useSaveProduct(productId);
  const duplicate = useDuplicateProduct();
  const navigate = useNavigate();

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
              void navigate({ to: "/catalog/menu" });
              return;
            }
            void navigate({
              to: "/catalog/venues/$venueId",
              params: { venueId },
            });
          },
        }}
      />
      <ProductView
        product={product.data}
        isPending={product.isPending}
        isError={product.isError}
        isSaving={save.isPending}
        isDuplicating={duplicate.isPending}
        onSave={(draft) => save.mutateAsync(draft)}
        onDuplicate={(id) => {
          duplicate.mutate(id, {
            onSuccess: (copy) => {
              void navigate({
                to: "/catalog/menu/$productId",
                params: { productId: copy.id },
              });
            },
          });
        }}
      />
    </>
  );
}
