import { describe, expect, it } from "vitest";
import { decide, inQuietHours, quietHoursEnd, render, SYSTEM_TEMPLATES, textToHtml } from "./index";
import { providersFromEnv } from "./providers";

const TZ = "America/New_York";

describe("render", () => {
  it("fills merge fields and reports missing ones", () => {
    expect(render("Hi {{first_name}}, {{ class_name }}!", { first_name: "Morgan", class_name: "Youth TKD" })).toEqual({ text: "Hi Morgan, Youth TKD!", missing: [] });
    expect(render("Hi {{first_name}} {{nope}}", { first_name: "A" })).toEqual({ text: "Hi A ", missing: ["nope"] });
  });
  it("renders safe HTML", () => {
    expect(textToHtml("a <b>\n\nline1\nline2")).toBe("<p>a &lt;b&gt;</p>\n<p>line1<br>line2</p>");
  });
  it("every system template declares the variables it uses", () => {
    for (const t of Object.values(SYSTEM_TEMPLATES)) {
      for (const c of Object.values(t.channels)) {
        const used = [...`${c.subject ?? ""} ${c.body}`.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]);
        for (const v of used) expect([...t.variables, "reason_suffix"], `${t.key} uses ${v}`).toContain(v);
      }
    }
  });
});

describe("quiet hours", () => {
  const q = { start: "21:00", end: "08:00" };
  it("wraps midnight in the tenant timezone", () => {
    expect(inQuietHours(new Date("2026-09-23T02:00:00Z"), TZ, q)).toBe(true); // 22:00 local
    expect(inQuietHours(new Date("2026-09-23T11:30:00Z"), TZ, q)).toBe(true); // 07:30 local
    expect(inQuietHours(new Date("2026-09-23T12:00:00Z"), TZ, q)).toBe(false); // 08:00 local
    expect(inQuietHours(new Date("2026-09-22T22:00:00Z"), TZ, q)).toBe(false); // 18:00 local
  });
  it("defers to the end of quiet hours", () => {
    expect(quietHoursEnd(new Date("2026-09-23T02:00:00Z"), TZ, q).toISOString()).toBe("2026-09-23T12:00:00.000Z");
  });
});

describe("decide", () => {
  const base = { now: new Date("2026-09-22T22:00:00Z"), timeZone: TZ, consent: { email: true, sms: true } };
  it("sends when consented and addressable", () => {
    expect(decide({ ...base, channel: "email", address: "a@b.co" })).toEqual({ action: "send" });
    expect(decide({ ...base, channel: "sms", address: "+15550100" })).toEqual({ action: "send" });
  });
  it("respects consent and missing addresses", () => {
    expect(decide({ ...base, channel: "email", address: "a@b.co", consent: { email: false, sms: true } })).toEqual({ action: "opted_out" });
    expect(decide({ ...base, channel: "sms", address: "+1", consent: { email: true, sms: false } })).toEqual({ action: "opted_out" });
    expect(decide({ ...base, channel: "sms", address: null })).toEqual({ action: "no_address" });
  });
  it("defers SMS (not email) during quiet hours", () => {
    const late = { ...base, now: new Date("2026-09-23T02:00:00Z") };
    expect(decide({ ...late, channel: "sms", address: "+1" })).toEqual({ action: "defer", until: new Date("2026-09-23T12:00:00Z") });
    expect(decide({ ...late, channel: "email", address: "a@b.co" })).toEqual({ action: "send" });
  });
  it("in-app always sends", () => {
    expect(decide({ ...base, channel: "inapp", address: null, consent: { email: false, sms: false } })).toEqual({ action: "send" });
  });
});

describe("providers", () => {
  it("exist only when keys are configured", () => {
    expect(providersFromEnv({})).toEqual({ email: null, sms: null });
    const p = providersFromEnv({ RESEND_API_KEY: "re_x", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM_NUMBER: "+1" });
    expect(p.email?.name).toBe("resend");
    expect(p.sms?.name).toBe("twilio");
  });
});
