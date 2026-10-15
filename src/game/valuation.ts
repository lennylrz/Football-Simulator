import type { Meta, Row } from './data';

function model(meta: Meta, ovr: number, age: number, pot: number): number {
  const [c0, c1, c2, c3, c4, c5] = meta.valueModel.coef;
  const o = ovr - 70;
  const a = age - 25;
  return c0 + c1 * o + c2 * o * o + c3 * a + c4 * a * a + c5 * Math.max(0, pot - ovr);
}

/**
 * Market value in €k. Uses the fitted value model, shifted by how far the
 * player's real value sat above or below the model that season (so stars
 * with a real premium keep it).
 */
export function marketValue(meta: Meta, ovr: number, age: number, pot: number, real?: Row): number {
  let premium = 0;
  if (real && real[3] > 0) {
    premium = Math.log(real[3]) - model(meta, real[0], real[2], real[1]);
    premium = Math.max(-1, Math.min(1, premium));
  }
  const v = Math.exp(model(meta, ovr, age, pot) + premium);
  return roundFee(v);
}

/** Round a fee in €k to a sensible step. */
export function roundFee(k: number): number {
  const step = k >= 10_000 ? 500 : k >= 1_000 ? 100 : 25;
  return Math.max(step, Math.round(k / step) * step);
}

export function formatMoney(k: number): string {
  const sign = k < 0 ? '-' : '';
  const a = Math.abs(k);
  if (a >= 1000) return `${sign}€${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}m`;
  return `${sign}€${Math.round(a)}k`;
}
