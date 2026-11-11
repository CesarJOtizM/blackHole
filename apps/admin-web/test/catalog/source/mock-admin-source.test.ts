import { describe, expect, it } from "vitest";
import { createMockAdminSource } from "#src/catalog/source/mock-admin-source.js";
import type { ProductDraft } from "#src/catalog/source/types.js";

describe("createMockAdminSource", () => {
  it("Given the churrasco, When the menu name is saved, Then the catalog returns that name", async () => {
    const source = createMockAdminSource();
    const current = await source.getProduct("churrasco");
    if (current === null) {
      throw new Error("Missing churrasco");
    }

    await source.saveProduct(
      "churrasco",
      draftFrom(current, "Churrasco de la casa"),
    );

    const saved = await source.getProduct("churrasco");
    expect(saved?.name).toBe("Churrasco de la casa");
  });

  it("Given a sold-out offer in Usaquén, When it is reactivated, Then it is available", async () => {
    const source = createMockAdminSource();

    await source.reactivateVenueOffer("usaquen", "entrana");

    const offers = await source.listVenueOffers("usaquen");
    const offer = offers.find((item) => item.productId === "entrana");
    expect(offer?.availability).toBe("yes");
    expect(offer?.availabilityLabel).toBe("Sí");
  });

  it("Given mesa 08, When the QR is regenerated, Then the version increases", async () => {
    const source = createMockAdminSource();

    const next = await source.regenerateQr("chapinero-08");

    expect(next.qrVersion).toBe(4);
    expect(next.qrCode).toBe("blackhole.co/m/chapinero-08-v4");
  });
});

function draftFrom(
  product: {
    ticketName: string;
    price: number;
    tax: string;
    station: string;
    targetMinutes: number;
    channels: ProductDraft["channels"];
  },
  menuName: string,
): ProductDraft {
  return {
    menuName,
    ticketName: product.ticketName,
    price: product.price,
    tax: product.tax,
    station: product.station,
    targetMinutes: product.targetMinutes,
    channels: product.channels,
  };
}
