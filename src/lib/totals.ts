import { Decimal } from "decimal.js";

export type CartLine = {
  unitPrice: number;
  qty: number;
  taxRate: number; // percent
};

export type CartTotals = {
  subtotal: number;
  taxTotal: number;
  total: number;
};

export function computeTotals(
  lines: CartLine[],
  opts: { discount?: number; serviceCharge?: number; packagingCharge?: number } = {},
): CartTotals {
  let subtotal = new Decimal(0);
  let taxTotal = new Decimal(0);

  for (const l of lines) {
    const lineSub = new Decimal(l.unitPrice).mul(l.qty);
    const lineTax = lineSub.mul(l.taxRate).div(100);
    subtotal = subtotal.plus(lineSub);
    taxTotal = taxTotal.plus(lineTax);
  }

  const discount = new Decimal(opts.discount ?? 0);
  const serviceCharge = new Decimal(opts.serviceCharge ?? 0);
  const packagingCharge = new Decimal(opts.packagingCharge ?? 0);
  const total = subtotal
    .plus(taxTotal)
    .plus(serviceCharge)
    .plus(packagingCharge)
    .minus(discount);

  return {
    subtotal: subtotal.toDecimalPlaces(2).toNumber(),
    taxTotal: taxTotal.toDecimalPlaces(2).toNumber(),
    total: total.toDecimalPlaces(2).toNumber(),
  };
}
