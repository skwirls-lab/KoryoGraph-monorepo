import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Appendix B.4: every exported async function in src/server/actions/** must begin by establishing the
// verified request context — its first statement calls getCtx() (directly or via a require* helper).
const DIR = path.resolve(import.meta.dirname, "../../apps/web/src/server/actions");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
  });
}

function firstStatementCallsCtx(body: ts.Block | undefined): boolean {
  const first = body?.statements[0];
  if (!first) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const name = ts.isIdentifier(n.expression) ? n.expression.text : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : "";
      if (name === "getCtx" || /^require[A-Z]/.test(name)) found = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(first);
  return found;
}

describe("server actions guard", () => {
  it("every exported action starts with getCtx()/require*()", () => {
    const offenders: string[] = [];
    let count = 0;
    for (const file of files(DIR)) {
      const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      for (const stmt of src.statements) {
        const exported = ts.canHaveModifiers(stmt) && ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!exported) continue;
        if (ts.isFunctionDeclaration(stmt)) {
          count++;
          if (!firstStatementCallsCtx(stmt.body)) offenders.push(`${path.relative(DIR, file)}:${stmt.name?.text}`);
        } else if (ts.isVariableStatement(stmt)) {
          for (const d of stmt.declarationList.declarations) {
            const init = d.initializer;
            if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
              count++;
              const body = ts.isBlock(init.body) ? init.body : undefined;
              if (!firstStatementCallsCtx(body)) offenders.push(`${path.relative(DIR, file)}:${d.name.getText(src)}`);
            }
          }
        }
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
