import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { router } from "#src/router.js";
import { TablePaymentScreen } from "#src/table-payment/table-payment-screen.js";

it("given part 1 is paid, when /d/:token is shown, then part 2 stays payable and /m stays the order route", () => {
  const paths = Object.keys(router.routesByPath);

  expect(paths).toContain("/d/$token");
  expect(paths).toContain("/m/$token");
  expect(paths).toContain("/f/$link");
  render(
    <TablePaymentScreen
      token="pre-bill-token"
      balanceCop={85_000}
      parts={[
        { partId: "part_1", balanceCop: 45_000, paid: true },
        { partId: "part_2", balanceCop: 40_000, paid: false },
      ]}
    />,
  );

  expect(screen.getByRole("status").textContent).toMatch(/ocupada/i);
  expect(screen.getByText("$40.000")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pagar parte 2" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Pagar parte 1" })).toBeNull();
});
