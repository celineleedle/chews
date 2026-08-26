import { randomInt } from "node:crypto";
import { CODE_ALPHABET, CODE_LENGTH } from "@chews/shared";

export { CODE_ALPHABET, CODE_LENGTH, normalizeCode } from "@chews/shared";

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function uniqueCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = generateCode();
    if (!isTaken(code)) return code;
  }
  // 31^5 ≈ 28.6M combinations — 50 collisions in a row means something is wrong.
  throw new Error("could not allocate a unique room code");
}
