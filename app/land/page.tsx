import { atlas, SERIES, fmtI, fmtM, pctS, fmtAc } from "@/lib/data";
import { Bars, Line, HBar, Stacked100, Legend } from "@/components/Charts";
import { PageHead, Card, MiniTable } from "@/components/Kit";

export const metadata = { title: "Where growth lands · Growth Atlas" };
const RES = SERIES[0], CI = SERIES[7], VIO = SERIES[4], YEL = SERIES[2], MUT = "var(--muted)";
const p1 = (n: number, d: number) => +(n / (d || 1) * 100).toFixed(1);

export default function Land() {
  const a = atlas;
  const co = a.consumes, cc = a.commerce.consumes, g = a.geology, se = a.serve.residential;
  const cats = ["Prime farmland", "Shrink-swell soil", "Floodplain", "Near stream", "Karst bedrock", "Former rural (RA)"];
  const resV = [p1(co.on_prime_farmland, co.total), p1(co.on_high_shrink_swell, co.total), p1(co.in_floodplain, co.total), p1(co.near_stream_100ft, co.total), g.residential.pct_karst, p1(co.on_ra_land, co.total)];
  const ciV = [p1(cc.on_prime_farmland, cc.total), p1(cc.on_high_shrink_swell, cc.total), p1(cc.in_floodplain, cc.total), p1(cc.near_stream_100ft, cc.total), g.commerce.pct_karst, p1(cc.on_ra_land, cc.total)];

  const cf = a.conformance.residential.by_plan;
  const planMap: any = { residential: "Planned Residential", business: "Planned Business", industrial_employment: "Planned Industry/Jobs", institutional_rec: "Planned Institutional", rural_other: "Planned Rural/Other", unmapped: "Outside plan area" };
  const planCol: any = { business: CI, industrial_employment: CI, unmapped: MUT };
  const planItems = Object.entries(cf).sort((x: any, y: any) => y[1] - x[1]).map(([k, v]: any) => ({ label: planMap[k] || k, value: v, color: planCol[k] || RES }));

  const tdr = a.protected.tdr;
  const ms = a.roads.miles_by_status;
  const catLabel = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const capName = (s: string) => (s || "").replace(/\w[\w']*/g, (w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase()));
  const cupItems = (Object.entries(a.cup.by_category) as [string, number][])
    .sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ label: catLabel(k), value: v, color: SERIES[0] }));
  const fireItems = (Object.entries(a.fire_load.by_district) as [string, number][])
    .sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => ({ label: capName(k), value: v, color: SERIES[4] }));

  return (
    <>
      <PageHead eyebrow="Where growth lands" title="On the valley floor: farmland, karst, and beyond the pipes."
        stats={[
          { v: pctS(se.pct_out_swsa), l: "New homes outside sewer/water", cls: "crit" },
          { v: pctS(g.commerce.pct_karst), l: "C/I built on karst", cls: "crit" },
          { v: fmtI(a.roads.homes_near_planned), l: "Homes on unbuilt road corridors" },
          { v: fmtAc(a.protected.conservation_easement_acres + a.protected.ag_district_acres), l: "Protected / ag-district land" },
        ]}>
        New development concentrates on the flat, well-drained valley floor near I-81 — which is also
        the county’s prime farmland and its soluble limestone karst. Much of it lands beyond the sewer
        and water service area, and ahead of the roads meant to serve it.
      </PageHead>

      <main className="wrap">
        <section className="blk">
          <div className="grid g-2">
            <Card title="What growth is built on" desc="Share of matched permits on each land type — residential vs commercial/industrial."
              foot="C/I sits on prime farmland and karst at ~2× the residential rate: flat, dry, near the interstate.">
              <Legend series={[{ label: "Residential", color: RES }, { label: "Commercial/Industrial", color: CI }]} />
              <Bars cats={cats} mode="group" fmt="pct"
                series={[{ label: "Residential", color: RES, values: resV }, { label: "Commercial/Industrial", color: CI, values: ciV }]} />
              <MiniTable cols={["Land type", "Residential", "C/I"]} rows={cats.map((c, i) => [c, pctS(resV[i]), pctS(ciV[i])])} />
            </Card>

            <Card title="Growth on karst bedrock" desc="Carbonate limestone/dolomite — sinkhole, collapse & groundwater risk."
              foot="Karst is a bedrock-lithology proxy; no mapped-sinkhole layer exists. C/I is 2× over-represented.">
              <Bars cats={["County baseline", "Residential", "Commercial/Ind."]} fmt="pct"
                series={[{ label: "On karst", color: YEL, values: [g.pct_county_karst, g.residential.pct_karst, g.commerce.pct_karst] }]} />
              <MiniTable cols={["Group", "On karst", "Detail"]} rows={[
                ["County baseline", pctS(g.pct_county_karst), fmtAc(g.county_karst_acres)],
                ["Residential permits", pctS(g.residential.pct_karst), `${g.residential.on_karst} of ${g.residential.total}`],
                ["C/I permits", pctS(g.commerce.pct_karst), `${g.commerce.on_karst} of ${g.commerce.total}`]]} />
            </Card>

            <Card title="Cost to serve — homes beyond the pipes" desc="Share of new homes built outside the sewer & water service area, per year."
              foot={`Median new home: ${se.med_fire_mi} mi to a fire station, ${se.med_school_mi} mi to a school.`}>
              <Line cats={se.by_year.map((r: any) => r.year)} fmt="pct"
                series={[{ label: "% outside SWSA", color: VIO, values: se.by_year.map((r: any) => r.pct_out_swsa) }]} />
              <MiniTable cols={["Year", "Homes", "Outside SWSA", "Fire mi", "School mi"]}
                rows={se.by_year.map((r: any) => [r.year, r.total, pctS(r.pct_out_swsa), r.med_fire_mi, r.med_school_mi])} />
            </Card>

            <Card title="Realized homes vs. the long-range plan" desc="Where new homes fell relative to the plan's designated use."
              foot={`${a.conformance.residential.on_employment_land} homes landed on land the plan reserves for business or industry; ~36% built outside the mapped growth area entirely.`}>
              <HBar items={planItems} />
              <MiniTable cols={["Plan designation", "New homes"]} rows={planItems.map((i) => [i.label, fmtI(i.value)])} />
            </Card>

            <Card title="Land locked from development" desc="Protected acreage — and the dormant growth-management tool.">
              <MiniTable open cols={["Program", "Amount", "Detail"]} rows={[
                ["Conservation easements", fmtAc(a.protected.conservation_easement_acres), `${a.protected.conservation_easements} easements`],
                ["Agricultural districts", fmtAc(a.protected.ag_district_acres), `${a.protected.ag_district_parcels} parcels`],
                ["TDR rights available", fmtI(tdr.rights_available), `${fmtAc(tdr.eligible_acres)} eligible`],
                ["TDR rights transferred", fmtI(tdr.rights_transferred), `${Math.round(tdr.rights_transferred / tdr.rights_available * 100)}% used — dormant`]]} />
            </Card>

            <Card title="Roads owed to growth & the I-81 corridor" desc="Planned-but-unbuilt road network, and the interstate commercial overlay.">
              <MiniTable open cols={["Road plan status", "Miles"]} rows={Object.entries(ms).map(([k, v]: any) => [k, v])} />
              <div className="foot">
                {fmtI(a.roads.homes_near_planned)} new homes sit within ¼-mile of a planned corridor ({a.roads.planned_miles} mi planned). The I-81 overlay ({a.interstate.overlay_parcels} parcels) is C/I-only — {a.interstate.ci_permits_in_overlay} C/I permits ({fmtM(a.interstate.ci_value_in_overlay)}), {a.interstate.homes_in_overlay} homes.
              </div>
            </Card>

            <Card title="Sprawl — inside vs. outside the growth area" desc="Realized dwellings built inside the Urban Development Area vs. beyond it, per year."
              foot="Roughly half of new homes are built outside the UDA — the pattern the comprehensive plan was meant to prevent.">
              <Legend series={[{ label: "Inside UDA", color: SERIES[1] }, { label: "Outside UDA", color: SERIES[7] }]} />
              <Bars cats={a.outward.map((r: any) => r.year)} mode="group"
                series={[{ label: "Inside UDA", color: SERIES[1], values: a.outward.map((r: any) => r.in) },
                         { label: "Outside UDA", color: SERIES[7], values: a.outward.map((r: any) => r.out) }]} />
              <MiniTable cols={["Year", "Inside UDA", "Outside UDA", "% outside"]}
                rows={a.outward.map((r: any) => [r.year, r.in, r.out, pctS(p1(r.out, r.in + r.out))])} />
            </Card>

            <Card title="Conditional-use permits — rural land pressure" desc="What discretionary rural uses the county actually approves, by case count."
              foot="Utility-scale solar is a big-footprint use (6 cases over ~100 parcels), not the most frequent — CUPs are led by commercial, telecom & events.">
              <HBar items={cupItems} />
              <MiniTable cols={["Use category", "CUP cases"]} rows={cupItems.map((i: any) => [i.label, i.value])} />
            </Card>

            <Card title="Fire-service load from new homes" desc="New dwellings falling in each fire company's first-due area."
              foot="Growth is lopsided — the Stephens City company absorbs the most, a demand the flat county budget doesn't reflect.">
              <HBar items={fireItems} />
              <MiniTable cols={["Fire company", "New homes"]} rows={fireItems.map((i: any) => [i.label, fmtI(i.value)])} />
            </Card>

            <Card title="Town vs. unincorporated county" desc="Where new homes land — inside the two incorporated towns, or the county at large.">
              <Stacked100 fmt="int" segs={[
                { label: "Unincorporated county", value: a.towns.homes_unincorporated, color: SERIES[7] },
                { label: "Incorporated towns", value: a.towns.homes_in_towns, color: SERIES[1] }]} />
              <MiniTable cols={["Location", "New homes", "Share"]} rows={[
                ["Unincorporated county", fmtI(a.towns.homes_unincorporated), pctS(100 - a.towns.pct_in_towns)],
                [`Towns (${a.towns.incorporated_towns.join(", ")})`, fmtI(a.towns.homes_in_towns), pctS(a.towns.pct_in_towns)]]} />
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
