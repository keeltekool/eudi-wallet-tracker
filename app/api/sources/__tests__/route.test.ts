import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the schema-allekirjoitus import so Drizzle's column builders don't try
// to resolve real pg types at test time via the project DB connection.
const eudiInsertedRow = {
  id: 1,
  name: "Test EUDI Source",
  url: "https://eudi.example.com",
  type: "rss",
};
const allekirjoitusInsertedRow = {
  id: 42,
  competitor: "scrive",
  url: "https://scrive.com/pricing",
  theme: "pricing",
  purpose: null,
  active: true,
};

const eudiValues = vi.fn();
const eudiInsert = vi.fn((_table: unknown) => ({
  values: (args: unknown) => {
    eudiValues(args);
    return {
      returning: async () => [eudiInsertedRow],
    };
  },
}));

const allekirjoitusValues = vi.fn();
const allekirjoitusInsert = vi.fn((_table: unknown) => ({
  values: (args: unknown) => {
    allekirjoitusValues(args);
    return {
      returning: async () => [allekirjoitusInsertedRow],
    };
  },
}));

vi.mock("@/src/db/client", () => ({
  db: {
    insert: (table: unknown) => eudiInsert(table),
    select: () => ({
      from: async () => [],
    }),
  },
}));

vi.mock("@/src/db/schema", () => ({
  sources: { __brand: "eudiSources" },
}));

vi.mock("@/src/db/schema-allekirjoitus", () => ({
  sources: { __brand: "allekirjoitusSources" },
}));

vi.mock("@/src/lib/db/connections", () => ({
  getDbForProject: vi.fn(() => ({
    insert: (table: unknown) => allekirjoitusInsert(table),
  })),
}));

import { POST } from "../route";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sources", () => {
  beforeEach(() => {
    eudiInsert.mockClear();
    eudiValues.mockClear();
    allekirjoitusInsert.mockClear();
    allekirjoitusValues.mockClear();
  });

  it("routes project=eudi (default) to the EUDI DB and inserts EUDI fields", async () => {
    const req = buildRequest({
      name: "Test EUDI Source",
      url: "https://eudi.example.com",
      type: "rss",
      category: "industry",
      config: { feedUrl: "https://eudi.example.com/feed" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    expect(eudiInsert).toHaveBeenCalledOnce();
    expect(allekirjoitusInsert).not.toHaveBeenCalled();
    expect(eudiValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test EUDI Source",
        url: "https://eudi.example.com",
        type: "rss",
      }),
    );
  });

  it("routes project=allekirjoitus to the Allekirjoitus DB with validated payload", async () => {
    const req = buildRequest({
      project: "allekirjoitus",
      competitor: "scrive",
      url: "https://scrive.com/pricing",
      theme: "pricing",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    expect(allekirjoitusInsert).toHaveBeenCalledOnce();
    expect(eudiInsert).not.toHaveBeenCalled();
    expect(allekirjoitusValues).toHaveBeenCalledWith(
      expect.objectContaining({
        competitor: "scrive",
        url: "https://scrive.com/pricing",
        theme: "pricing",
        active: true,
      }),
    );
  });

  it("rejects Allekirjoitus payload with invalid theme", async () => {
    const req = buildRequest({
      project: "allekirjoitus",
      competitor: "scrive",
      url: "https://scrive.com/pricing",
      theme: "made-up-theme",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/theme/);
    expect(allekirjoitusInsert).not.toHaveBeenCalled();
  });

  it("rejects Allekirjoitus payload with non-https URL", async () => {
    const req = buildRequest({
      project: "allekirjoitus",
      competitor: "scrive",
      url: "http://scrive.com/pricing",
      theme: "pricing",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/https/);
    expect(allekirjoitusInsert).not.toHaveBeenCalled();
  });

  it("rejects unknown project value", async () => {
    const req = buildRequest({
      project: "something-else",
      competitor: "x",
      url: "https://x.com",
      theme: "pricing",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown project/);
  });
});
