import type { Menu } from "#domain/menu.js";

export abstract class MenuRepository {
  abstract load(tenantId: string, brandId: string): Promise<Menu | null>;

  abstract save(menu: Menu): Promise<void>;
}
