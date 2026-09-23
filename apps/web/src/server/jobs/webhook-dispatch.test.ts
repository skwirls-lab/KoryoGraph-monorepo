import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blockedDestination, signature } from "./webhook-dispatch";

afterEach(() => { vi.unstubAllEnvs(); });

describe("webhook dispatch", () => {
  it("signs `${t}.${body}` with HMAC-SHA256", () => {
    expect(signature("whsec_k", 1700000000, '{"a":1}')).toBe(createHmac("sha256", "whsec_k").update('1700000000.{"a":1}').digest("hex"));
  });
  it("refuses internal destinations in production only", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const u of ["http://example.com/h", "https://localhost/h", "https://127.0.0.1/h", "https://10.1.2.3/h", "https://192.168.0.5/h", "https://169.254.169.254/latest", "https://172.20.0.1/h", "https://db.internal/h", "https://[::1]/h"]) {
      expect(blockedDestination(u), u).not.toBeNull();
    }
    expect(blockedDestination("https://hooks.example.com/koryo")).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    expect(blockedDestination("http://127.0.0.1:4000/h")).toBeNull();
  });
});
