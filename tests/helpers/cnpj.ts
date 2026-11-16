/**
 * CNPJ numérico válido (dígitos verificadores corretos) para massas descartáveis
 * de QA. Use `nextDigit` injetável para testes determinísticos.
 */
function checkDigit(digits: readonly number[], weights: readonly number[]): number {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (weights[index] ?? 0),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function generateValidCnpjDigits(nextDigit: () => number): string {
  for (;;) {
    const base = Array.from({ length: 12 }, () => nextDigit());
    // Rejeita sequências repetidas (ex.: 000000000000), inválidas por convenção.
    if (base.every((digit) => digit === base[0])) continue;
    const first = checkDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = checkDigit(
      [...base, first],
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    return [...base, first, second].join("");
  }
}
