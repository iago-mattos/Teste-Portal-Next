function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function parseBrazilianDate(value: string): Date {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Data brasileira invalida: ${value}`);
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`Data brasileira invalida: ${value}`);
  }

  return parsed;
}

export function countBusinessDays(
  startExclusive: Date,
  endInclusive: Date,
): number {
  const cursor = startOfLocalDay(startExclusive);
  const end = startOfLocalDay(endInclusive);
  let businessDays = 0;

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays += 1;
  }

  return businessDays;
}
