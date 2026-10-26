import { expect, it } from "vitest";

import {
  AttendanceAudit,
  type AttendanceAuditCommand,
} from "#application/ports/attendance-audit.js";
import {
  type AttendancePolicy,
  AttendancePolicyRepository,
  defaultAttendancePolicy,
} from "#application/ports/attendance-policy-repository.js";
import {
  InvalidAttendancePolicy,
  SetVenueAttendancePolicy,
} from "#application/set-venue-attendance-policy/set-venue-attendance-policy.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const ACTOR_ID = "user_admin";
const DEVICE_ID = "device_admin";

class MemoryPolicies extends AttendancePolicyRepository {
  readonly rows: AttendancePolicy[] = [];

  override async find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null> {
    return (
      this.rows.find(
        (row) => row.tenantId === tenantId && row.venueId === venueId,
      ) ?? null
    );
  }

  override async save(policy: AttendancePolicy): Promise<void> {
    const index = this.rows.findIndex(
      (row) =>
        row.tenantId === policy.tenantId && row.venueId === policy.venueId,
    );

    if (index === -1) {
      this.rows.push(policy);
      return;
    }

    this.rows[index] = policy;
  }
}

class MemoryAudit extends AttendanceAudit {
  readonly commands: AttendanceAuditCommand[] = [];

  override async record(command: AttendanceAuditCommand): Promise<void> {
    this.commands.push(command);
  }
}

const enableRule = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: ACTOR_ID,
  authorizerId: null,
  deviceId: DEVICE_ID,
  geofence: null,
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled: true,
  mode: "hours_only" as const,
};

it("given no policy, when an administrator enables the rule, then it is stored and the audit shows the rule was off", async () => {
  const policies = new MemoryPolicies();
  const audits = new MemoryAudit();
  const setPolicy = new SetVenueAttendancePolicy(policies, audits);

  expect(await policies.find(TENANT_ID, VENUE_ID)).toBeNull();
  expect(
    defaultAttendancePolicy(TENANT_ID, VENUE_ID).operationRuleEnabled,
  ).toBe(false);

  await setPolicy.execute(enableRule);

  expect(await policies.find(TENANT_ID, VENUE_ID)).toEqual(
    expect.objectContaining({
      operationRuleEnabled: true,
      toleranceMinutes: 10,
      closeTime: "22:00",
      mode: "hours_only",
    }),
  );
  expect(audits.commands).toEqual([
    expect.objectContaining({
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: "attendance.policy",
      entity: VENUE_ID,
      before: expect.objectContaining({ operationRuleEnabled: false }),
      after: expect.objectContaining({ operationRuleEnabled: true }),
    }),
  ]);
});

it("given a negative tolerance, when the policy is set, then nothing is stored and the audit is not called", async () => {
  const policies = new MemoryPolicies();
  const audits = new MemoryAudit();
  const setPolicy = new SetVenueAttendancePolicy(policies, audits);

  await expect(
    setPolicy.execute({ ...enableRule, toleranceMinutes: -1 }),
  ).rejects.toBeInstanceOf(InvalidAttendancePolicy);
  expect(policies.rows).toEqual([]);
  expect(audits.commands).toEqual([]);
});
