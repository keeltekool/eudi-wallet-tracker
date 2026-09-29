import { describe, it, expect } from "vitest";
import { resendApiKey } from "../resend-key";

const KEY = "re_abc123DEF456";

// Built with fromCharCode on purpose: written as literal characters these are invisible
// in an editor and one stray reformat would silently make the assertions vacuous.
const BOM = String.fromCharCode(0xfeff);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const E_ACUTE = String.fromCharCode(0xe9);

describe("resendApiKey", () => {
  it("returns a clean key unchanged", () => {
    expect(resendApiKey({ RESEND_API_KEY: KEY })).toBe(KEY);
  });

  it("strips a leading BOM - the bug that broke every newsletter send", () => {
    // A BOM here put U+FEFF at index 7 of `Bearer ${key}`, so fetch threw
    // "Cannot convert argument to a ByteString ... value of 65279" before sending.
    const raw = BOM + KEY;
    expect(`Bearer ${raw}`.charCodeAt(7)).toBe(0xfeff); // the reported failure
    const key = resendApiKey({ RESEND_API_KEY: raw });
    expect(key).toBe(KEY);
    // The whole header must now be representable as a ByteString.
    expect([...`Bearer ${key}`].every((c) => c.charCodeAt(0) <= 255)).toBe(true);
  });

  it("strips surrounding whitespace, newlines and zero-width characters", () => {
    expect(resendApiKey({ RESEND_API_KEY: `  ${KEY}\n` })).toBe(KEY);
    expect(resendApiKey({ RESEND_API_KEY: KEY + BOM })).toBe(KEY);
    expect(
      resendApiKey({ RESEND_API_KEY: "re_abc123" + ZERO_WIDTH_SPACE + "DEF456" })
    ).toBe(KEY);
  });

  it("throws a pointed error when the key is missing or blank", () => {
    expect(() => resendApiKey({})).toThrow(/not configured/);
    expect(() => resendApiKey({ RESEND_API_KEY: BOM + "  " })).toThrow(/empty/);
  });

  it("throws naming the offending code point when the key is genuinely corrupt", () => {
    expect(() =>
      resendApiKey({ RESEND_API_KEY: "re_abc" + E_ACUTE + "123" })
    ).toThrow(/U\+00E9.*re-paste/s);
  });
});
