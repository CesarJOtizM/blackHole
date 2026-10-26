import { MenuRepository } from "#application/ports/menu-repository.js";
import type { Menu } from "#domain/menu.js";

export class InMemoryMenuRepository extends MenuRepository {
  private readonly menus = new Map<string, Menu>();

  override async load(tenantId: string, brandId: string): Promise<Menu | null> {
    return this.menus.get(this.key(tenantId, brandId)) ?? null;
  }

  override async save(menu: Menu): Promise<void> {
    this.menus.set(this.key(menu.tenantId, menu.brandId), menu);
  }

  private key(tenantId: string, brandId: string): string {
    return `${tenantId}\u0000${brandId}`;
  }
}
