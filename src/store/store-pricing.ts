/**
 * Single source of truth for store checkout pricing.
 *
 * The cart preview and the order placement path MUST both price through these
 * helpers. When the two duplicated the arithmetic, any change to one silently
 * quoted the customer a total different from the one they were charged.
 */

/** Flat freight fee applied once per order. */
export const STANDARD_SHIPPING_FEE_USD = 18.0;

/** Estimated sales tax rate applied to taxable line items. */
export const SALES_TAX_RATE = 0.08;

export const SHIPPING_NOTE =
  'Flat $18.00 freight, charged once per order regardless of how many items are purchased';

/**
 * Flat shipping fee, charged once per order no matter how many products or
 * units it contains. Every order with at least one item pays it; there is no
 * free-shipping threshold.
 */
export function calculateShippingFee(lineItemCount: number): number {
  return lineItemCount > 0 ? STANDARD_SHIPPING_FEE_USD : 0.0;
}

/** Sales tax on the taxable portion of the subtotal, rounded to cents. */
export function calculateTax(taxableSubtotal: number): number {
  return Number((taxableSubtotal * SALES_TAX_RATE).toFixed(2));
}
