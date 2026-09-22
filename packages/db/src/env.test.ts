import { describe, expect, it } from "vitest";
import { EnvError, publicEnv, serviceEnv } from "./env";

const KEY = "x".repeat(40);

describe("publicEnv", () => {
  it("accepts a valid URL and key and normalises a blank cookie domain", () => {
    expect(publicEnv({ url: "http://127.0.0.1:54321", anonKey: KEY, cookieDomain: " " })).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: KEY,
      cookieDomain: undefined,
    });
  });

  it("keeps a configured cookie domain", () => {
    expect(publicEnv({ url: "https://api.example.com", anonKey: KEY, cookieDomain: ".koryograph.ai" }).cookieDomain).toBe(
      ".koryograph.ai",
    );
  });

  it("rejects a missing anon key with a readable error", () => {
    expect(() => publicEnv({ url: "http://127.0.0.1:54321" })).toThrow(EnvError);
    expect(() => publicEnv({ url: "http://127.0.0.1:54321" })).toThrow(/ANON_KEY/);
  });

  it("rejects a non-URL", () => {
    expect(() => publicEnv({ url: "not a url", anonKey: KEY })).toThrow(/SUPABASE_URL/);
  });
});

describe("serviceEnv", () => {
  it("requires the service role key", () => {
    expect(() => serviceEnv({ url: "http://127.0.0.1:54321" })).toThrow(/SERVICE_ROLE_KEY/);
    expect(serviceEnv({ url: "http://127.0.0.1:54321", serviceRoleKey: KEY }).serviceRoleKey).toBe(KEY);
  });
});
