import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { votesAnalysis, fmtI, catColor } from "@/lib/data";
import { Card, MiniTable } from "@/components/Kit";

const BOARDS = ["bos", "pc"] as const;
const pct = (r: number) => (r * 100).toFixed(r * 100 < 10 && r > 0 ? 1 : 0) + "%";

function resolve(id: string) {
  for (const bk of BOARDS) {
    const b = (votesAnalysis as any)[bk];
    if (!b) continue;
    const m = b.members.find((x: any) => `${bk}-${x.slug}` === id);
    if (m) return { board: b, boardKey: bk, m };
  }
  return null;
}

export function generateStaticParams() {
  const out: { member: string }[] = [];
  for (const bk of BOARDS) {
    const b = (votesAnalysis as any)[bk];
    if (b) b.members.forEach((m: any) => out.push({ member: `${bk}-${m.slug}` }));
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ member: string }> }) {
  const { member } = await params;
  const r = resolve(member);
  return { title: r ? `${r.m.name} · ${r.board.label}` : "Member" };
}

export default async function Member({ params }: { params: Promise<{ member: string }> }) {
  const { member } = await params;
  const r = resolve(member);
  if (!r) return notFound();
  const { board, m } = r;

  // agreement partners from the board matrix (if this member is in the core set)
  const mi: number = board.matrix?.names?.indexOf(m.name) ?? -1;
  const partners = mi >= 0
    ? board.matrix.cells[mi]
      .map((c: any, j: number) => (c ? { name: board.matrix.names[j], agree: c.agree, n: c.n } : null))
      .filter(Boolean)
      .sort((a: any, b: any) => b.agree - a.agree)
    : [];
  const allies = partners.slice(0, 3);
  const foes = partners.slice(-3).reverse();

  const catRows = Object.entries(m.by_category || {}).map(([c, v]: any) => {
    const dec = v.aye + v.nay;
    return { c, dec, aye: v.aye, nay: v.nay, rate: dec ? v.nay / dec : 0 };
  }).sort((a, b) => b.dec - a.dec);

  return (
    <>
      <section className="detail-head">
        <div className="wrap">
          <div className="crumb"><Link href="/votes"><ArrowLeft size={13} className="ico-mid" /> How they voted</Link></div>
          <h1 style={{ marginTop: 14 }}>{m.name} <span className="muted" style={{ fontWeight: 500, fontSize: "0.55em" }}>{board.label}</span></h1>
          <div className="statstrip" style={{ marginTop: 16 }}>
            <div className="s"><div className="v">{fmtI(m.votes_cast)}</div><div className="l">Recorded votes · {m.tenure[0]?.slice(0, 4)}–{m.tenure[1]?.slice(0, 4)}</div></div>
            <div className="s"><div className="v">{pct(m.dissent_rate)}</div><div className="l">Dissent rate ({m.nay} nay)</div></div>
            <div className="s"><div className="v">{pct(m.present_rate)}</div><div className="l">Present rate ({m.absent} absent)</div></div>
            <div className="s"><div className="v">{fmtI(m.recused)}</div><div className="l">Recusals</div></div>
          </div>
        </div>
      </section>

      <main className="wrap">
        <div className="detail-grid">
          <div>
            <Card title="Dissenting votes"
              desc={m.dissents.length ? `The ${m.dissents.length} recorded ${m.dissents.length > 1 ? "votes" : "vote"} cast against the majority.` : undefined}
              foot={m.dissents.length ? undefined : "No recorded dissents; voted with the majority on every roll call."}>
              {m.dissents.length > 0 && (
                <div className="recusal-list">
                  {m.dissents.map((d: any, i: number) => (
                    <div key={i} className="recusal">
                      <span className="rec-who">
                        {d.category && <i className="catdot" style={{ background: catColor(d.category) }} />}
                        {d.link ? <Link href={d.link}>{d.caseid || d.title}</Link> : (d.caseid || d.title)}
                      </span>
                      <span className="rec-what">{d.caseid && d.title !== d.caseid ? d.title : ""}</span>
                      <span className="rec-date muted">{(d.date || "").slice(0, 7)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {m.recusals.length > 0 && (
              <div className="mt-sec">
                <Card title="Recusals" desc="Matters this member stepped aside from.">
                  <div className="recusal-list">
                    {m.recusals.map((d: any, i: number) => (
                      <div key={i} className="recusal">
                        <span className="rec-who">{d.link ? <Link href={d.link}>{d.caseid || d.title}</Link> : (d.caseid || d.title)}</span>
                        <span className="rec-what">{d.caseid && d.title !== d.caseid ? d.title : ""}</span>
                        <span className="rec-date muted">{(d.date || "").slice(0, 7)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>

          <div>
            {catRows.length > 0 && (
              <Card title="By land-use category" desc="Recorded votes on keyable land-use cases.">
                <MiniTable open cols={["Category", "Votes", "Nay", "Dissent"]}
                  rows={catRows.map((r) => [r.c, r.dec, r.nay, pct(r.rate)])} />
              </Card>
            )}

            {partners.length > 0 && (
              <div className="mt-sec">
                <Card title="Voting alignment" desc="Of members who sat together often, the share of shared roll-calls they landed on the same side.">
                  <div className="align-grp"><div className="align-h">Most aligned</div>
                    {allies.map((p: any) => (
                      <div key={p.name} className="align-row"><span>{p.name}</span><span className="align-v" style={{ color: "var(--good)" }}>{pct(p.agree)}</span></div>
                    ))}
                  </div>
                  <div className="align-grp"><div className="align-h">Most opposed</div>
                    {foes.map((p: any) => (
                      <div key={p.name} className="align-row"><span>{p.name}</span><span className="align-v" style={{ color: "var(--crit)" }}>{pct(p.agree)}</span></div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
