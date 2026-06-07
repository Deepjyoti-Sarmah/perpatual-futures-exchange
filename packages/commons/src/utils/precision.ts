// 1 human unit = 10_000 internal units  (supports 4 decimal places)
// e.g.  price 50.5  →  505_000
//       qty   0.004 →       40
// Always store/compute with these integers. Divide only at display time.

export const PRICE_SCALE = 10_000; // for prices and margins
export const QTY_SCALE = 10_000; // for quantities

export function toInternalPrice(human: number): number {
  return Math.round(human * PRICE_SCALE);
}

export function toInternalQty(human: number): number {
  return Math.round(human * QTY_SCALE);
}

export function toHumanPrice(internal: number): number {
  return internal / PRICE_SCALE;
}

export function toHumanQty(internal: number): number {
  return internal / QTY_SCALE;
}

// Multiply two internal values and keep units correct.
// e.g.  notional = mulInternal(price, qty)  →  still in internal units
export function mullInternal(a: number, b: number): number {
  return Math.round((a * b) / PRICE_SCALE);
}
