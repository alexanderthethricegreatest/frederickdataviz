import summary from "@/data/valley_summary.json";
import { fmtI } from "@/lib/data";
import { PageHead } from "@/components/Kit";
import ValleyMap from "@/components/ValleyMap";
import CountUp from "@/components/motion/CountUp";
import ValleyMotion from "@/components/motion/ValleyMotion";

export const metadata = { title: "Valley Link · Growth Atlas" };

const money = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${n}`;
// impact class ramp (low → high), matches the map's score coloring
const SCORE_STOPS = ["#2d8a5f", "#a7c957", "#e6a13c", "#e07b39", "#cf3a24"];

// why each crossed feature matters (grounded in the impact methodology)
const CROSS_NOTES: Record<string, string> = {
  "Cultivated farmland": "active cropland taken out of production",
  "FEMA floodplain": "flood-prone ground in the easement",
  "Carbonate (karst) bedrock": "karst-prone bedrock, sinkhole & groundwater risk",
  "High shrink-swell soils": "expansive clays, a tower-footing & foundation risk",
  "Mapped sinkholes (DGMR)": "actual mapped sinkholes, direct collapse risk (not just a proxy)",
  "Geologic faults (DGMR)": "mapped bedrock faults the easement crosses",
  "Publicly accessible land": "public / protected land the line crosses",
  "Tuscarora Trail": "a long-distance scenic trail, crossed by the route",
};

function Scorecard({ sc }: { sc: any }) {
  const by: Record<string, number> = Object.fromEntries(sc.crosses.map((c: any) => [c.label, c.value]));
  const q: Record<string, any> = Object.fromEntries(sc.quality.map((x: any) => [x.key, x]));
  const karst = by["Carbonate (karst) bedrock"] || 0, swell = by["High shrink-swell soils"] || 0;
  const trail = by["Tuscarora Trail"] || 0, sinks = by["Mapped sinkholes (DGMR)"] || 0;
  const primeAc = q.farmland?.acres ? q.farmland.acres[3] + q.farmland.acres[4] : 0;
  const posHigh = q.position?.pct_high || 0;
  return (
    <details className="wrap scorecard sc-collapse" open>
      <summary><h2>What the line crosses</h2></summary>
      <p className="sub">Totals for the modeled ±100 ft right-of-way and the {fmtI(sc.parcels)} parcels its centerline crosses.</p>
      <p className="sc-lead">
        The easement runs largely through <b>difficult and uneven ground</b>. Its {fmtI(Math.round(sc.acres))}-acre
        footprint covers <b>{fmtI(karst)} ac of karst-prone carbonate bedrock</b>{sinks > 0 && <>, with <b>{fmtI(sinks)} DGMR-mapped sinkholes inside the easement itself</b></>} and
        {" "}<b>{fmtI(swell)} ac of expansive shrink-swell soils</b>, foundation and groundwater risks for tower siting, and <b>{posHigh}% of it</b> scores
        high for topographic-position impact. It crosses <b>{fmtI(sc.buildings)} structures</b> ({fmtI(sc.homes)} homes),
        {" "}<b>{money(sc.value)}</b> in assessed value, and the Tuscarora Trail {trail}×. The farmland is telling:
        its <i>average</i> score is low, yet <b>{fmtI(primeAc)} ac is prime or high-value cropland</b>, the distributions
        below show these pockets that a single average would hide.
      </p>
      <div className="sc-tiles">
        <div className="t"><div className="v crit"><CountUp value={sc.parcels} fmt="int" /></div><div className="l">Parcels crossed</div></div>
        <div className="t"><div className="v"><CountUp value={sc.acres} fmt="acres" /></div><div className="l">Inside the easement</div></div>
        <div className="t"><div className="v"><CountUp value={sc.value} fmt="money" /></div><div className="l">Assessed value crossed</div></div>
        <div className="t"><div className="v"><CountUp value={sc.homes} fmt="int" /></div><div className="l">Homes on crossed parcels</div></div>
        <div className="t"><div className="v"><CountUp value={sc.buildings} fmt="int" /></div><div className="l">Buildings crossed</div></div>
      </div>
      <div className="sc-cols">
        <div>
          <h4>Sensitive features in the easement</h4>
          {sc.crosses.map((c: any) => (
            <div className="sc-row" key={c.label}>
              <span className="lab">{c.label}{CROSS_NOTES[c.label] && <span className="hint">{CROSS_NOTES[c.label]}</span>}</span>
              <span className="num">{fmtI(c.value)}<span className="u">{c.unit}</span></span>
            </div>
          ))}
        </div>
        <div>
          <h4>Land quality crossed, distribution</h4>
          <p style={{ color: "var(--muted)", fontSize: "var(--fs-xs)", margin: "-4px 0 10px", lineHeight: 1.4 }}>
            Acres of the {fmtI(Math.round(sc.acres))}-ac easement in each score class (0–100), the spread, not just an
            average. Higher farmland/soil/crop = better land lost; higher karst/position = greater physical risk.
          </p>
          <div className="sc-classkey">
            {["1–20", "21–40", "41–60", "61–80", "81–100"].map((lb, i) => (
              <span key={lb}><i style={{ background: SCORE_STOPS[i] }} />{lb}</span>
            ))}
          </div>
          {sc.quality.filter((q: any) => q.acres && q.total).map((q: any) => (
            <div className="sc-dist" key={q.key}>
              <div className="sc-dist-head">
                <span className="nm">{q.label}</span>
                <span className="st">avg ~{q.mean} · max {q.max} · <b>{q.pct_high}%</b> high</span>
              </div>
              <div className="sc-bar">
                {q.acres.map((a: number, i: number) => a > 0 && (
                  <i key={i} style={{ width: `${(100 * a) / q.total}%`, background: SCORE_STOPS[i] }}
                    title={`${q.labels[i]}: ${fmtI(a)} ac`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function ValueLost({ vl }: { vl: any }) {
  const rng = (o: any) => `${money(o.low)} – ${money(o.high)}`;
  const comps: [string, any, string?][] = [
    ["Easement take", vl.easement, "compensation for the ROW land"],
    ["Residual diminution", vl.diminution, "value loss on the rest of nearby parcels"],
    ["Lost development potential", vl.development, "sterilized subdivision value in growth areas, speculative"],
    ["Recurring tax loss / yr", vl.tax_annual, "lost county property-tax revenue"],
    ["20-yr tax loss (present value)", vl.tax_pv20, "@ 4% discount"],
  ];
  const CLS_LABEL: Record<string, string> = { "rural-residential": "Rural residential", agricultural: "Agricultural", industrial: "Industrial", business: "Business", residential: "Residential" };
  return (
    <details className="wrap scorecard sc-collapse" open>
      <summary><h2>Who bears the cost <span className="est-badge">first-pass estimate</span></h2></summary>
      <p className="sub">
        The Valley Link corridor's loss falls overwhelmingly on private landowners, not the county
        treasury. Ranged estimate across {fmtI(vl.n_parcels)} corridor parcels, an estimate, not an appraisal.
      </p>
      <div className="sc-contrast">
        <div className="side private">
          <div className="tag">Private burden, residents &amp; landowners</div>
          <div className="big"><CountUp value={vl.property_lost.mid} fmt="money" /></div>
          <div className="sub">one-time property value lost (range {rng(vl.property_lost)}) · {vl.absentee_share}% to out-of-state owners</div>
        </div>
        <div className="vs">vs</div>
        <div className="side public">
          <div className="tag">Public, net county fiscal</div>
          {vl.net_county_annual ? <>
            <div className="big" style={{ color: "var(--good)" }}><CountUp value={vl.net_county_annual.mid} fmt="money" prefix="+" /><span style={{ fontSize: "var(--fs-md)", fontWeight: 500 }}>/yr</span></div>
            <div className="sub">a likely net <b>gain</b>: utility tax on the 765&nbsp;kV line (~{money(vl.utility_tax_annual.mid)}/yr) exceeds the ~{money(vl.tax_annual.mid)}/yr real-estate loss. Range {money(vl.net_county_annual.low)}–{money(vl.net_county_annual.high)}/yr</div>
          </> : <>
            <div className="big">{money(vl.tax_pv20.mid)}</div>
            <div className="sub">lost tax revenue, 20-yr PV</div>
          </>}
        </div>
      </div>
      <p className="sc-lead">
        It&rsquo;s starker than &ldquo;the county loses little.&rdquo; Once you count the tax Frederick collects on the
        <b> line itself</b>, SCC-assessed 765&nbsp;kV public-service property, taxed at $0.48/$100, the county likely
        comes out a <b>net fiscal winner</b> (~<b>{money(vl.net_county_annual.mid)}/yr</b>), while residents bear a
        one-time <b>{money(vl.property_lost.mid)}</b> loss. The county has a fiscal <i>incentive</i> to permit exactly
        what costs its residents most, a large <b>local private cost</b> for a line serving the regional grid.
        <span style={{ color: "var(--muted)" }}> (The utility figure is forward-looking, route, mileage, and assessed value are still TBD; see assumptions.)</span>
      </p>

      {vl.who_pays && (() => { const w = vl.who_pays; return (
        <div className="whopays">
          <h4 style={{ fontSize: "var(--fs-sm)", fontWeight: 640, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", margin: "6px 0 8px" }}>Who pays vs. who benefits</h4>
          <table>
            <thead><tr><th>Party</th><th>What they get</th><th>How it&rsquo;s felt</th></tr></thead>
            <tbody>
              <tr className="gain"><td>Developers<br /><span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "var(--fs-xs)" }}>Dominion · FirstEnergy · Transource</span></td><td>~{money(w.developer_return_annual.mid)}/yr regulated return ({w.roe_pct}% ROE on ~{money(w.project_cost.mid)})</td><td>guaranteed profit → incentive to build big</td></tr>
              <tr><td>PJM ratepayers<br /><span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "var(--fs-xs)" }}>~65M people, 13 states + DC</span></td><td>the socialized cost of the line</td><td><b>~${w.ratepayer_per_household_annual.mid}/household/yr</b>, nobody organizes against pennies</td></tr>
              <tr><td>Data-center load growth</td><td>the grid capacity it drove</td><td>benefit concentrated, cost externalized</td></tr>
              <tr className="harm"><td>Frederick residents<br /><span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "var(--fs-xs)" }}>~1,100 households in the path</span></td><td><b>−{money(vl.property_lost.mid)}</b> one-time + ~{money(w.frederick_ratepayer_annual.mid)}/yr as ratepayers</td><td>concentrated harm, but outgunned</td></tr>
              <tr className="gain"><td>Frederick County</td><td>+{money(vl.net_county_annual.mid)}/yr, <i>maybe</i></td><td>barely notices</td></tr>
            </tbody>
          </table>
          <p style={{ color: "var(--muted)", fontSize: "var(--fs-xs)", marginTop: 9, maxWidth: "88ch", lineHeight: 1.5 }}>
            A diffuse-cost / concentrated-harm asymmetry: the developer earns a guaranteed return, the ~{money(w.project_cost.mid)} cost
            is spread so thin (~${w.ratepayer_per_household_annual.mid}/household) that no ratepayer fights it, the load growth gets served, and ~1,100 rural
            households absorb a {money(vl.property_lost.mid)} hit. Frederick residents pay <i>twice</i>: the full local loss <i>and</i> their
            (trivial) ratepayer share of the very line that harms them. Not malice, just incentives that all point at a locally-destructive outcome.
            <span style={{ display: "block", marginTop: 4 }}>Cost/ROE from developer &amp; PJM estimates ($1–2.6B, ~10.5% FERC ROE); rate spread across ~{Math.round(w.pjm_households / 1e6)}M PJM households, rough, forward-looking.</span>
          </p>
        </div>
      ); })()}
      <div className="sc-cols">
        <div>
          <h4>Components, low · mid · high</h4>
          {comps.map(([lab, o, note]) => (
            <div className="sc-row" key={lab}>
              <span className="lab">{lab}{note && <span className="hint">{note}</span>}</span>
              <span className="num">{money(o.low)} · <b>{money(o.mid)}</b> · {money(o.high)}</span>
            </div>
          ))}
          {vl.ag_production_annual != null && (
            <div className="sc-row"><span className="lab">Farm production lost / yr<span className="hint">cultivated acres in ROW × cash rent (context)</span></span><span className="num">{money(vl.ag_production_annual)}</span></div>
          )}
          {vl.by_class && <>
            <h4 style={{ marginTop: 18 }}>By land type (mid)</h4>
            {vl.by_class.map((c: any) => (
              <div className="sc-row" key={c.cls}><span className="lab">{CLS_LABEL[c.cls] || c.cls}</span><span className="num">{money(c.mid)}</span></div>
            ))}
          </>}
        </div>
        <div>
          <h4>Who bears it, top owners (mid)</h4>
          {vl.owners_top.slice(0, 8).map((o: any) => (
            <div className="sc-row" key={o.owner}>
              <span className="lab">{o.owner}{o.absentee && <span className="hint">out-of-state owner</span>}</span>
              <span className="num">{money(o.mid)}</span>
            </div>
          ))}
        </div>
      </div>

      {(vl.wider || vl.register) && (
        <div className="sc-cols" style={{ marginTop: 20 }}>
          {vl.wider && (
            <div>
              <h4>Wider economic effects <span className="est-badge">rougher</span></h4>
              <div className="sc-row">
                <span className="lab">Construction stimulus <span className="hint">one-time local activity during build, mostly external contractors, temporary <b>gain</b></span></span>
                <span className="num">{money(vl.wider.construction_onetime.low)} · <b>{money(vl.wider.construction_onetime.mid)}</b> · {money(vl.wider.construction_onetime.high)}</span>
              </div>
              {vl.wider.hazard_premium_onetime && (
                <div className="sc-row">
                  <span className="lab">Geotechnical hazard premium <span className="hint">extra tower foundations in karst/expansive soils, one-time <b>cost to the project / ratepayers</b>, not the county</span></span>
                  <span className="num">{money(vl.wider.hazard_premium_onetime.low)} · <b>{money(vl.wider.hazard_premium_onetime.mid)}</b> · {money(vl.wider.hazard_premium_onetime.high)}</span>
                </div>
              )}
              <div className="sc-row">
                <span className="lab">Ag-economy ripple / yr <span className="hint">lost farm output × multiplier, small; the ROW stays mostly farmable</span></span>
                <span className="num">{money(vl.wider.ag_ripple_annual.low)} · <b>{money(vl.wider.ag_ripple_annual.mid)}</b> · {money(vl.wider.ag_ripple_annual.high)}</span>
              </div>
            </div>
          )}
          {vl.register && (
            <div>
              <h4>Impacts not monetized</h4>
              {vl.register.map((r: any) => (
                <div className="sc-row" key={r.label}>
                  <span className="lab">{r.label}{r.metric && <b> · {r.metric}</b>}<span className="hint">{r.note}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p style={{ color: "var(--muted)", fontSize: "var(--fs-xs)", marginTop: 14, maxWidth: "82ch", lineHeight: 1.5 }}>
        Treat the <b>{money(vl.property_lost.mid)}</b> as a <b>floor</b> on the directly-capitalized private loss, not
        &ldquo;the&rdquo; cost. The multipliers above are deliberately rough; the register lists real losses that resist a
        price, named, not summed, so the honest total is &ldquo;this much in property value, <i>plus</i> everything the number can&rsquo;t hold.&rdquo;
      </p>
      <details className="sc-assume">
        <summary>Assumptions &amp; sources</summary>
        <ul>{vl.assumptions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
      </details>
    </details>
  );
}

export default function ValleyLinkPage() {
  const s = summary as any;
  return (
    <>
      <PageHead eyebrow="The transmission corridor" title="What the Valley Link line runs through in Frederick County."
        stats={[
          { v: fmtI(s.corridor_parcels), l: "Parcels in the study corridor" },
          { v: fmtI(s.crossed_parcels), l: "Crossed by the modeled ROW", cls: "crit" },
          { v: `${fmtI(Math.round(s.taken_acres))} ac`, l: "Inside the 200 ft easement" },
          { v: fmtI(s.homes_corridor), l: "Corridor parcels with a home" },
        ]}>
        The proposed Valley Link route, its landowners, and what it runs through in Frederick County. Parcels are
        colored by how directly the line hits them, or by soil, farmland, karst and position scores; toggle the
        overlays to see soils, geology, farmland, floodplain, public lands and more along the way.
      </PageHead>
      <ValleyMotion>
        {s.scorecard && <Scorecard sc={s.scorecard} />}
        {s.valueLost && <ValueLost vl={s.valueLost} />}
        <main className="wrap">
          <section className="blk">
            <ValleyMap />
            <p style={{ color: "var(--muted)", fontSize: "var(--fs-xs)", marginTop: 12, maxWidth: "78ch", lineHeight: 1.5 }}>
              &ldquo;Crossed&rdquo; parcels sit inside the <b>modeled ±100 ft right-of-way</b>, the published centerline
              buffered to a true 200 ft easement, <i>not</i> the project&rsquo;s illustrative 2.3-mile &ldquo;Typical 200 ft ROW*&rdquo;
              swath. Parcel boundaries are the county&rsquo;s authoritative cadastre; soil scores are area-weighted from the
              SSURGO Agricultural Soil Suitability data; karst &amp; position scores are zonal from the DCR impact rasters.
            </p>
          </section>
        </main>
      </ValleyMotion>
    </>
  );
}
