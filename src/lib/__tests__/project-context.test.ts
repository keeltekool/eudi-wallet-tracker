import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { getSelectedProject } from "../project-context";

const mockCookies = (value: string | undefined) => {
  (cookies as any).mockResolvedValue({
    get: (name: string) => (name === "selected_project_id" && value ? { value } : undefined),
  });
};

describe("getSelectedProject", () => {
  it("returns 'eudi' by default when no cookie is set", async () => {
    mockCookies(undefined);
    expect(await getSelectedProject()).toBe("eudi");
  });

  it("returns 'eudi' when cookie value is 'eudi'", async () => {
    mockCookies("eudi");
    expect(await getSelectedProject()).toBe("eudi");
  });

  it("returns 'allekirjoitus' when cookie value is 'allekirjoitus'", async () => {
    mockCookies("allekirjoitus");
    expect(await getSelectedProject()).toBe("allekirjoitus");
  });

  it("falls back to 'eudi' on unknown cookie value (safety default)", async () => {
    mockCookies("some-other-project");
    expect(await getSelectedProject()).toBe("eudi");
  });
});
