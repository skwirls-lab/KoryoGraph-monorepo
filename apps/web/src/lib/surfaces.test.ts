import { describe, expect, it } from "vitest";
import { isProtectedPath, isSharedPath, landingSurface, safeNext, surfaceForHost } from "./surfaces";

describe("surfaces", () => {
  it("routes subdomains to surfaces", () => {
    expect(surfaceForHost("desk.koryograph.ai", "koryograph.ai")).toBe("desk");
    expect(surfaceForHost("app.koryograph.ai", "koryograph.ai")).toBe("mat");
    expect(surfaceForHost("home.koryograph.ai:443", "koryograph.ai")).toBe("home");
    expect(surfaceForHost("www.koryograph.ai", "koryograph.ai")).toBeNull();
    expect(surfaceForHost("koryograph.ai", "koryograph.ai")).toBeNull();
    expect(surfaceForHost("localhost:3100", "localhost")).toBeNull();
    expect(surfaceForHost("desk.evil.com", "koryograph.ai")).toBeNull();
  });

  it("lands users on the first surface they can open", () => {
    expect(landingSurface(["home.access", "desk.access"])).toBe("desk");
    expect(landingSurface(["mat.access", "people.read"])).toBe("mat");
    expect(landingSurface(["home.access"])).toBe("home");
    expect(landingSurface([])).toBeNull();
  });

  it("only accepts same-site relative next paths", () => {
    expect(safeNext("/desk/people?x=1")).toBe("/desk/people?x=1");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(undefined, "/desk")).toBe("/desk");
  });

  it("classifies protected and shared paths", () => {
    expect(isProtectedPath("/desk")).toBe(true);
    expect(isProtectedPath("/desk/people")).toBe(true);
    expect(isProtectedPath("/desktop")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isSharedPath("/login")).toBe(true);
    expect(isSharedPath("/api/jobs/x")).toBe(true);
    expect(isSharedPath("/people")).toBe(false);
  });
});
