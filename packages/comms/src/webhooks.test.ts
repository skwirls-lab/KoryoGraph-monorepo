import { describe, expect, it } from "vitest";
import { svixSignature, twilioSignature, verifySvix, verifyTwilio } from "./webhooks";

describe("twilio signatures", () => {
  const url = "https://example.com/api/webhooks/twilio?x=1";
  const params = { From: "+15550100", To: "+15550199", Body: "Hi coach" };
  it("accepts a correct signature and rejects tampering", () => {
    const sig = twilioSignature("token123", url, params);
    expect(verifyTwilio("token123", url, params, sig)).toBe(true);
    expect(verifyTwilio("token123", url, { ...params, Body: "Hi coach!" }, sig)).toBe(false);
    expect(verifyTwilio("wrong", url, params, sig)).toBe(false);
    expect(verifyTwilio("token123", url, params, null)).toBe(false);
  });
  it("is independent of parameter order", () => {
    expect(twilioSignature("t", url, { b: "2", a: "1" })).toBe(twilioSignature("t", url, { a: "1", b: "2" }));
  });
});

describe("svix signatures", () => {
  const secret = `whsec_${Buffer.from("super-secret-key").toString("base64")}`;
  const now = new Date("2026-09-22T12:00:00Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  const body = JSON.stringify({ type: "email.delivered" });
  it("accepts v1 signatures within tolerance", () => {
    const sig = svixSignature(secret, "msg_1", ts, body);
    expect(verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body, now)).toBe(true);
    expect(verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,bogus v1,${sig}` }, body, now)).toBe(true);
  });
  it("rejects wrong body, old timestamps and missing headers", () => {
    const sig = svixSignature(secret, "msg_1", ts, body);
    expect(verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body + " ", now)).toBe(false);
    expect(verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body, new Date(now.getTime() + 10 * 60_000))).toBe(false);
    expect(verifySvix(secret, { id: null, timestamp: ts, signature: `v1,${sig}` }, body, now)).toBe(false);
  });
});
