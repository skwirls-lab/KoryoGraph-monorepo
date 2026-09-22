import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("honesty guards", () => {
  it("server code never authorises with getSession()", () => {
    const hits = walk(path.join(ROOT, "apps/web/src/server")).filter((f) => readFileSync(f, "utf8").includes("getSession("));
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("the service-role client is imported only from allowed paths", () => {
    const allowed = [/apps\/web\/src\/server\/admin\//, /apps\/web\/src\/server\/jobs\//, /apps\/web\/src\/app\/api\/(stripe|jobs|webhooks)\//];
    const hits = walk(path.join(ROOT, "apps/web/src"))
      .filter((f) => readFileSync(f, "utf8").includes("@koryo/db/service"))
      .map((f) => path.relative(ROOT, f))
      .filter((f) => !allowed.some((re) => re.test(f)));
    expect(hits).toEqual([]);
  });
});
