import Link from "next/link";
import { votesAnalysis, fmtI, catColor } from "@/lib/data";
import { PageHead, Card, MiniTable } from "@/components/Kit";
import { HBar, Stacked100, Heatmap, Legend } from "@/components/Charts";
import BoardSwitcher from "@/components/BoardSwitcher";

export const metadata = { title: "How they voted · Growth Atlas" };

const pct = (r: number) => (r * 100).toFixed(r * 100 < 10 && r > 0 ? 1 : 0) + "%";
const yrs = (t: [string | null, string | null]) =>
  t[0] && t[1] ? `${t[0].slice(0, 4)}–${t[1].slice(0, 4)}` : "—";
const DIR = (d: string) => (d === "approve" ? "approval" : "denial");

const COMP = [
  ["aye", "Aye", "var(--good)"], ["nay", "Nay", "var(--crit)"],
  ["abstain", "Abstain", "var(--warn)"], ["absent", "Absent", "var(--muted)"],
] as const;

function Concordance({ c }: { c: any }) {
  const diverged = c.cases.filter((x: any) => !x.followed);
  return (
    <section className="blk">
      <h2 className="sec-title">Board vs. Planning Commission</h2>
      <div className="cdesc" style={{ marginTop: -6, marginBottom: 14, maxWidth: "72ch" }}>
        The Commission recommends; the Board decides. On the {c.n} land-use cases both bodies
        voted, the Board followed the Commission {pct(c.rate)} of the time, and overruled it {c.diverged} times.
      </div>
      <div className="grid g-2">
        <Card title="How often the Board followed the Commission"
          foot={`${c.followed} of ${c.n} cases decided the same direction the Commission recommended.`}>
          <Legend series={[{ label: "Followed PC", color: "var(--good)" }, { label: "Overruled PC", color: "var(--crit)" }]} />
          <Stacked100 fmt="int" segs={[
            { label: "Followed PC", value: c.followed, color: "var(--good)" },
            { label: "Overruled PC", value: c.diverged, color: "var(--crit)" }]} />
        </Card>
        <Card title="Where they diverged" wide
          desc="Cases the Board decided against the Planning Commission's recommendation: the real friction points."
          foot="A Commission recommendation is advisory; these are the cases where the elected Board went the other way.">
          <details className="data">
            <summary>{`View the ${diverged.length} diverging ${diverged.length === 1 ? "case" : "cases"}`}</summary>
            <div className="recusal-list" style={{ marginTop: 8 }}>
              {diverged.map((r: any, i: number) => (
                <div key={i} className="recusal">
                  <span className="rec-who">
                    {r.category && <i className="catdot" style={{ background: catColor(r.category) }} />}
                    {r.link ? <Link href={r.link}>{r.caseid}</Link> : r.caseid}
                  </span>
                  <span className="rec-what">
                    PC urged <b>{DIR(r.pc_dir)}</b> → Board <b>{r.bos_dir === "approve" ? "approved" : "denied"}</b>
                    {r.title && r.title !== r.caseid ? ` · ${r.title}` : ""}
                  </span>
                  <span className="rec-date muted">{(r.bos_date || "").slice(0, 7)}</span>
                </div>
              ))}
            </div>
          </details>
        </Card>
      </div>
    </section>
  );
}

