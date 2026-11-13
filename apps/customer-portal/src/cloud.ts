export interface CloudMenuProduct {
  id: string;
  name: string;
  price: number;
  orderable: boolean;
}

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

export const readTableMenu = (body: unknown): CloudMenuProduct[] | null => {
  const record = readRecord(body);
  const products = record?.products;

  if (!Array.isArray(products)) {
    return null;
  }

  const menu = products.flatMap((item) => {
    const product = readRecord(item);

    if (
      product === null ||
      typeof product.id !== "string" ||
      typeof product.name !== "string" ||
      typeof product.price !== "number" ||
      typeof product.orderable !== "boolean"
    ) {
      return [];
    }

    return [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        orderable: product.orderable,
      },
    ];
  });

  return menu.length === 0 ? null : menu;
};

export const readOrderStatus = (
  body: unknown,
): "pending_acceptance" | "applied" | "rejected" | "none" | null => {
  const record = readRecord(body);

  if (
    record === null ||
    (record.status !== "none" &&
      record.status !== "pending_acceptance" &&
      record.status !== "applied" &&
      record.status !== "rejected")
  ) {
    return null;
  }

  return record.status;
};

export const readBuyerName = (body: unknown): string | null => {
  const record = readRecord(body);

  if (
    record === null ||
    record.outcome !== "found" ||
    typeof record.maskedName !== "string"
  ) {
    return null;
  }

  return record.maskedName;
};
