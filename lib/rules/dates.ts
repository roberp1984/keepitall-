const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Parses a strict YYYY-MM-DD calendar date as UTC midnight. */
export function parseIsoDate(value: string): Date {
  const match = ISO_DATE.exec(value);
  if (!match) throw new RangeError(`Invalid date (expected YYYY-MM-DD): ${value}`);
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (formatIsoDate(date) !== value) throw new RangeError(`Invalid calendar date: ${value}`);
  return date;
}

export function isIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds whole years; 29 February maps to 28 February in non-leap years. */
export function addYears(value: string, years: number): string {
  const date = parseIsoDate(value);
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return formatIsoDate(new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay))));
}

/** Adds whole months; the day is clamped to the end of shorter months. */
export function addMonths(value: string, months: number): string {
  const date = parseIsoDate(value);
  const total = date.getUTCMonth() + months;
  const y = date.getUTCFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return formatIsoDate(new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay))));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}

export function addDays(value: string, days: number): string {
  return formatIsoDate(new Date(parseIsoDate(value).getTime() + days * MS_PER_DAY));
}
