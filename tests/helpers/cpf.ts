const CPF_LENGTH = 11;

function calculateCheckDigit(digits: readonly number[]): number {
  const weightedSum = digits.reduce(
    (sum, digit, index) => sum + digit * (digits.length + 1 - index),
    0,
  );
  const remainder = (weightedSum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpfDigits(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const digits = [...value].map(Number);
  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9));
  const secondCheckDigit = calculateCheckDigit([
    ...digits.slice(0, 9),
    firstCheckDigit,
  ]);

  return digits[9] === firstCheckDigit && digits[10] === secondCheckDigit;
}

export function generateValidCpfDigits(
  randomDigit: () => number = () => Math.floor(Math.random() * 10),
): string {
  for (;;) {
    const base = Array.from({ length: CPF_LENGTH - 2 }, () => {
      const digit = randomDigit();
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        throw new Error("O gerador de CPF precisa retornar dígitos entre 0 e 9.");
      }
      return digit;
    });
    if (base.every((digit) => digit === base[0])) continue;

    const firstCheckDigit = calculateCheckDigit(base);
    const secondCheckDigit = calculateCheckDigit([...base, firstCheckDigit]);
    const cpf = [...base, firstCheckDigit, secondCheckDigit].join("");
    if (isValidCpfDigits(cpf)) return cpf;
  }
}
