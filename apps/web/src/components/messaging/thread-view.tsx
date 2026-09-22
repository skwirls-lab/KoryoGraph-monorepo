import { DateText } from "@koryo/ui/components/app/date-text";
import { cn } from "@koryo/ui/lib/utils";

export interface ThreadMessage {
  id: string;
  body: string;
  fromStaff: boolean;
  at: string;
  author: string;
}

/** Conversation bubbles; `perspective` decides which side is "me". */
export function ThreadView({ messages, perspective, timeZone }: { messages: ThreadMessage[]; perspective: "staff" | "family"; timeZone: string }) {
  return (
    <ol className="space-y-3" aria-label="Messages">
      {messages.map((m) => {
        const mine = perspective === "staff" ? m.fromStaff : !m.fromStaff;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2", mine ? "bg-brand text-brand-foreground" : "border border-default bg-surface")}>
              <p className={cn("text-xs", mine ? "opacity-80" : "text-fg-muted")}>
                {m.author} · <DateText value={m.at} timeZone={timeZone} style="datetime" />
              </p>
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
