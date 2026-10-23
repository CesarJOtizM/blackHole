import type { StructureCommand } from "@blackhole/contracts";

export const samplePilotLabel = "sample";

export const samplePilotTenantId = "organization_sample_company";

export const samplePilotActorId = "organization_sample_actor";

const SAMPLE_PILOT_NIT = {
  ONE: "SAMPLE-NIT-01",
  TWO: "SAMPLE-NIT-02",
  THREE: "SAMPLE-NIT-03",
  FOUR: "SAMPLE-NIT-04",
  FIVE: "SAMPLE-NIT-05",
  SIX: "SAMPLE-NIT-06",
} as const;

const samplePilotNits = [
  SAMPLE_PILOT_NIT.ONE,
  SAMPLE_PILOT_NIT.TWO,
  SAMPLE_PILOT_NIT.THREE,
  SAMPLE_PILOT_NIT.FOUR,
  SAMPLE_PILOT_NIT.FIVE,
  SAMPLE_PILOT_NIT.SIX,
] as const;

const samplePilotBrandId = "organization_sample_brand";

export function samplePilotCommands(): readonly StructureCommand[] {
  const commands: StructureCommand[] = [
    {
      type: "registerCompany",
      id: samplePilotTenantId,
      name: samplePilotLabel,
    },
    {
      type: "addBrand",
      id: samplePilotBrandId,
      name: samplePilotLabel,
    },
  ];

  for (const [index, nit] of samplePilotNits.entries()) {
    const number = index + 1;

    commands.push({
      type: "addTaxpayer",
      id: `organization_sample_taxpayer_${number}`,
      nit,
      taxProfileId: "profile-sample",
    });
  }

  for (const [index] of samplePilotNits.entries()) {
    const number = index + 1;

    commands.push({
      type: "openVenue",
      id: `organization_sample_venue_${number}`,
      name: `${samplePilotLabel}-${number}`,
      brandId: samplePilotBrandId,
      taxpayerId: `organization_sample_taxpayer_${number}`,
      pointId: `organization_sample_point_${number}`,
    });
  }

  return commands;
}
