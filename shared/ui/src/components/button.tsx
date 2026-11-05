import type { ButtonHTMLAttributes, ReactNode } from "react";
import { joinClasses } from "#ui/join-classes.js";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-action text-on-strong hover:bg-action-pressed",
  secondary:
    "border-2 border-border bg-surface-raised text-ink hover:bg-surface",
  danger: "bg-danger text-on-strong hover:brightness-90",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-5 text-body font-semibold transition-colors duration-150 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
}

export function IconButton({
  label,
  icon,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant="secondary"
      aria-label={label}
      className={joinClasses("size-12 px-0", className)}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
  );
}
