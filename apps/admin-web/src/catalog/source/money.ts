export function formatCop(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

export function parseCop(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }
  return Number(digits);
}
