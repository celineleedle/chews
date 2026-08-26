// No 0/O, 1/I/L — codes get read aloud and typed on phones.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;

/** Uppercases and strips separators so "abc-de" and "ABCDE" both work. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
