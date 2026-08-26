import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, generateCode, normalizeCode, uniqueCode } from "../rooms/codes.js";

describe("room codes", () => {
  it("excludes ambiguous characters from the alphabet", () => {
    for (const ch of "0O1IL") {
      expect(CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("generates codes of the right shape", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("normalizes user input", () => {
    expect(normalizeCode("ab-cd e")).toBe("ABCDE");
    expect(normalizeCode("XYZ23")).toBe("XYZ23");
  });

  it("retries on collision", () => {
    let rejections = 3;
    const code = uniqueCode(() => rejections-- > 0);
    expect(code).toHaveLength(CODE_LENGTH);
    expect(rejections).toBeLessThan(0);
  });

  it("gives up eventually if everything collides", () => {
    expect(() => uniqueCode(() => true)).toThrow();
  });
});
