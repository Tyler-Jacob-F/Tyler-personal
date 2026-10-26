/**
 * Timestamps arrive as text in whatever shape the driver prefers: PGlite gives
 * `2026-10-26 12:00:00.123456+00`, the Data API gives `2026-10-26 12:00:00.123456` in UTC.
 * Everything leaving the data layer is ISO 8601 with millisecond precision.
 */
export function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const match =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(
      value.trim(),
    );
  if (!match) return new Date(value).toISOString();
  const [, date, time, fraction = '.000', zone = 'Z'] = match;
  const millis = fraction.padEnd(4, '0').slice(0, 4);
  const offset = /^[+-]\d{2}$/.test(zone) ? `${zone}:00` : zone;
  return new Date(`${date}T${time}${millis}${offset}`).toISOString();
}
