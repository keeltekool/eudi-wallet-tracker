import { describe, it, expect } from "vitest";
import { titleKey } from "../title-key";

describe("titleKey", () => {
  it("matches a Biometric Update headline and its Google News copy (#58458 / #58707)", () => {
    expect(titleKey("EUDI Wallet deadline nears as Europe’s rollout picture remains uneven - Biometric Update")).toBe(
      titleKey("EUDI Wallet deadline nears as Europe’s rollout picture remains uneven ")
    );
  });

  it("keeps different stories apart", () => {
    expect(titleKey("Identt joins Poland’s mObywatel Europa EUDI Wallet sandbox")).not.toBe(
      titleKey("EU sets digital ID rules for cross-border health data exchange")
    );
  });
});
