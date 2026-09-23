import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { safe, wrap } from "../documents/pdf";

export interface CertificateInput {
  schoolName: string;
  title: string;
  body: string; // merged
  studentName: string;
  rankName: string;
  beltColor: string;
  date: string;
  signerName: string | null;
  signerTitle: string | null;
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? rgb(parseInt(m[1] ?? "0", 16) / 255, parseInt(m[2] ?? "0", 16) / 255, parseInt(m[3] ?? "0", 16) / 255) : rgb(0.2, 0.2, 0.2);
}

/** A landscape rank certificate (US Letter) with a belt-colour band. */
export async function renderCertificatePdf(c: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${c.title} — ${c.studentName}`);
  pdf.setProducer("KoryoGraph");
  const W = 792;
  const H = 612;
  const page = pdf.addPage([W, H]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.12, 0.12, 0.14);
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: rgb(0.55, 0.07, 0.2), borderWidth: 3 });
  page.drawRectangle({ x: 24, y: H - 96, width: W - 48, height: 14, color: hexToRgb(c.beltColor), borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 0.5 });
  const center = (text: string, y: number, font: typeof serif, size: number, color = ink) => {
    const t = safe(text);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };
  center(c.schoolName, H - 70, sans, 14, rgb(0.55, 0.07, 0.2));
  center(c.title, H - 160, serifBold, 38);
  center(c.studentName, H - 250, serifBold, 34);
  let y = H - 300;
  for (const line of wrap(c.body, serif, 16, W - 200)) {
    center(line, y, serif, 16);
    y -= 22;
  }
  center(c.rankName, y - 20, serifBold, 22);
  page.drawLine({ start: { x: W - 300, y: 110 }, end: { x: W - 90, y: 110 }, thickness: 1, color: ink });
  const signer = safe([c.signerName, c.signerTitle].filter(Boolean).join(", ") || "Head instructor");
  page.drawText(signer, { x: W - 300, y: 94, size: 11, font: sans, color: ink });
  page.drawText(safe(c.date), { x: 90, y: 94, size: 11, font: sans, color: ink });
  page.drawLine({ start: { x: 90, y: 110 }, end: { x: 280, y: 110 }, thickness: 1, color: ink });
  return pdf.save();
}
