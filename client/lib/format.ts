/** US dollars, so every amount on screen is punctuated the same way. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/** A calendar date as "Sep 3", built from its parts so the string is never shifted a day by a timezone. */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(year, month - 1, day)
  );
}

/** Today as "YYYY-MM-DD". The browser computes it, because only it knows which day the user is on; local parts, never toISOString, which shifts by timezone. */
export function todayIso(): string {
  return localIso(new Date());
}

/** The first of the current month as "YYYY-MM-DD", from the browser's own day for the same reason. */
export function firstOfMonthIso(): string {
  const now = new Date();
  return localIso(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** A Date's *local* calendar day as "YYYY-MM-DD". Exported because the quick-range buttons build Dates of their own and a second copy of this rule is a second way to be wrong. */
export function localIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
