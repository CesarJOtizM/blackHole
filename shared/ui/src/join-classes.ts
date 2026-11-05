type ClassPart = string | false | null | undefined;

export function joinClasses(...parts: ClassPart[]): string {
  return parts.filter(Boolean).join(" ");
}
