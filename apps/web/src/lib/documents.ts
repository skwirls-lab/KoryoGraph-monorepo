import { render } from "@koryo/comms";

/**
 * Document bodies are a small, safe text format (no HTML):
 *   "# Heading" · "- bullet" · blank line = new paragraph · {{merge_field}}
 * Parsed into blocks that both the React view and the PDF renderer draw.
 */
export type DocBlock = { type: "h"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

export function parseDocBody(body: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ type: "ul", items: list }); list = []; } };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (line === "") { flushPara(); flushList(); continue; }
    if (line.startsWith("# ")) { flushPara(); flushList(); blocks.push({ type: "h", text: line.slice(2).trim() }); continue; }
    if (line.startsWith("- ")) { flushPara(); list.push(line.slice(2).trim()); continue; }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

export const DOC_MERGE_FIELDS = ["student_name", "guardian_name", "school_name", "date"] as const;

export function mergeDoc(body: string, data: Partial<Record<(typeof DOC_MERGE_FIELDS)[number], string>>): string {
  return render(body, data).text;
}

export const DOCUMENT_KINDS = ["waiver", "contract", "policy", "media_release"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
