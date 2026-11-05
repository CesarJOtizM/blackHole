import type { ReactNode } from "react";
import { joinClasses } from "#ui/join-classes.js";

export type ChipTone =
  | "free"
  | "occupied"
  | "check-requested"
  | "to-clean"
  | "ready"
  | "danger";

const toneClasses: Record<ChipTone, string> = {
  free: "border border-border bg-table-free text-ink",
  occupied: "bg-table-occupied text-on-strong",
  "check-requested": "bg-table-check text-ink",
  "to-clean": "bg-table-clean text-on-strong",
  ready: "bg-ready text-on-strong",
  danger: "bg-danger text-on-strong",
};

export interface StatusChipProps {
  tone: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
}

export function StatusChip({ tone, icon, children }: StatusChipProps) {
  return (
    <span
      className={joinClasses(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-base font-semibold",
        toneClasses[tone],
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
