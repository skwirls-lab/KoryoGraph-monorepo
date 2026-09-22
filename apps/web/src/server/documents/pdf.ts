import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parseDocBody } from "@/lib/documents";

export interface SignaturePdfInput {
  schoolName: string;
  documentName: string;
  version: number;
  body: string; // already merged
  personName: string;
  signerName: string;
  typedName: string;
  signedAt: string; // formatted in tenant tz
  ip: string | null;
  method: string;
  signatureId: string;
}

/** Standard 14 fonts only speak WinAnsi; replace what they can't encode rather than failing. */
function safe(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

/** A signed-document PDF: the exact version's text plus a signature block (name, time, IP, method). */
export async function renderSignaturePdf(input: SignaturePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.documentName} v${input.version} — ${input.personName}`);
  pdf.setProducer("KoryoGraph");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 56;
  const width = 612 - margin * 2;
  let page: PDFPage = pdf.addPage([612, 792]);
  let y = 792 - margin;
  const ensure = (h: number) => { if (y - h < margin) { page = pdf.addPage([612, 792]); y = 792 - margin; } };
  const text = (t: string, f: PDFFont, size: number, color = rgb(0.1, 0.1, 0.12)) => {
    for (const l of wrap(t, f, size, width)) {
      ensure(size + 4);
      page.drawText(l, { x: margin, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  };

  text(input.schoolName, bold, 11, rgb(0.55, 0.07, 0.2));
  y -= 4;
  text(`${input.documentName} (version ${input.version})`, bold, 16);
  text(`For: ${input.personName}`, font, 10, rgb(0.35, 0.35, 0.4));
  y -= 10;
  for (const b of parseDocBody(input.body)) {
    if (b.type === "h") { y -= 4; text(b.text, bold, 12); }
    else if (b.type === "ul") for (const it of b.items) text(`•  ${it}`, font, 10);
    else text(b.text, font, 10);
    y -= 6;
  }
  y -= 12;
  ensure(90);
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.75, color: rgb(0.7, 0.7, 0.75) });
  y -= 16;
  text("Electronic signature", bold, 11);
  text(`Signed by: ${input.typedName} (${input.signerName})`, font, 10);
  text(`Signed at: ${input.signedAt}`, font, 10);
  text(`Method: ${input.method}${input.ip ? ` · IP ${input.ip}` : ""}`, font, 10);
  text(`Signature id: ${input.signatureId}`, font, 8, rgb(0.45, 0.45, 0.5));
  return pdf.save();
}
