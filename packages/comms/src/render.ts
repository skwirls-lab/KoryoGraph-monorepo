/** {{var}} merge-field rendering. Missing variables render empty and are reported. */
export function render(template: string, data: Record<string, string | number | null | undefined>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, key: string) => {
    const v = data[key];
    if (v === undefined || v === null) {
      missing.add(key);
      return "";
    }
    return String(v);
  });
  return { text, missing: [...missing] };
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

/** Plain text → minimal, safe HTML email body (paragraphs + line breaks). */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
