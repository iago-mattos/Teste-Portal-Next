import { createHash } from "node:crypto";
import { generateValidCpfDigits } from "./cpf";

function digitSource(seed: string): () => number {
  const bytes = createHash("sha256").update(seed).digest();
  let index = 0;
  return () => {
    const digit = bytes[index % bytes.length]! % 10;
    index += 1;
    return digit;
  };
}

export function generateDeterministicCpf(seed: string): string {
  return generateValidCpfDigits(digitSource(`cpf:${seed}`));
}

function cnpjCheckDigit(digits: readonly number[], weights: readonly number[]): number {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * weights[index]!,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function generateDeterministicCnpj(seed: string): string {
  const nextDigit = digitSource(`cnpj:${seed}`);
  const base = [
    ...Array.from({ length: 8 }, nextDigit),
    0,
    0,
    0,
    1,
  ];
  const first = cnpjCheckDigit(
    base,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const second = cnpjCheckDigit(
    [...base, first],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return [...base, first, second].join("");
}
