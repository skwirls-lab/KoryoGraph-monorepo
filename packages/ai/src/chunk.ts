/**
 * Split a document into retrieval chunks of roughly `maxChars` (~4 chars per token → 2000 ≈ 500 tokens),
 * on paragraph then sentence boundaries, with `overlap` characters carried into the next chunk so a fact
 * split across a boundary is still found. Each chunk is prefixed with the document title.
 */
export function chunkText(title: string, body: string, opts: { maxChars?: number; overlap?: number } = {}): string[] {
  const max = opts.maxChars ?? 2000;
  const overlap = Math.min(opts.overlap ?? 300, Math.floor(max / 2));
  const clean = body.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  // Units: paragraphs, and sentences of paragraphs that are too long on their own.
  const units: string[] = [];
  for (const para of clean.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= max) { units.push(p); continue; }
    let buf = "";
    for (const sentence of p.split(/(?<=[.!?])\s+/)) {
      if (sentence.length > max) {
        if (buf) { units.push(buf); buf = ""; }
        for (let i = 0; i < sentence.length; i += max) units.push(sentence.slice(i, i + max));
        continue;
      }
      if (buf && buf.length + sentence.length + 1 > max) { units.push(buf); buf = ""; }
      buf = buf ? `${buf} ${sentence}` : sentence;
    }
    if (buf) units.push(buf);
  }
  const chunks: string[] = [];
  let cur = "";
  for (const u of units) {
    if (cur && cur.length + u.length + 2 > max) {
      chunks.push(cur);
      const tail = cur.slice(-overlap);
      const cut = tail.search(/(?<=[.!?\n])\s/);
      cur = cut >= 0 ? tail.slice(cut).trim() : "";
    }
    cur = cur ? `${cur}\n\n${u}` : u;
  }
  if (cur) chunks.push(cur);
  const heading = title.trim();
  return chunks.map((c) => (heading ? `${heading}\n\n${c}` : c));
}
