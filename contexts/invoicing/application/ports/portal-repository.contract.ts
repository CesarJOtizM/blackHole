import { expect, it } from "vitest";

import type {
  PortalRepository,
  StoredPortalReinvoiceRequest,
} from "#application/ports/portal-repository.js";

export interface PortalRepositoryHarness {
  repository(): PortalRepository;
  row(): StoredPortalReinvoiceRequest;
  otherCompanyId(): string;
}

export function portalRepositoryContract(
  open: () => PortalRepositoryHarness | Promise<PortalRepositoryHarness>,
): void {
  it("given a pending re-invoice request, when it is saved, then the same company finds it and another company does not", async () => {
    const opened = await open();
    const row = opened.row();
    const repository = opened.repository();

    await repository.save(row);

    expect(await repository.find(row.companyId, row.invoiceNumber)).toEqual(
      row,
    );
    expect(
      await repository.find(opened.otherCompanyId(), row.invoiceNumber),
    ).toBeNull();
  });
}
