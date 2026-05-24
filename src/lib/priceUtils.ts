/**
 * Utility functions for pricing and rounding.
 */

/**
 * Rounds a price according to specific user requirements:
 * - If the last two digits of the price (modulo 100) of the integer part is <= 15
 *   (e.g., close to XX0, XX10, XX05, XX07): rounds backwards (down) to the previous hundred ending in 99 (e.g. 1010 -> 999, 807 -> 799, 510 -> 499, 1005 -> 999).
 * - Otherwise (modulo 100 is > 15, e.g. 771.82, 1027): rounds to the next number ending in 9 in the units position (e.g. 771.82 -> 779, 1027 -> 1029).
 */
export function roundPrice(price: number): number {
  if (isNaN(price) || price <= 0) return price;

  const intPrice = Math.floor(price);
  const remainder100 = intPrice % 100;

  // Protect very small prices from rounding down to 0 or negative
  if (intPrice < 100) {
    // Round to next/nearest digit ending in 9
    const baseTen = Math.floor(intPrice / 10) * 10;
    const candidate = baseTen + 9;
    return candidate > 0 ? candidate : 9;
  }

  if (remainder100 <= 15) {
    // Round down to previous hundred ending in 99
    const baseHundred = Math.floor(intPrice / 100) * 100;
    return baseHundred - 1;
  } else {
    // Round to next number ending in 9
    const baseTen = Math.floor(intPrice / 10) * 10;
    return baseTen + 9;
  }
}
