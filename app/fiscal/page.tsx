import { atlas, SERIES, fmtI, fmtM, pctS, fmtAc } from "@/lib/data";
import { Bars, HBar, Stacked100, Legend } from "@/components/Charts";
import { PageHead, Card, MiniTable } from "@/components/Kit";

export const metadata = { title: "The fiscal axis · Growth Atlas" };
const RES = SERIES[0], CI = SERIES[7], RUR = SERIES[3], MUT = "var(--muted)";

export default function Fiscal() {
  const a = atlas;
  const ci = a.taxbase.snapshot.find((x: any) => x.class === "commercial_industrial");
  const tbMap: any = { residential: "Residential", commercial_industrial: "Commercial / Industrial", rural_ag: "Rural / Agricultural", other: "Other" };
  const tbCol: any = { residential: RES, commercial_industrial: CI, rural_ag: RUR, other: MUT };
  const snap = a.taxbase.snapshot;
  const segs = snap.map((x: any) => ({ label: tbMap[x.class] || x.class, value: x.total_value, color: tbCol[x.class] || SERIES[4] }));

  const dec = a.taxbase.by_build_decade;
  const zy = a.supply.zoned_by_year;
  const cby = a.commerce.by_year;
  const sup = a.supply;
  const valRows = [...a.value].sort((x: any, y: any) => y.total_value - x.total_value);
  const zoneItems = (Object.entries(a.commerce.by_zone) as [string, number][])
    .sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => ({ label: k, value: v, color: CI }));

  return (
    <>
      <PageHead eyebrow="The fiscal axis" title="Residential costs. Commercial pays. The base is too thin."
        stats={[
          { v: pctS(ci.pct_of_total), l: "C/I share of tax base", cls: "crit" },
          { v: fmtM(a.commerce.ci_investment), l: "C/I construction, 10 yr" },
          { v: fmtAc(sup.vacant_ci_acres), l: `Vacant C/I land (${Math.round(sup.vacant_ci_acres / sup.ci_zoned_acres * 100)}% unbuilt)` },
          { v: fmtI(sup.supply_acres.residential) + " ac", l: "Residential-zoned land" },
        ]}>
        Frederick County’s residential growth happens by-right and carries a recurring net cost to serve.
        Commercial and industrial land is the counterweight that pays — but it is under a fifth of the
        assessed base, and roughly 40% of what is zoned for it sits unbuilt.
      </PageHead>

      <main className="wrap">
        <section className="blk">
          <div className="grid g-2">
            <Card title="Tax base composition" desc="Share of total assessed value by land-use class."
              foot="Commercial/Industrial is under a fifth of the base — the structural core of the deficit thesis.">
              <Legend series={segs} />
              <Stacked100 segs={segs} fmt="money" />
              <MiniTable cols={["Class", "Assessed value", "Share", "Parcels", "Acres"]}
                rows={snap.map((x: any) => [tbMap[x.class] || x.class, fmtM(x.total_value), pctS(x.pct_of_total), fmtI(x.parcels), fmtI(x.acres)])} />
            </Card>

            <Card title="Rezoning approvals by class" desc="Acres newly zoned per year. Residential is ~nil — it develops by-right."
              foot="Today's rezoning docket creates C/I land; residential needs no rezoning, so it barely appears here.">
              <Legend series={[{ label: "Residential", color: RES }, { label: "Commercial/Industrial", color: CI }]} />
              <Bars cats={zy.map((r: any) => r.year)} mode="group" fmt="acres"
                series={[{ label: "Residential", color: RES, values: zy.map((r: any) => r.residential) },
                         { label: "Commercial/Industrial", color: CI, values: zy.map((r: any) => r.commercial_industrial) }]} />
              <MiniTable cols={["Year", "Residential ac", "C/I ac"]}
                rows={zy.map((r: any) => [r.year, fmtI(r.residential), fmtI(r.commercial_industrial)])} />
            </Card>

            <Card title="Assessed improvement value by era built" desc="When today's taxable buildings were added, by land class."
              foot="The base has grown steadily more residential — improvements outpace C/I ~3–4:1 each decade.">
              <Legend series={[{ label: "Residential", color: RES }, { label: "Commercial/Industrial", color: CI }, { label: "Rural/Ag", color: RUR }]} />
              <Bars cats={dec.map((r: any) => r.decade + "s")} mode="stack" fmt="money"
                series={[{ label: "Residential", color: RES, values: dec.map((r: any) => r.residential || 0) },
                         { label: "Commercial/Industrial", color: CI, values: dec.map((r: any) => r.commercial_industrial || 0) },
                         { label: "Rural/Ag", color: RUR, values: dec.map((r: any) => r.rural_ag || 0) }]} />
              <MiniTable cols={["Decade", "Residential", "C/I", "Rural/Ag"]}
                rows={dec.map((r: any) => [r.decade + "s", fmtM(r.residential || 0), fmtM(r.commercial_industrial || 0), fmtM(r.rural_ag || 0)])} />
            </Card>

            <Card title="C/I building permits per year" desc="Realized commercial & industrial construction (institutional shown apart — it's tax-exempt)."
              foot={`${fmtM(a.commerce.ci_investment)} of commercial + industrial construction value across the decade.`}>
              <Legend series={[{ label: "Commercial", color: RES }, { label: "Industrial", color: CI }, { label: "Institutional", color: MUT }]} />
              <Bars cats={cby.map((r: any) => r.year)} mode="stack"
                series={[{ label: "Commercial", color: RES, values: cby.map((r: any) => r.commercial) },
                         { label: "Industrial", color: CI, values: cby.map((r: any) => r.industrial) },
                         { label: "Institutional", color: MUT, values: cby.map((r: any) => r.institutional) }]} />
              <MiniTable cols={["Year", "Comm.", "Ind.", "Inst.", "C/I value"]}
                rows={cby.map((r: any) => [r.year, r.commercial, r.industrial, r.institutional, fmtM(r.commercial_val + r.industrial_val)])} />
            </Card>

            <Card title="Zoned-land inventory" desc="Standing supply vs what is actually built.">
              <Stacked100 fmt="acres" segs={[
                { label: "Residential-zoned", value: sup.supply_acres.residential, color: RES },
                { label: "C/I-zoned", value: sup.supply_acres.commercial_industrial, color: CI },
                { label: "Other", value: sup.supply_acres.other || 0, color: MUT }]} />
              <MiniTable cols={["Measure", "Acres"]} rows={[
                ["Residential-zoned", fmtI(sup.supply_acres.residential)],
                ["C/I-zoned", fmtI(sup.ci_zoned_acres)],
                ["— vacant C/I (unbuilt)", fmtI(sup.vacant_ci_acres) + `  (${Math.round(sup.vacant_ci_acres / sup.ci_zoned_acres * 100)}%)`],
                ["Vacant C/I parcels", fmtI(sup.vacant_ci_parcels)]]} />
            </Card>

            <Card title="Proffers — do they pay for growth?" desc="Where the 697 mapped proffer points attach, and how rarely housing pays cash."
              foot={`Only ${a.proffers.residential_cash_cases.length} rezonings flagged residential cash — all OCR-sourced, pending manual verification.`}>
              <MiniTable open cols={["Proffers attach to…", "Points"]} rows={[
                ["Commercial / Industrial land", fmtI(a.proffers.on_ci_land)],
                ["Residential land", fmtI(a.proffers.on_residential_land)],
                ["Rural / Ag", fmtI(a.proffers.by_zone_class.rural_ag || 0)],
                ["Unmatched parcel", fmtI(a.proffers.by_zone_class.unmatched || 0)]]} />
              <div className="foot" style={{ borderTop: "none", paddingTop: 6 }}>
                {a.proffers.total_points} points across {a.proffers.rezonings_with_proffers} rezonings — proffers follow commerce ~{(a.proffers.on_ci_land / Math.max(a.proffers.on_residential_land, 1)).toFixed(1)}× more than housing.
              </div>
            </Card>

            <Card title="Assessed value by district" desc="Land value vs. building (improvement) value across the eight magisterial districts." wide
              foot="Improvement value dwarfs land value everywhere — the base is what's built on the land, and it's overwhelmingly residential.">
              <Legend series={[{ label: "Land value", color: RUR }, { label: "Improvement value", color: RES }]} />
              <Bars cats={valRows.map((v: any) => v.district)} mode="stack" fmt="money"
                series={[{ label: "Land value", color: RUR, values: valRows.map((v: any) => v.land_value) },
                         { label: "Improvement value", color: RES, values: valRows.map((v: any) => v.improvement) }]} />
              <MiniTable cols={["District", "Land", "Improvement", "Total", "Parcels"]}
                rows={valRows.map((v: any) => [v.district, fmtM(v.land_value), fmtM(v.improvement), fmtM(v.total_value), fmtI(v.parcels)])} />
            </Card>

            <Card title="Where C/I actually gets built" desc="Parcel-matched commercial & industrial permits, by the zoning they landed on.">
              <HBar items={zoneItems} />
              <MiniTable cols={["Zone", "C/I permits"]} rows={zoneItems.map((z: any) => [z.label, z.value])} />
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
