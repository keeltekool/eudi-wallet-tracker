import { describe, it, expect, vi, beforeEach } from "vitest";

// We mock neon + drizzle so the tests don't actually talk to Neon.
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn((url: string) => ({ _url: url })),
}));
vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: vi.fn((client: any, opts: any) => ({ _client: client, _schema: opts?.schema })),
}));

import { getDbForProject, type ProjectId } from "../connections";

describe("getDbForProject", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://eudi-test";
    process.env.DATABASE_URL_ALLEKIRJOITUS = "postgres://allekirjoitus-test";
  });

  it("returns a client bound to DATABASE_URL when projectId=eudi", () => {
    const db: any = getDbForProject("eudi");
    expect(db._client._url).toBe("postgres://eudi-test");
  });

  it("returns a client bound to DATABASE_URL_ALLEKIRJOITUS when projectId=allekirjoitus", () => {
    const db: any = getDbForProject("allekirjoitus");
    expect(db._client._url).toBe("postgres://allekirjoitus-test");
  });

  it("throws a clear error on unknown projectId", () => {
    expect(() => getDbForProject("bogus" as ProjectId)).toThrow(/unknown.*project/i);
  });

  it("throws a clear error if DATABASE_URL is missing for eudi", () => {
    delete process.env.DATABASE_URL;
    expect(() => getDbForProject("eudi")).toThrow(/DATABASE_URL/);
  });

  it("throws a clear error if DATABASE_URL_ALLEKIRJOITUS is missing for allekirjoitus", () => {
    delete process.env.DATABASE_URL_ALLEKIRJOITUS;
    expect(() => getDbForProject("allekirjoitus")).toThrow(/DATABASE_URL_ALLEKIRJOITUS/);
  });

  it("attaches the correct schema namespace per project", () => {
    const eudiDb: any = getDbForProject("eudi");
    const alleDb: any = getDbForProject("allekirjoitus");
    // schemas should be distinct objects
    expect(eudiDb._schema).toBeDefined();
    expect(alleDb._schema).toBeDefined();
    expect(eudiDb._schema).not.toBe(alleDb._schema);
  });
});
