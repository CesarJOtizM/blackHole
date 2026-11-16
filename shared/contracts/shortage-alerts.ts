import { z } from "zod";

const SHORTAGE_KIND = {
  LEVEL: "level",
  COVERAGE: "coverage",
  DISH: "dish",
} as const;

const LEVEL_SEVERITY = {
  YELLOW: "yellow",
  RED: "red",
  CRITICAL: "critical",
} as const;

const NOTICE_ROLE = {
  SITE_ADMINISTRATOR: "siteAdministrator",
  GENERAL_MANAGER: "generalManager",
} as const;

export const shortageNotice = z
  .object({
    alertId: z.string().min(1),
    kind: z.enum(SHORTAGE_KIND),
    severity: z.enum(LEVEL_SEVERITY),
    role: z.enum(NOTICE_ROLE),
    venueId: z.string().min(1),
  })
  .strict();

export type ShortageNotice = z.infer<typeof shortageNotice>;
