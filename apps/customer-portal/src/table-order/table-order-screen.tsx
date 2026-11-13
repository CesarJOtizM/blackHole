import { Button } from "@blackhole/ui";
import { useEffect, useState } from "react";
import { readOrderStatus, readTableMenu } from "#src/cloud.js";

export interface TableOrderProduct {
  id: string;
  name: string;
  price: number;
  orderable: boolean;
}

export interface PresentedTableOrderProduct {
  id: string;
  name: string;
  priceLabel: string;
  orderable: boolean;
}

const priceLabel = (price: number): string =>
  `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(price)}`;

export const presentTableOrderMenu = (
  products: readonly TableOrderProduct[],
): PresentedTableOrderProduct[] =>
  products.map((product) => ({
    id: product.id,
    name: product.name,
    priceLabel: priceLabel(product.price),
    orderable: product.orderable,
  }));

const SITE_MENU: readonly TableOrderProduct[] = [
  { id: "menu_product_soup", name: "Sopa", price: 22_000, orderable: true },
  {
    id: "menu_product_steak",
    name: "Churrasco",
    price: 48_000,
    orderable: false,
  },
];

export function TableOrderScreen({
  token,
  acceptance = "pending",
}: {
  token: string;
  acceptance?: "pending" | "rejected";
}) {
  const [menuSource, setMenuSource] =
    useState<readonly TableOrderProduct[]>(SITE_MENU);
  const [cloudAcceptance, setCloudAcceptance] = useState(acceptance);
  const menu = presentTableOrderMenu(menuSource);
  const [cart, setCart] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;

    void fetch(`/m/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return readTableMenu(await response.json());
      })
      .then((products) => {
        if (active && products !== null) {
          setMenuSource(products);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [token]);

  function removeUnsent(productId: string) {
    setCart((current) => {
      const index = current.indexOf(productId);
      if (index < 0) {
        return current;
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function sendOrder() {
    const intentId = `intent_${crypto.randomUUID()}`;
    const lines = cart.map((productId) => ({
      productId,
      variantIds: [],
      modifierIds: [],
    }));

    setCart([]);
    setSent(true);
    void fetch(`/m/${token}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intentId, lines }),
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const statusResponse = await fetch(`/m/${token}/orders/${intentId}`);

        if (!statusResponse.ok) {
          return;
        }

        if (readOrderStatus(await statusResponse.json()) === "rejected") {
          setCloudAcceptance("rejected");
          setSent(false);
        }
      })
      .catch(() => undefined);
  }

  return (
    <main className="mx-auto grid min-h-svh max-w-lg gap-6 px-4 py-8">
      <header className="grid gap-1">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          Mesa {token}
        </p>
        <h1 className="font-display text-title">Pide en la mesa</h1>
        <p className="text-ink-muted">
          El precio es el de este local. Pagas en caja.
        </p>
      </header>
      <ul className="grid gap-3">
        {menu.map((product) => (
          <li
            key={product.id}
            className="flex items-center justify-between gap-3"
          >
            <span>
              {product.name}
              <span className="block font-mono">{product.priceLabel}</span>
            </span>
            {product.orderable ? (
              <Button
                onClick={() => setCart((current) => [...current, product.id])}
              >
                Sumar
              </Button>
            ) : (
              <span>Agotado</span>
            )}
          </li>
        ))}
      </ul>
      {cart.length > 0 ? (
        <ul aria-label="Pedido sin enviar" className="grid gap-2">
          {cart.map((productId, index) => {
            const product = menu.find((item) => item.id === productId);
            return (
              <li
                key={`${productId}-${index}`}
                className="flex items-center justify-between gap-3"
              >
                <span>{product?.name}</span>
                <Button
                  variant="secondary"
                  onClick={() => removeUnsent(productId)}
                >
                  Quitar
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Button
        disabled={cart.length === 0 || sent || cloudAcceptance === "rejected"}
        onClick={sendOrder}
      >
        Enviar pedido
      </Button>
      {cloudAcceptance === "rejected" ? (
        <p role="status">El pedido no fue aceptado.</p>
      ) : sent ? (
        <p role="status">Pedido enviado a cocina.</p>
      ) : null}
    </main>
  );
}
