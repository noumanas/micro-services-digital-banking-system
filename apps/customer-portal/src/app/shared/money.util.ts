// The API represents every amount in minor units (cents) — see the root README.
// These helpers are the single place that converts between that wire format
// and the major-unit decimal a person types into a form or reads on screen.

export function formatMoney(minorUnits: number | undefined | null, currency: string): string {
  if (minorUnits === undefined || minorUnits === null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minorUnits / 100);
}

export function toMinorUnits(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}
