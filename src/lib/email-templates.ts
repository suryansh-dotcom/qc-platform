const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const wrap = (inner: string) =>
  `<div style="font-family:ui-monospace,Menlo,monospace;color:#0a0a0a;max-width:560px">
     <div style="border:1px solid #e2e8f0;border-radius:6px;padding:20px">
       <p style="font-weight:600;margin:0 0 12px">QC Platform</p>${inner}
     </div>
   </div>`;

export type Rendered = { subject: string; html: string; text: string };

type Renderer = (p: Record<string, any>) => Rendered;

const renderers: Record<string, Renderer> = {
  leave_request: (p) => {
    const url = `${SITE}/leave/${p.leaveId}`;
    return {
      subject: `Leave request — ${p.associateName} (${p.days}d)`,
      text:
        `${p.associateName} requested leave ${p.startDate} to ${p.endDate} (${p.days} day(s)).\n` +
        `Reason: ${p.reason || "—"}\n` +
        `Review and decide (login required): ${url}`,
      html: wrap(
        `<p>${p.associateName} requested leave.</p>
         <p><b>${p.startDate}</b> &rarr; <b>${p.endDate}</b> · ${p.days} day(s) · ${p.dayType}</p>
         <p style="color:#475569">Reason: ${p.reason || "—"}</p>
         <p style="margin-top:16px">
           <a href="${url}" style="display:inline-block;border:1px solid #0a0a0a;border-radius:6px;padding:8px 14px;color:#0a0a0a;text-decoration:none">Open approval page</a>
         </p>
         <p style="color:#94a3b8;font-size:12px">You must sign in; the decision is recorded via an explicit action on that page.</p>`
      ),
    };
  },
  daily_snapshot: (p) => ({
    subject: `Daily QC snapshot — ${p.date} (${p.submittedCount}/${p.total} submitted)`,
    text:
      `Daily snapshot ${p.date}: ${p.submittedCount}/${p.total} submitted.\n` +
      (p.rows as any[]).map((r) =>
        `${r.name}: ${r.submitted ? `unique ${r.unique}, pass ${r.passed}/${r.passed + r.failed}, ${r.hours}h` : (r.flag ?? "missing")}`
      ).join("\n"),
    html: wrap(
      `<p><b>Daily snapshot</b> — ${p.date}</p>
       <p style="color:#475569">${p.submittedCount}/${p.total} submitted (point-in-time)</p>
       <table style="border-collapse:collapse;width:100%;font-size:13px">
         <tr style="text-align:left;color:#94a3b8">
           <th style="padding:4px">Associate</th><th>Status</th><th>Unique</th><th>Hours</th><th>Plan (tmrw)</th></tr>
         ${(p.rows as any[]).map((r) => `
           <tr style="border-top:1px solid #e2e8f0">
             <td style="padding:4px">${r.name}</td>
             <td>${r.submitted ? '<span style="color:#15803d">submitted</span>' : `<span style="color:#b91c1c">${r.flag}</span>`}</td>
             <td>${r.unique}</td><td>${r.hours}</td>
             <td style="color:#475569">${(r.planTomorrow ?? "").slice(0, 60)}</td></tr>`).join("")}
       </table>`
    ),
  }),
  weekly_summary: (p) => ({
    subject: `Weekly QC summary — ${p.from} to ${p.to}`,
    text:
      `Weekly summary ${p.from}..${p.to}\nTotal unique ${p.trends.totalUnique}, avg pass ${p.trends.avgPassRate}%.\n` +
      `Full report: ${p.reportUrl}`,
    html: wrap(
      `<p><b>Weekly summary</b> — ${p.from} to ${p.to}</p>
       <p style="color:#475569">Unique ${p.trends.totalUnique} · Rework ${p.trends.totalRework} · Avg pass ${p.trends.avgPassRate}% · ${p.trends.totalHours}h</p>
       <p style="font-weight:600;margin-top:12px">Rankings</p>
       <table style="border-collapse:collapse;width:100%;font-size:13px">
         <tr style="text-align:left;color:#94a3b8"><th style="padding:4px">#</th><th>Associate</th><th>Unique</th><th>Pass %</th><th>Hours</th></tr>
         ${(p.rankings as any[]).map((r) => `
           <tr style="border-top:1px solid #e2e8f0"><td style="padding:4px">${r.rank}</td><td>${r.name}</td><td>${r.unique}</td><td>${r.passRate}%</td><td>${r.hours}</td></tr>`).join("")}
       </table>
       ${p.feedback ? `<p style="font-weight:600;margin-top:12px">Feedback (super-admin)</p>
         <p style="color:#475569">${p.feedback.total} total · ${p.feedback.anonymous} anonymous</p>` : ""}
       <p style="margin-top:16px"><a href="${p.reportUrl}" style="border:1px solid #0a0a0a;border-radius:6px;padding:8px 14px;color:#0a0a0a;text-decoration:none">Open full report</a></p>`
    ),
  }),
  daily_report: (p) => ({
    subject: `Daily QC snapshot — ${p.date}`,
    text:
      `Daily snapshot ${p.date}\n` +
      p.rows.map((r: any) =>
        `${r.name}: ${r.submitted ? `${r.unique} unique, ${r.passRate}% pass, ${r.hours}h` : `[${r.flag}]`}`
      ).join("\n"),
    html: wrap(
      `<p><b>Daily snapshot</b> — ${p.date}</p>
       <table style="border-collapse:collapse;font-size:13px;width:100%">
         <tr style="text-align:left;color:#64748b">
           <th style="padding:4px">Associate</th><th>Unique</th><th>Rework</th><th>Pass%</th><th>Hours</th><th>Status</th>
         </tr>
         ${p.rows.map((r: any) => `<tr style="border-top:1px solid #e2e8f0">
           <td style="padding:4px">${r.name}</td>
           <td>${r.submitted ? r.unique : "—"}</td>
           <td>${r.submitted ? r.rework : "—"}</td>
           <td>${r.submitted ? r.passRate : "—"}</td>
           <td>${r.submitted ? r.hours : "—"}</td>
           <td>${r.submitted ? "OK" : r.flag}</td></tr>`).join("")}
       </table>`
    ),
  }),
  weekly_report: (p) => ({
    subject: `Weekly QC summary — ${p.fromKey} to ${p.toKey}`,
    text: `Weekly summary ${p.fromKey}..${p.toKey}. Full report: ${p.link}`,
    html: wrap(
      `<p><b>Weekly summary</b> — ${p.fromKey} &rarr; ${p.toKey}</p>
       ${p.feedbackLine ? `<p style="color:#475569">${p.feedbackLine}</p>` : ""}
       <p>Top ranks:</p>
       <ol>${p.top.map((r: any) => `<li>${r.name} — ${r.unique} unique, ${r.passRate}% pass</li>`).join("")}</ol>
       <p style="margin-top:14px"><a href="${p.link}" style="border:1px solid #0a0a0a;border-radius:6px;padding:8px 14px;color:#0a0a0a;text-decoration:none">Open full report</a></p>`
    ),
  }),
  leave_decision: (p) => ({
    subject: `Your leave request was ${p.decision}`,
    text:
      `Your leave ${p.startDate} to ${p.endDate} (${p.days} day(s)) was ${p.decision}.` +
      (p.reason ? `\nReason: ${p.reason}` : ""),
    html: wrap(
      `<p>Your leave request was <b>${p.decision}</b>.</p>
       <p><b>${p.startDate}</b> &rarr; <b>${p.endDate}</b> · ${p.days} day(s)</p>
       ${p.reason ? `<p style="color:#475569">Reason: ${p.reason}</p>` : ""}`
    ),
  }),
};

export function renderEmail(template: string, payload: Record<string, any>): Rendered {
  const r = renderers[template];
  if (!r) throw new Error(`Unknown email template: ${template}`);
  return r(payload);
}
