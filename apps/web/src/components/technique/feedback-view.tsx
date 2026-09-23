import type { TechniqueFeedback } from "@/lib/technique";

/** Released technique feedback: rubric scores, summary and the three tips. */
export function FeedbackView({ feedback }: { feedback: TechniqueFeedback }) {
  return (
    <div className="space-y-3 text-sm">
      <p><span className="text-2xl font-semibold tabular">{feedback.overall.toFixed(1)}</span><span className="text-fg-muted"> / 5 overall</span></p>
      <p>{feedback.summary}</p>
      <dl className="divide-y divide-default rounded-lg border border-default" aria-label="Scores">
        {feedback.scores.map((s) => (
          <div key={s.criterion} className="grid gap-1 p-2 sm:grid-cols-[10rem_3rem_1fr]">
            <dt className="font-medium">{s.criterion}</dt>
            <dd className="tabular" aria-label={`${s.score} out of 5`}>{s.score}/5</dd>
            <dd className="text-fg-secondary">{s.note}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className="mb-1 font-medium">Three things to practise</h4>
        <ol className="list-decimal space-y-1 pl-5" aria-label="Tips">{feedback.tips.map((t, i) => <li key={i}>{t}</li>)}</ol>
      </div>
    </div>
  );
}
