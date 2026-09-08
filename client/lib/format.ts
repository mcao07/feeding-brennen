/** US dollars, so every amount on screen is punctuated the same way. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
