import { parseDocBody } from "@/lib/documents";

/** Renders the safe document format as semantic HTML (no raw HTML injection). */
export function DocumentBody({ body }: { body: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseDocBody(body).map((b, i) =>
        b.type === "h" ? <h3 key={i} className="text-base font-semibold">{b.text}</h3>
          : b.type === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
          : <p key={i}>{b.text}</p>,
      )}
    </div>
  );
}