function BoardSection({ b, minApp, bk }: { b: any; minApp: number; bk: string }) {
  const members = b.members as any[];
  const t = b.totals;
  const rated = members.filter((m) => m.aye + m.nay >= minApp);
  const byDissent = [...rated].sort((a, c) => c.dissent_rate - a.dissent_rate).slice(0, 14);
  const comp = COMP.map(([k, label, color]) => ({
    label, color, value: members.reduce((s, m) => s + (m[k] || 0), 0),
  }));
  // land-use docket: member-votes by category (residential is near-absent by design)
  const cats: Record<string, { aye: number; nay: number }> = {};
  members.forEach((m) => Object.entries(m.by_category || {}).forEach(([c, v]: any) => {
    cats[c] = cats[c] || { aye: 0, nay: 0 };
    cats[c].aye += v.aye; cats[c].nay += v.nay;
  }));
  const docket = Object.entries(cats).map(([c, v]) => ({ c, n: v.aye + v.nay, nay: v.nay }))
    .sort((a, c) => c.n - a.n);
  const recusals = members.flatMap((m) => (m.recusals as any[]).map((r) => ({ ...r, member: m.name })));

  return (
    <section className="blk">
      <h2 className="sec-title">{b.label}</h2>
      <div className="cdesc" style={{ marginTop: -6, marginBottom: 14, maxWidth: "72ch" }}>
        {fmtI(t.decisions)} recorded decisions {t.span[0]}–{t.span[1]} · {fmtI(t.recorded)} with a
        per-member roll-call ({fmtI(t.voice)} by voice / unanimous consent) · {fmtI(t.contested)} contested.
      </div>

      <div className="grid g-2">
        <Card title="The board's temperament" desc="Every recorded member-vote, by how it was cast."
          foot={`Board-wide dissent rate: ${pct(t.board_dissent_rate)} of decisive votes were "nay". ${t.unanimous} of ${t.recorded} recorded votes were unanimous.`}>
          <Legend series={comp.map((c) => ({ label: c.label, color: c.color }))} />
          <Stacked100 segs={comp} fmt="int" />
        </Card>

        <Card title="Who dissents most"
          desc={`Share of each member's decisive votes cast against, among members with ≥${minApp} recorded votes.`}
          foot="The board's independent voices; most members vote with the majority nearly always. Names link to a full record.">
          <HBar fmt="pct" items={byDissent.map((m) => ({
            label: m.name, value: +(m.dissent_rate * 100).toFixed(1),
            sub: `${m.nay}/${m.aye + m.nay}`, color: "var(--crit)",
          }))} />
        </Card>

        <Card title="The discretionary docket" wide
          desc="Recorded land-use votes by category. Residential is near-absent; it develops by-right and rarely reaches a discretionary vote."
          foot="What the Board votes on is commercial, industrial, solar and telecom, not the residential growth that drives the fiscal math.">
          <HBar items={docket.map((d) => ({
            label: d.c, value: d.n, sub: d.nay ? `${d.nay} nay` : "", color: catColor(d.c),
          }))} />
        </Card>

        <Card title="Member record" wide
          desc="Recorded votes only. Present rate = share of appearances the member cast a vote. Click a name for the full record.">
          <MiniTable open
            cols={["Member", "Years", "Votes", "Aye", "Nay", "Dissent", "Absent", "Recused", "Present"]}
            rows={members.map((m) => [
              <Link key={m.slug} href={`/votes/${bk}-${m.slug}`}>{m.name}</Link> as any,
                yrs(m.tenure), fmtI(m.votes_cast), fmtI(m.aye), fmtI(m.nay),
                pct(m.dissent_rate), fmtI(m.absent), fmtI(m.recused), pct(m.present_rate),
  ])} />
        </Card>

        {b.matrix?.names?.length > 2 && (
          <Card title="Who votes together" wide
            desc="Agreement between members who sat together often. Darker = the pair landed on opposite sides more often (of their shared recorded votes)."
            foot="Blocs and swing votes: most of the board agrees ~90%+ of the time, so the darker cells mark the genuine divides. Hover for the exact figure.">
            <Heatmap names={b.matrix.names} cells={b.matrix.cells} />
          </Card>
        )}

        {recusals.length > 0 && (
          <Card title="Recusals" wide
            desc="When a member stepped aside from a vote, usually a conflict of interest on a specific matter.">
            <div className="recusal-list">
              {recusals.map((r: any, i: number) => (
                <div key={i} className="recusal">
                  <span className="rec-who">{r.member}</span>
                  <span className="rec-what">
                    recused on {r.link ? <Link href={r.link}>{r.caseid || r.title}</Link> : (r.caseid || r.title)}
                    {r.title && r.title !== r.caseid ? ` · ${r.title}` : ""}
                  </span>
                  <span className="rec-date muted">{r.date || ""}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

export default function Votes() {
  const bos = votesAnalysis.bos;
  const pc = votesAnalysis.pc;
  const con = votesAnalysis.concordance;
  const t = bos?.totals || {};

  return (
    <>
      <PageHead eyebrow="How they voted" title="Every recorded vote, member by member."
        stats={[
          { v: fmtI(t.decisions || 0), l: `Board decisions ${t.span?.[0] || ""}–${t.span?.[1] || ""}` },
          { v: `${Math.round(((t.unanimous || 0) / (t.recorded || 1)) * 100)}%`, l: "of roll-calls were unanimous" },
          { v: con ? pct(con.rate) : "—", l: "of cases: Board followed the PC" },
          { v: fmtI(t.contested || 0), l: "contested decisions" },
        ]}>
        Frederick County land-use decisions are made by roll call. The record shows the outcome and
        how each supervisor and commissioner voted, when they dissented, when they stepped aside, and
        who tends to vote together. Most votes pass unanimously, so the exceptions are what this record
        captures: the dissents, the recusals, and the cases where the Board overruled its Planning Commission.
      </PageHead>

      <main className="wrap">
        {con && <Concordance c={con} />}
        <BoardSwitcher tabs={[
          bos && { key: "bos", label: "Board of Supervisors", hint: `${fmtI(bos.totals.decisions)} decisions`, node: <BoardSection b={bos} minApp={20} bk="bos" /> },
          pc && { key: "pc", label: "Planning Commission", hint: `${fmtI(pc.totals.decisions)} decisions`, node: <BoardSection b={pc} minApp={5} bk="pc" /> },
        ].filter(Boolean) as any} />
        <p className="foot" style={{ maxWidth: "72ch", margin: "8px auto 40px" }}>
          Votes are extracted from official meeting minutes. Per-member tables and the agreement
          matrix cover roll-call votes only; voice and unanimous-consent actions are counted in totals
          but have no individual attribution. Names are normalized across OCR variants.
        </p>
      </main>
    </>
  );
}
