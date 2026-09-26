import type { TicketDecision } from "../hooks/useJev";

export interface Comparison { message: string; before: TicketDecision; after: TicketDecision }

export function AssessmentComparison({ comparison }: { comparison: Comparison }) {
  const { before, after } = comparison;
  const rows = [
    ["Sentiment", before.sentiment.value, after.sentiment.value],
    ["Urgency", `${before.urgency.value.toFixed(1)} / 10`, `${after.urgency.value.toFixed(1)} / 10`],
    ["Escalation", before.needsEscalation.value ? "Yes" : "No", after.needsEscalation.value ? "Yes" : "No"],
  ];
  return <section className="comparison" aria-labelledby="comparison-heading">
    <h3 id="comparison-heading">Last correction</h3>
    <div className="table-scroll"><table className="workflow-table"><thead><tr><th scope="col">Assessment</th><th scope="col">Before</th><th scope="col">After retraining</th></tr></thead>
      <tbody>{rows.map(([label, previous, next]) => <tr key={label}><th scope="row">{label}</th><td>{previous}</td><td>{next}{previous !== next && <span className="changed-label"> Changed</span>}</td></tr>)}</tbody>
    </table></div>
    <p className="hint">Same message, before and after your correction. A changed prediction does not establish better accuracy.</p>
  </section>;
}
