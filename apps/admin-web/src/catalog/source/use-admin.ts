import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminSource } from "#src/catalog/source/admin-source.js";
import type {
  BrandId,
  CategoryId,
  ProductDraft,
  QrSettings,
} from "#src/catalog/source/types.js";

const source = getAdminSource();

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: () => source.listBrands(),
  });
}

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: () => source.listVenues(),
  });
}

export function useCategories(brandId: BrandId) {
  return useQuery({
    queryKey: ["categories", brandId],
    queryFn: () => source.listCategories(brandId),
  });
}

export function useProductCount(brandId: BrandId) {
  return useQuery({
    queryKey: ["product-count", brandId],
    queryFn: () => source.countProducts(brandId),
  });
}

export function useProducts(brandId: BrandId, categoryId: CategoryId) {
  return useQuery({
    queryKey: ["products", brandId, categoryId],
    queryFn: () => source.listProducts(brandId, categoryId),
  });
}

export function useModifierGroups(brandId: BrandId) {
  return useQuery({
    queryKey: ["modifiers", brandId],
    queryFn: () => source.listModifierGroups(brandId),
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: () => source.getProduct(productId),
  });
}

export function useSaveProduct(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ProductDraft) => source.saveProduct(productId, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDuplicateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => source.duplicateProduct(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["product-count"] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { brandId: BrandId; categoryId: CategoryId }) =>
      source.createProduct(input.brandId, input.categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["product-count"] });
    },
  });
}

export function useImportProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { brandId: BrandId; categoryId: CategoryId }) =>
      source.importSampleProduct(input.brandId, input.categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      await queryClient.invalidateQueries({ queryKey: ["product-count"] });
    },
  });
}

export function useVenueOffers(venueId: string) {
  return useQuery({
    queryKey: ["venue-offers", venueId],
    queryFn: () => source.listVenueOffers(venueId),
  });
}

export function useRemoveVenueOffer(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      source.removeVenueOffer(venueId, productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["venue-offers", venueId],
      });
    },
  });
}

export function useReactivateVenueOffer(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      source.reactivateVenueOffer(venueId, productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["venue-offers", venueId],
      });
    },
  });
}

export function useZones(venueId: string) {
  return useQuery({
    queryKey: ["zones", venueId],
    queryFn: () => source.listZones(venueId),
  });
}

export function useTables(venueId: string, zoneId: string) {
  return useQuery({
    queryKey: ["tables", venueId, zoneId],
    queryFn: () => source.listTables(venueId, zoneId),
    enabled: zoneId.length > 0,
  });
}

export function useAddTable(venueId: string, zoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => source.addTable(venueId, zoneId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tables", venueId, zoneId],
      });
    },
  });
}

export function useRegenerateQr(venueId: string, zoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => source.regenerateQr(tableId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tables", venueId, zoneId],
      });
    },
  });
}

export function useQrSettings(venueId: string) {
  return useQuery({
    queryKey: ["qr-settings", venueId],
    queryFn: () => source.getQrSettings(venueId),
  });
}

export function useSaveQrSettings(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: QrSettings) => source.saveQrSettings(settings),
    onSuccess: async (settings) => {
      queryClient.setQueryData(["qr-settings", venueId], settings);
    },
  });
}
