import { randomInt } from "node:crypto";

// No 0/O, 1/I/L — codes get read aloud and typed on phones.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercases and strips separators so "abc-de" and "ABCDE" both work. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function uniqueCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = generateCode();
    if (!isTaken(code)) return code;
  }
  // 31^5 ≈ 28.6M combinations — 50 collisions in a row means something is wrong.
  throw new Error("could not allocate a unique room code");
}
