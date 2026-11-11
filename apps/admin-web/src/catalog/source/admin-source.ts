import { createMockAdminSource } from "#src/catalog/source/mock-admin-source.js";
import type { AdminSource } from "#src/catalog/source/types.js";

let source: AdminSource | undefined;

export function getAdminSource(): AdminSource {
  source ??= createMockAdminSource();
  return source;
}
