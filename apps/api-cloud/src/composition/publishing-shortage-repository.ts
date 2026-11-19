import { shortageNotice } from "@blackhole/contracts";
import { DrizzleShortageRepository } from "@blackhole/inventory/adapters/postgres/drizzle-shortage-repository";

import type { ShortageNoticeHub } from "#src/http/shortage-notice-hub.js";

type ShortageClient = ConstructorParameters<
  typeof DrizzleShortageRepository
>[0];
type RoleNotice = Parameters<DrizzleShortageRepository["saveRoleNotice"]>[0];

export class PublishingShortageRepository extends DrizzleShortageRepository {
  constructor(
    client: ShortageClient,
    private readonly hub: ShortageNoticeHub,
  ) {
    super(client);
  }

  override async saveRoleNotice(notice: RoleNotice): Promise<void> {
    await super.saveRoleNotice(notice);
    const parsed = shortageNotice.safeParse({
      alertId: notice.alertId,
      kind: notice.kind,
      severity: notice.severity,
      role: notice.role,
      venueId: notice.venueId,
    });

    if (parsed.success) {
      this.hub.publish(parsed.data);
    }
  }
}
