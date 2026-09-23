/**
 * Fill `{{obs.N.path}}` placeholders in an answer from the tool observations the model actually saw, so the
 * numbers shown are the data's, not the model's recollection. Unknown paths render as "[unknown]" and are
 * reported so the caller can flag the answer.
 */
export function renderGrounded(text: string, observations: { result: unknown }[]): { text: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(/\{\{\s*obs\.(\d+)((?:\.[A-Za-z0-9_]+)*)\s*\}\}/g, (whole, n: string, path: string) => {
    let v: unknown = observations[Number(n)]?.result;
    for (const key of path.split(".").filter(Boolean)) {
      if (v !== null && typeof v === "object") v = (v as Record<string, unknown>)[key];
      else { v = undefined; break; }
    }
    if (v === undefined || v === null || typeof v === "object") {
      missing.push(whole);
      return "[unknown]";
    }
    return typeof v === "number" ? v.toLocaleString("en-US") : String(v);
  });
  return { text: out, missing };
}
