import type { ReactNode } from "react";
import { Button } from "#ui/components/button.js";
import { joinClasses } from "#ui/join-classes.js";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={joinClasses(
        "animate-pulse rounded-xl bg-border/30 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <section className="grid justify-items-center gap-2 py-10 text-center">
      <h2 className="font-display text-title text-ink">{title}</h2>
      {children ? <p className="text-ink-muted">{children}</p> : null}
    </section>
  );
}

export interface ScreenErrorProps {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ScreenError({
  title,
  message,
  onRetry,
  retryLabel = "Reintentar",
}: ScreenErrorProps) {
  return (
    <div
      role="alert"
      className="grid gap-4 rounded-2xl border-2 border-danger bg-surface-raised p-5"
    >
      <h2 className="font-display text-title text-danger">{title}</h2>
      <p className="text-ink">{message}</p>
      {onRetry ? (
        <Button variant="danger" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
