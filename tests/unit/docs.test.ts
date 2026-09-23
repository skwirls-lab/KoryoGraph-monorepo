import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// M5.09: the docs' links resolve and every `npm run …` they mention exists.
const ROOT = path.resolve(import.meta.dirname, "../..");
const DOCS = ["README.md", "CLAUDE.md", ...readdirSync(path.join(ROOT, "docs")).filter((n) => n.endsWith(".md")).map((n) => `docs/${n}`), "docs/build/DEMO-ACCOUNTS.md"];
const pkg = (p: string) => (JSON.parse(readFileSync(path.join(ROOT, p), "utf8")) as { scripts: Record<string, string> }).scripts;
const rootScripts = pkg("package.json");
const webScripts = pkg("apps/web/package.json");

describe("documentation", () => {
  it.each(DOCS)("%s: relative links point at real files", (doc) => {
    const text = readFileSync(path.join(ROOT, doc), "utf8");
    const broken = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] as string)
      .filter((l) => !/^(https?:|mailto:|#)/.test(l))
      .filter((l) => !existsSync(path.resolve(path.dirname(path.join(ROOT, doc)), l.split("#")[0] as string)));
    expect(broken).toEqual([]);
  });

  it.each(DOCS)("%s: every `npm run` command exists", (doc) => {
    const text = readFileSync(path.join(ROOT, doc), "utf8");
    const missing = [...text.matchAll(/npm run (?:-s )?([a-z][a-z0-9:_-]*)( -w @koryo\/web)?/g)]
      .filter((m) => !(m[2] ? m[1] as string in webScripts : m[1] as string in rootScripts))
      .map((m) => m[0]);
    expect(missing).toEqual([]);
  });
});
