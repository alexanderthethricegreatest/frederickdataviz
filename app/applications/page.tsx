import { apps, meta, atlas, SERIES, fmtI, fmtAc, pctS } from "@/lib/data";
import LibraryBrowser from "@/components/LibraryBrowser";
import { Bars, Line, Legend } from "@/components/Charts";
import { Card, MiniTable } from "@/components/Kit";

export const metadata = { title: "Applications · Growth Atlas" };

export default function ApplicationsPage() {
  const ap = atlas.applications;
  const fy = ap.by_filed_year;
  // stacked by casetype: top 7 + Other
  const totals: any = {};
  fy.forEach((r: any) => Object.entries(r.by_type).forEach(([k, v]: any) => (totals[k] = (totals[k] || 0) + v)));
  const top = Object.entries(totals).sort((x: any, y: any) => y[1] - x[1]).slice(0, 7).map((x) => x[0]);
  const keys = [...top, "Other"];
  const series = keys.map((k, i) => ({
    label: k, color: SERIES[i],
    values: fy.map((r: any) => k === "Other"
      ? Object.entries(r.by_type).filter(([t]: any) => !top.includes(t)).reduce((s: number, [, v]: any) => s + v, 0)
      : (r.by_type[k] || 0)),
  }));

  return (
    <main className="wrap">
      <section className="blk">
        <h2>The application pipeline</h2>
        <div className="sub">How much comes before the planning bodies each year, what it is, and how it fares.</div>
        <div className="statstrip" style={{ marginTop: 0, marginBottom: 20 }}>
          <div className="s"><div className="v">{fmtI(ap.total)}</div><div className="l">Applications, 2017–2026</div></div>
          <div className="s"><div className="v good">{fmtI(ap.approved)}</div><div className="l">Approved</div></div>
          <div className="s"><div className="v">{ap.denied}</div><div className="l">Denied</div></div>
          <div className="s"><div className="v">{ap.pending}</div><div className="l">Pending</div></div>
          <div className="s"><div className="v">{ap.median_approval_months} mo</div><div className="l">Median approval</div></div>
          <div className="s"><div className="v">{fmtI(ap.total_acres)} ac</div><div className="l">Under application</div></div>
        </div>

        <div className="grid g-2">
          <Card title="Applications filed per year" desc="Stacked by case type. 2026 is year-to-date, so its bar reads low."
            foot="Site plans dominate volume; filing stepped up markedly after 2021.">
            <Legend series={series} />
            <Bars cats={fy.map((r: any) => r.year)} mode="stack" series={series} />
            <MiniTable cols={["Year", ...keys, "Total"]}
              rows={fy.map((r: any, i: number) => [r.year, ...keys.map((k) => series.find((s) => s.label === k)!.values[i]), r.filed])} />
          </Card>

          <Card title="Filed vs. approved, and land under application" desc="Approvals track filings closely — most cases clear."
            foot="Acres under application swing with a few large rezonings/site plans each year.">
            <Legend series={[{ label: "Filed", color: SERIES[0] }, { label: "Approved", color: SERIES[1] }]} />
            <Line cats={fy.map((r: any) => r.year)}
              series={[{ label: "Filed", color: SERIES[0], values: fy.map((r: any) => r.filed) },
                       { label: "Approved", color: SERIES[1], values: fy.map((r: any) => r.approved) }]} />
            <MiniTable cols={["Year", "Filed", "Approved", "Acres"]}
              rows={fy.map((r: any) => [r.year, r.filed, r.approved, fmtI(r.acres)])} />
          </Card>

          <Card title="By case type — how each track behaves" desc="Volume, approval rate, and how long each type takes to decide." wide
            foot="Appeals are slow and mostly denied; Comp Plan Amendments are the hardest to win. Rezoning's recorded span understates its true legislative timeline.">
            <Bars cats={ap.by_type.map((t: any) => t.casetype.length > 12 ? t.casetype.split(" ").map((w: string) => w[0]).join("") : t.casetype)}
              fmt="int" series={[{ label: "Applications", color: SERIES[0], values: ap.by_type.map((t: any) => t.applications) }]} />
            <MiniTable cols={["Case type", "Applications", "Approval rate", "Median approval", "Acres"]}
              rows={ap.by_type.map((t: any) => [t.casetype, fmtI(t.applications), pctS(t.approval_rate), (t.median_approval_months ?? "—") + " mo", fmtI(t.acres)])} />
          </Card>
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 8 }}>
        <h2>Browse every application</h2>
        <div className="sub">All {meta.count.toLocaleString()} cases. Search, filter, sort — click any row for its full pipeline.</div>
        <LibraryBrowser apps={apps} meta={meta} />
      </section>
    </main>
  );
}
