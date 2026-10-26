import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  comboComponents,
  combos,
  menus,
  modifiers,
  products,
  variants,
  venuePrices,
} from "#adapters/postgres/schema.js";
import { MenuRepository } from "#application/ports/menu-repository.js";
import { Menu } from "#domain/menu.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MenuRow = typeof menus.$inferSelect;
type VariantRow = typeof variants.$inferSelect;
type ModifierRow = typeof modifiers.$inferSelect;
type ComponentRow = typeof comboComponents.$inferSelect;
type VenuePriceRow = typeof venuePrices.$inferSelect;

export class DrizzleMenuRepository extends MenuRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(tenantId: string, brandId: string): Promise<Menu | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(menus)
        .where(eq(menus.brandId, brandId));

      if (rows.length === 0) {
        return null;
      }

      const menuRow = rows[0];

      if (
        menuRow === undefined ||
        rows.length !== 1 ||
        menuRow.tenantId !== tenantId
      ) {
        throw new Error("Stored menu does not match the tenant.");
      }

      return restoreMenu(tx, menuRow);
    });
  }

  override async save(menu: Menu): Promise<void> {
    await this.inTenant(menu.tenantId, async (tx) => {
      await deleteTree(tx, menu.tenantId, menu.id);
      await insertTree(tx, menu);
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE orders_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

async function deleteTree(
  tx: Transaction,
  tenantId: string,
  menuId: string,
): Promise<void> {
  await tx
    .delete(comboComponents)
    .where(
      and(
        eq(comboComponents.tenantId, tenantId),
        eq(comboComponents.menuId, menuId),
      ),
    );
  await tx
    .delete(modifiers)
    .where(and(eq(modifiers.tenantId, tenantId), eq(modifiers.menuId, menuId)));
  await tx
    .delete(variants)
    .where(and(eq(variants.tenantId, tenantId), eq(variants.menuId, menuId)));
  await tx
    .delete(combos)
    .where(and(eq(combos.tenantId, tenantId), eq(combos.menuId, menuId)));
  await tx
    .delete(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.menuId, menuId)));
  await tx
    .delete(venuePrices)
    .where(
      and(eq(venuePrices.tenantId, tenantId), eq(venuePrices.menuId, menuId)),
    );
  await tx
    .delete(menus)
    .where(and(eq(menus.tenantId, tenantId), eq(menus.id, menuId)));
}

async function insertTree(tx: Transaction, menu: Menu): Promise<void> {
  const tenantId = menu.tenantId;
  const menuId = menu.id;

  await tx.insert(menus).values({
    id: menuId,
    tenantId,
    brandId: menu.brandId,
  });

  const productRows = menu.products.map((product, position) => ({
    id: product.id,
    tenantId,
    menuId,
    name: product.name,
    price: product.price,
    taxClassification: product.taxClassification,
    position,
  }));

  if (productRows.length > 0) {
    await tx.insert(products).values(productRows);
  }

  const variantRows = menu.products.flatMap((product) =>
    product.variants.map((variant, position) => ({
      id: variant.id,
      tenantId,
      menuId,
      productId: product.id,
      name: variant.name,
      position,
    })),
  );

  if (variantRows.length > 0) {
    await tx.insert(variants).values(variantRows);
  }

  const modifierRows = menu.products.flatMap((product) =>
    product.modifiers.map((modifier, position) => ({
      id: modifier.id,
      tenantId,
      menuId,
      productId: product.id,
      name: modifier.name,
      price: modifier.price,
      position,
    })),
  );

  if (modifierRows.length > 0) {
    await tx.insert(modifiers).values(modifierRows);
  }

  const comboRows = menu.combos.map((combo, position) => ({
    id: combo.id,
    tenantId,
    menuId,
    name: combo.name,
    price: combo.price,
    position,
  }));

  if (comboRows.length > 0) {
    await tx.insert(combos).values(comboRows);
  }

  const componentRows = menu.combos.flatMap((combo) =>
    combo.componentIds.map((productId, position) => ({
      tenantId,
      menuId,
      comboId: combo.id,
      productId,
      position,
    })),
  );

  if (componentRows.length > 0) {
    await tx.insert(comboComponents).values(componentRows);
  }

  const priceRows = menu.venuePrices.map((venuePrice) => ({
    tenantId,
    menuId,
    venueId: venuePrice.venueId,
    itemId: venuePrice.itemId,
    price: venuePrice.price,
    available: venuePrice.available,
    windowStart: venuePrice.window?.start ?? null,
    windowEnd: venuePrice.window?.end ?? null,
  }));

  if (priceRows.length > 0) {
    await tx.insert(venuePrices).values(priceRows);
  }
}

async function restoreMenu(tx: Transaction, menuRow: MenuRow): Promise<Menu> {
  const productRows = await tx
    .select()
    .from(products)
    .where(eq(products.menuId, menuRow.id))
    .orderBy(asc(products.position));
  const variantRows = await tx
    .select()
    .from(variants)
    .where(eq(variants.menuId, menuRow.id))
    .orderBy(asc(variants.productId), asc(variants.position));
  const modifierRows = await tx
    .select()
    .from(modifiers)
    .where(eq(modifiers.menuId, menuRow.id))
    .orderBy(asc(modifiers.productId), asc(modifiers.position));
  const comboRows = await tx
    .select()
    .from(combos)
    .where(eq(combos.menuId, menuRow.id))
    .orderBy(asc(combos.position));
  const componentRows = await tx
    .select()
    .from(comboComponents)
    .where(eq(comboComponents.menuId, menuRow.id))
    .orderBy(asc(comboComponents.comboId), asc(comboComponents.position));
  const priceRows = await tx
    .select()
    .from(venuePrices)
    .where(eq(venuePrices.menuId, menuRow.id))
    .orderBy(asc(venuePrices.venueId), asc(venuePrices.itemId));
  const menu = Menu.open({
    id: menuRow.id,
    tenantId: menuRow.tenantId,
    brandId: menuRow.brandId,
  });

  for (const product of productRows) {
    menu.publishProduct({
      id: product.id,
      name: product.name,
      price: product.price,
      taxClassification: product.taxClassification,
      variants: variantsOf(variantRows, product.id),
      modifiers: modifiersOf(modifierRows, product.id),
    });
  }

  for (const combo of comboRows) {
    menu.publishCombo({
      id: combo.id,
      name: combo.name,
      price: combo.price,
      componentIds: componentsOf(componentRows, combo.id),
    });
  }

  for (const price of priceRows) {
    menu.setVenuePrice(venuePriceOf(price));
  }

  return menu;
}

function variantsOf(
  rows: readonly VariantRow[],
  productId: string,
): { id: string; name: string }[] {
  return rows
    .filter((row) => row.productId === productId)
    .map((row) => ({ id: row.id, name: row.name }));
}

function modifiersOf(
  rows: readonly ModifierRow[],
  productId: string,
): { id: string; name: string; price: number }[] {
  return rows
    .filter((row) => row.productId === productId)
    .map((row) => ({ id: row.id, name: row.name, price: row.price }));
}

function componentsOf(
  rows: readonly ComponentRow[],
  comboId: string,
): string[] {
  return rows
    .filter((row) => row.comboId === comboId)
    .map((row) => row.productId);
}

function venuePriceOf(row: VenuePriceRow) {
  return {
    venueId: row.venueId,
    itemId: row.itemId,
    price: row.price,
    available: row.available,
    ...(row.windowStart !== null && row.windowEnd !== null
      ? { window: { start: row.windowStart, end: row.windowEnd } }
      : {}),
  };
}
