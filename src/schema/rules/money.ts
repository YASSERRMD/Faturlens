// Money helpers. All comparisons use integer minor units (e.g. fils/cents) so
// we never test floating-point values for equality.

const MINOR_FACTOR = 100;

/** Convert a major-unit amount to integer minor units (2 dp). */
export function toMinor(amount: number): number {
  return Math.round(amount * MINOR_FACTOR);
}

/** True when two major-unit amounts agree within `toleranceMinor` minor units. */
export function approxEqualMinor(a: number, b: number, toleranceMinor = 1): boolean {
  return Math.abs(toMinor(a) - toMinor(b)) <= toleranceMinor;
}

/** Sum major-unit amounts in minor units, returned as a major-unit number. */
export function sumMinor(amounts: number[]): number {
  const total = amounts.reduce((sum, amount) => sum + toMinor(amount), 0);
  return total / MINOR_FACTOR;
}
