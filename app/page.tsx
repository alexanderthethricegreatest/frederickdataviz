import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Home as HomeIcon, Layers, TreePine, Coins, Users, Map as MapIcon, Vote } from "lucide-react";
import { atlas, votesAnalysis, SERIES, fmtI, fmtM, pctS } from "@/lib/data";
import { Bars, Legend } from "@/components/Charts";
import { Card, MiniTable } from "@/components/Kit";
import HomeMotion from "@/components/motion/HomeMotion";
import CountUp from "@/components/motion/CountUp";
import TiltCard from "@/components/motion/TiltCard";

const LEDGER_CLASSES = [
  { key: "commercial_industrial", label: "Commercial / Industrial", tone: "pays", note: "pays its own way" },
  { key: "residential", label: "Residential", tone: "cost", note: "recurring net cost to serve" },
  { key: "rural_ag", label: "Rural / Agricultural", tone: "flat", note: "low service demand" },
  { key: "other", label: "Other / exempt", tone: "flat", note: "public & tax-exempt" },
];

export default function Home() {
  const a = atlas;
  const snap = a.taxbase.snapshot;
  const ci = snap.find((x: any) => x.class === "commercial_industrial");
  const byClass = (k: string) => snap.find((x: any) => x.class === k) || { pct_of_total: 0 };
  const maxPct = Math.max(...snap.map((x: any) => x.pct_of_total));
  const dwell = a.densify.reduce((s: number, d: any) => s + d.total, 0);
  const zy = a.supply.zoned_by_year;
  const top4 = a.developers.top_builders.slice(0, 4).reduce((s: number, b: any) => s + b.pct, 0);

  return (
    <HomeMotion>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-lede">
            <div className="eyebrow">Independent Planning Atlas · Frederick County, VA</div>
            <h1>See what growth is really doing to Frederick County.</h1>
            <p>Every land-use application, the full pipeline each one moved through, who is building,
               where it lands, and what it costs the county — assembled from open records the county
               never puts in one place.</p>
            <div className="cta">
              <Link href="/applications" className="btn primary">Browse all {a.applications.total} applications <ArrowRight size={16} /></Link>
              <Link href="/fiscal" className="btn">The fiscal story</Link>
            </div>
          </div>

          {/* signature: the thesis as a surveyor's balance sheet */}
          <aside className="ledger" aria-label="Tax base — who pays for growth">
            <div className="lh"><span>Tax base · who pays</span><span className="n">assessed value</span></div>
            {LEDGER_CLASSES.map(({ key, label, tone, note }) => {
              const pct = byClass(key).pct_of_total;
              return (
                <div className={"ledger-row " + tone} key={key}>
                  <span className="lc">{label}</span>
                  <span className="lp">{pctS(pct)}</span>
                  <span className="lbar"><i style={{ width: `${(pct / maxPct) * 100}%` }} /></span>
                  <span className="lnote">{note}</span>
                </div>
              );
            })}
            <p className="lfoot">The base that pays is under a fifth — and residential develops
               by-right, so the docket that officials actually vote on barely touches it.</p>
          </aside>
        </div>
      </section>

      <main className="wrap">
        <section className="blk">
          <div className="grid g-tiles">
            <Tile icon={<Layers size={16} />} value={a.applications.total} fmt="int" k="Applications" n={`${a.applications.approved} approved · 2017–2026`} />
            <Tile icon={<HomeIcon size={16} />} value={dwell} fmt="int" k="Dwellings permitted" n="~716 / year realized" />
            <Tile icon={<Building2 size={16} />} value={a.commerce.ci_investment} fmt="money" k="C/I construction" n="commercial + industrial, 10 yr" />
            <Tile icon={<Coins size={16} />} value={ci.pct_of_total} fmt="pct" k="C/I share of tax base" n={`${fmtM(ci.total_value)} assessed`} crit={ci.pct_of_total < 25} />
            <Tile icon={<HomeIcon size={16} />} value={a.serve.residential.pct_out_swsa} fmt="pct" k="New homes outside sewer/water" n="costly to serve" crit={a.serve.residential.pct_out_swsa > 30} />
            <Tile icon={<TreePine size={16} />} value={a.geology.commerce.pct_karst} fmt="pct" k="C/I built on karst" n={`vs ${pctS(a.geology.pct_county_karst)} of county`} crit />
          </div>
        </section>

        <section className="blk">
          <h2>The one chart that frames it</h2>
          <div className="sub">Rezoning approvals go almost entirely to commercial &amp; industrial land — residential simply builds by-right on land zoned decades ago.</div>
          <Card title="Rezoning approvals by land class, per year" desc="Acres newly zoned. Residential is near-zero because it needs no rezoning."
            foot="This is the by-right thesis in one view: the discretionary docket is C/I; residential growth is invisible to it.">
            <Legend series={[{ label: "Residential", color: SERIES[0] }, { label: "Commercial/Industrial", color: SERIES[7] }]} />
            <Bars cats={zy.map((r: any) => r.year)} mode="group" fmt="acres"
              series={[{ label: "Residential", color: SERIES[0], values: zy.map((r: any) => r.residential) },
                       { label: "Commercial/Industrial", color: SERIES[7], values: zy.map((r: any) => r.commercial_industrial) }]} />
            <MiniTable cols={["Year", "Residential ac", "C/I ac"]} rows={zy.map((r: any) => [r.year, fmtI(r.residential), fmtI(r.commercial_industrial)])} />
          </Card>
        </section>

        <section className="blk">
          <h2>Explore the atlas</h2>
          <div className="sub">Four ways in — each with the full numbers, not just headlines.</div>
          <div className="grid g-3">
            <NavCard href="/map" icon={<MapIcon size={18} />} title="The map"
              blurb="Every home, business, and application on one canvas — filter by year, toggle the growth-area and service boundaries."
              stats={[[fmtI(a.consumes.total), "mapped homes"], [fmtI(a.applications.total), "applications"]]} />
            <NavCard href="/fiscal" icon={<Coins size={18} />} title="The fiscal axis"
              blurb="Why residential growth runs a deficit and the commercial base can't cover it."
              stats={[[pctS(ci.pct_of_total), "C/I tax base", true], [fmtM(a.commerce.ci_investment), "C/I built"]]} />
            <NavCard href="/land" icon={<TreePine size={18} />} title="Where it lands"
              blurb="Farmland, karst, floodplain — and how far growth outruns roads and services."
              stats={[[pctS(a.serve.residential.pct_out_swsa), "outside SWSA", true], [pctS(a.geology.commerce.pct_karst), "C/I on karst"]]} />
            <NavCard href="/builders" icon={<Users size={18} />} title="Who's building"
              blurb="The concentrated land banks and the handful of builders behind the homes."
              stats={[[Math.round(top4) + "%", "top-4 share"], [fmtI(a.owners.top_by_parcels[0].parcels), "top land bank"]]} />
            <NavCard href="/applications" icon={<Layers size={18} />} title="Application library"
              blurb="Search all 885 cases and open any one to trace its full pipeline."
              stats={[[fmtI(a.applications.total), "applications"], [fmtI(a.applications.approved), "approved"]]} />
            <NavCard href="/votes" icon={<Vote size={18} />} title="How they voted"
              blurb="Every roll-call vote by supervisor and commissioner — dissents, recusals, and attendance."
              stats={[[fmtI(votesAnalysis.bos?.totals?.contested || 0), "contested votes"],
                      [`${Math.round(((votesAnalysis.bos?.totals?.unanimous || 0) / (votesAnalysis.bos?.totals?.recorded || 1)) * 100)}%`, "unanimous"]]} />
          </div>
        </section>
      </main>
    </HomeMotion>
  );
}

function Tile({ icon, value, fmt, k, n, crit }: any) {
  return (
    <div className={"tile" + (crit ? " crit" : "")}>
      <div className="muted" style={{ display: "flex", justifyContent: "flex-end" }}>{icon}</div>
      <div className="v"><CountUp value={value} fmt={fmt} /></div><div className="k">{k}</div>{n && <div className="n">{n}</div>}
    </div>
  );
}
function NavCard({ href, icon, title, blurb, stats }: any) {
  return (
    <TiltCard>
      <Link href={href} className="card navcard">
        <div className="nh"><span className="ic">{icon}</span>{title}<ArrowUpRight size={18} className="arr" /></div>
        <p>{blurb}</p>
        <div className="mini">
          {stats.map(([v, l, crit]: any, i: number) => (
            <span key={i}><b className={crit ? "crit" : ""}>{v}</b><span>{l}</span></span>
          ))}
        </div>
      </Link>
    </TiltCard>
  );
}
