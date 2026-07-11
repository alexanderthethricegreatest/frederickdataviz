import { atlas, SERIES, fmtI, fmtM, fmtAc } from "@/lib/data";
import { Bars, HBar, Legend } from "@/components/Charts";
import { PageHead, Card, MiniTable } from "@/components/Kit";

export const metadata = { title: "Who's building · Growth Atlas" };
const cap = (s: string) => (s || "").replace(/\w[\w']*/g, (w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase()));

export default function Builders() {
  const a = atlas;
  const owners = a.owners.top_by_parcels.slice(0, 12);
  const builders = a.developers.top_builders.slice(0, 12);
  const byYear = a.developers.by_year;
  const hist = a.historical.filter((h: any) => h.decade >= 1950);
  const dz = a.densify;
  const eng = a.engineers.slice(0, 12);
  const top4 = builders.slice(0, 4).reduce((s: number, b: any) => s + b.pct, 0);
  const horton = owners.find((o: any) => o.owner.includes("HORTON"));

  const dTypes = [["single_family", "Single-family", SERIES[0]], ["townhouse", "Townhouse", SERIES[1]],
    ["duplex", "Duplex", SERIES[2]], ["modular", "Modular", SERIES[4]], ["manufactured", "Manufactured", SERIES[5]], ["multifamily", "Multifamily", SERIES[7]]]
    .filter(([k]) => dz.some((r: any) => r[k as string]));

  return (
    <>
      <PageHead eyebrow="Who's building" title="A handful of national builders on a concentrated land bank."
        stats={[
          { v: cap(builders[0].name), l: `Top builder · ${builders[0].pct}% of homes` },
          { v: Math.round(top4) + "%", l: "Built by the top 4 builders" },
          { v: fmtI(horton?.parcels || 0), l: "D.R. Horton parcels (incl. Forestar)" },
          { v: fmtI(a.historical.reduce((s: number, h: any) => s + h.homes, 0)), l: "Homes on record" },
        ]}>
        A small set of production builders put up the county's housing, on land banked years ahead,
        led by D.R. Horton, whose Forestar arm holds the largest lot inventory. The rezoning docket, by
        contrast, is filed by a few engineering firms, not the builders themselves.
      </PageHead>

      <main className="wrap">
        <section className="blk">
          <h2>The land bank &amp; the builders</h2>
          <div className="sub">Who holds the land and who puts up the homes, and how few of each there are.</div>
          <div className="grid g-2">
            <Card title="Top landowners" desc="By parcel count: the developer land banks. Forestar folded into D.R. Horton."
              foot="Land ownership at the top = pre-positioned residential lot inventory, the by-right housing supply.">
              <HBar items={owners.map((o: any) => ({ label: cap(o.owner), value: o.parcels, sub: fmtI(o.acres) + " ac" }))} />
              <MiniTable cols={["Owner", "Parcels", "Acres", "Assessed value"]}
                rows={owners.map((o: any) => [cap(o.owner), fmtI(o.parcels), fmtI(o.acres), fmtM(o.assessed_value)])} />
            </Card>

            <Card title="Top homebuilders" desc="Dwelling units permitted 2017–2026."
              foot={`The top 4 builders account for ~${Math.round(top4)}% of every home built.`}>
              <HBar items={builders.map((b: any) => ({ label: cap(b.name), value: b.units, sub: b.pct + "%", color: SERIES[1] }))} />
              <MiniTable cols={["Builder", "Units", "Share"]} rows={builders.map((b: any) => [cap(b.name), fmtI(b.units), b.pct + "%"])} />
            </Card>

            <Card title="Market leader, year by year" desc="The single builder permitting the most dwellings each year."
              foot="Ryan Homes led 2018–2022; D.R. Horton has led every year since 2023, matching its land-bank dominance.">
              <Bars cats={byYear.map((r: any) => r.year)} fmt="int"
                series={[{ label: "Units by top builder", color: SERIES[1], values: byYear.map((r: any) => r.leaders[0]?.units || 0) }]} />
              <MiniTable cols={["Year", "Leader", "Units", "Year total"]}
                rows={byYear.map((r: any) => [r.year, cap(r.leaders[0]?.name || "—"), r.leaders[0]?.units || 0, r.total])} />
            </Card>

            <Card title="Homes by decade built" desc="The long arc of residential construction on record.">
              <Bars cats={hist.map((h: any) => h.decade + "s")} fmt="int"
                series={[{ label: "Homes", color: SERIES[0], values: hist.map((h: any) => h.homes) }]} />
              <MiniTable cols={["Decade", "Homes built"]} rows={hist.map((h: any) => [h.decade + "s", fmtI(h.homes)])} />
            </Card>
          </div>
        </section>

        <section className="blk">
          <h2>What's built, and who files it</h2>
          <div className="sub">The mix of housing that gets built, and the engineering firms that file the applications.</div>
          <div className="grid g-2">
            <Card title="Dwellings permitted by type" desc="Realized construction each year, by dwelling type." wide
              foot="Townhouses have roughly tripled as a share since 2017; the county is densifying, slowly.">
              <Legend series={dTypes.map(([, label, color]) => ({ label: label as string, color: color as string }))} />
              <Bars cats={dz.map((r: any) => r.year)} mode="stack"
                series={dTypes.map(([k, label, color]) => ({ label: label as string, color: color as string, values: dz.map((r: any) => r[k as string] || 0) }))} />
              <MiniTable cols={["Year", ...dTypes.map(([, l]) => l as string), "Total"]}
                rows={dz.map((r: any) => [r.year, ...dTypes.map(([k]) => r[k as string] || 0), r.total])} />
            </Card>

            <Card title="Application filers (engineering firms)" desc="Who prepares the applications: consultants, not builders.">
              <HBar items={eng.map((f: any) => ({ label: cap(f.firm), value: f.cases, sub: fmtI(f.acres) + " ac", color: SERIES[4] }))} />
              <MiniTable cols={["Firm", "Cases", "Acres"]} rows={eng.map((f: any) => [cap(f.firm), fmtI(f.cases), fmtI(f.acres)])} />
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
