"use client";
import { useEffect, useMemo, useState } from "react";
import { Play, Pause } from "lucide-react";
import { SegmentedControl } from "@radix-ui/themes";
import { geoIdentity, geoPath } from "d3-geo";
import { contourDensity } from "d3-contour";
import { SERIES, catColor, CATEGORY_ORDER, slugify } from "@/lib/data";

type Geo = {
  bbox: [number, number, number, number];
  districts: { name: string; rings: number[][][] }[];
  uda: number[][][]; swsa: number[][][];
  permits: number[][]; ci: number[][];
  apps: { id: string; x: number; y: number; ct: string; cat: string; st: string; yr: number | null }[];
};
type MapType = "dots" | "density" | "districts";
type Layer = "permits" | "ci" | "apps";
const CIK = ["Commercial", "Industrial", "Institutional"];
const CICOL = [SERIES[0], SERIES[7], "var(--muted)"];
const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const readVar = (n: string) => (typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(n).trim() : "") || "#3987e5";
const inRing = (x: number, y: number, r: number[][]) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) c = !c;
  }
  return c;
};

export default function CountyMap() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [mapType, setMapType] = useState<MapType>("dots");
  const [layer, setLayer] = useState<Layer>("permits");
  const [year, setYear] = useState(2026);
  const [cumulative, setCumulative] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [uda, setUda] = useState(true);
  const [swsa, setSwsa] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);

  useEffect(() => { fetch("/geo.json").then((r) => r.json()).then(setGeo); }, []);
  useEffect(() => { if (!playing) return; const t = setInterval(() => setYear((y) => (y >= 2026 ? 2017 : y + 1)), 850); return () => clearInterval(t); }, [playing]);
  const effLayer: Layer = mapType === "dots" ? layer : layer === "apps" ? "permits" : layer;

  const W = 900;
  // d3 projection over planar (EPSG:2283) coords via geoIdentity
  const geom = useMemo(() => {
    if (!geo) return null;
    const [minx, miny, maxx, maxy] = geo.bbox;
    const H = Math.round((W * (maxy - miny)) / (maxx - minx));
    const feats = geo.districts.map((d) => ({ type: "Feature" as const, properties: { name: d.name }, geometry: { type: "MultiPolygon" as const, coordinates: d.rings.map((r) => [r]) } }));
    const fc = { type: "FeatureCollection" as const, features: feats };
    const projection = geoIdentity().reflectY(true).fitExtent([[8, 8], [W - 8, H - 8]], fc as any);
    const path = geoPath(projection);
    const line = (rings: number[][][]) => geoPath(projection)({ type: "MultiLineString", coordinates: rings } as any) || "";
    const pt = (x: number, y: number) => projection([x, y]) as [number, number];
    return { H, feats, path, line, pt, projection };
  }, [geo]);

  const allPts = useMemo(() => {
    if (!geo) return [] as any[];
    if (effLayer === "permits") return geo.permits.map((p) => ({ x: p[0], y: p[1], yr: p[2], k: 0 }));
    if (effLayer === "ci") return geo.ci.map((p) => ({ x: p[0], y: p[1], yr: p[2], k: p[3] }));
    return geo.apps.map((a) => ({ x: a.x, y: a.y, yr: a.yr || 0, k: 0, id: a.id, cat: a.cat, ct: a.ct, st: a.st }));
  }, [geo, effLayer]);

  const memberOf = useMemo(() => {
    if (!geo) return [] as number[];
    return allPts.map((p) => { for (let d = 0; d < geo.districts.length; d++) for (const r of geo.districts[d].rings) if (inRing(p.x, p.y, r)) return d; return -1; });
  }, [geo, allPts]);

  const shown = useMemo(() => allPts.filter((p) => (cumulative ? p.yr <= year : p.yr === year)), [allPts, cumulative, year]);

  const density = useMemo(() => {
    if (!geom || mapType !== "density" || !shown.length) return [];
    return contourDensity<any>().x((p) => geom.pt(p.x, p.y)[0]).y((p) => geom.pt(p.x, p.y)[1]).size([W, geom.H]).bandwidth(15).thresholds(14)(shown);
  }, [geom, shown, mapType]);

  const districtCounts = useMemo(() => {
    if (!geo) return [] as number[];
    const counts = new Array(geo.districts.length).fill(0);
    allPts.forEach((p, i) => { if ((cumulative ? p.yr <= year : p.yr === year) && memberOf[i] >= 0) counts[memberOf[i]]++; });
    return counts;
  }, [geo, allPts, memberOf, cumulative, year]);

  if (!geo || !geom) return <div className="card" style={{ height: 420, display: "grid", placeItems: "center", color: "var(--muted)" }}>Loading map…</div>;
  const { H, feats, path, line, pt } = geom;
  const SEQ = [readVar("--seq1"), readVar("--seq2"), readVar("--seq3"), readVar("--seq4")];
  const dMax = Math.max(1, ...districtCounts);
  const densMax = density.length ? density[density.length - 1].value : 1;

  const legend = mapType === "districts" ? [{ label: "fewer", color: SEQ[0] }, { label: "more homes", color: SEQ[3] }]
    : mapType === "density" ? [{ label: "low", color: SEQ[0] }, { label: "high density", color: SEQ[3] }]
      : effLayer === "ci" ? CIK.map((k, i) => ({ label: k, color: CICOL[i] }))
        : effLayer === "apps" ? CATEGORY_ORDER.slice(0, 8).map((c) => ({ label: c, color: catColor(c) }))
          : [{ label: "New dwelling permit", color: SERIES[0] }];

  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="mapctl">
        <SegmentedControl.Root value={mapType} onValueChange={(v) => setMapType(v as MapType)} size="2">
          <SegmentedControl.Item value="dots">Dots</SegmentedControl.Item>
          <SegmentedControl.Item value="density">Heatmap</SegmentedControl.Item>
          <SegmentedControl.Item value="districts">Districts</SegmentedControl.Item>
        </SegmentedControl.Root>
        <SegmentedControl.Root value={effLayer} onValueChange={(v) => setLayer(v as Layer)} size="2">
          <SegmentedControl.Item value="permits">Homes</SegmentedControl.Item>
          <SegmentedControl.Item value="ci">C/I</SegmentedControl.Item>
          {mapType === "dots" && <SegmentedControl.Item value="apps">Applications</SegmentedControl.Item>}
        </SegmentedControl.Root>
        <label className="chk"><input type="checkbox" checked={uda} onChange={(e) => setUda(e.target.checked)} /> UDA</label>
        <label className="chk"><input type="checkbox" checked={swsa} onChange={(e) => setSwsa(e.target.checked)} /> Sewer/water</label>
      </div>

      <div className="timectl">
        <button className="playbtn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <input type="range" min={2017} max={2026} step={1} value={year} onChange={(e) => { setPlaying(false); setYear(+e.target.value); }} className="yslider" />
        <div className="yearbig">{year}</div>
        <label className="chk"><input type="checkbox" checked={cumulative} onChange={(e) => setCumulative(e.target.checked)} /> cumulative</label>
        <span className="mapcount">{shown.length.toLocaleString()}{mapType === "districts" ? " homes" : " shown"}</span>
      </div>

      <div className="legend" style={{ marginTop: 12 }}>
        {legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}
        {uda && <span><i style={{ background: "none", border: `2px solid ${SERIES[4]}`, width: 9, height: 9 }} />UDA</span>}
        {swsa && <span><i style={{ background: "none", border: `2px dashed ${SERIES[1]}`, width: 9, height: 9 }} />Sewer/water</span>}
      </div>

      <div style={{ overflow: "hidden", borderRadius: 10, marginTop: 6 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: "var(--surface-2)" }}>
          {feats.map((f, i) => (
            <path key={i} className="choro" d={path(f as any) || ""}
              fill={mapType === "districts" ? SEQ[Math.min(3, Math.floor((districtCounts[i] / dMax) * 3.999))] : "var(--surface)"}
              stroke="var(--axis)" strokeWidth={1}
              onMouseMove={mapType === "districts" ? (e) => setTip({ x: e.clientX, y: e.clientY, node: <><b>{geo.districts[i].name}</b><div className="row">{districtCounts[i].toLocaleString()} homes {cumulative ? `by ${year}` : `in ${year}`}</div></> }) : undefined}
              onMouseLeave={() => setTip(null)} />
          ))}

          {mapType === "density" && density.map((c, i) => (
            <path key={i} className="heat" d={geoPath()(c) || ""} fill={SEQ[Math.min(3, Math.floor((c.value / densMax) * 3.999))]} opacity={0.7} />
          ))}

          {swsa && <path d={line(geo.swsa)} fill="none" stroke={SERIES[1]} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.8} />}
          {uda && <path d={line(geo.uda)} fill="none" stroke={SERIES[4]} strokeWidth={1.8} opacity={0.9} />}

          {mapType === "dots" && shown.map((p: any, i) => {
            const isNew = p.yr === year;
            const [cx, cy] = pt(p.x, p.y);
            const fill = effLayer === "ci" ? CICOL[p.k] : effLayer === "apps" ? catColor(p.cat) : SERIES[0];
            const r = effLayer === "permits" ? 1.8 : effLayer === "ci" ? 3.4 : 2.6;
            const interactive = effLayer !== "permits";
            return (
              <circle key={(isNew ? "n" + year + "-" : "o-") + i} className={isNew ? "dot pop" : "dot"}
                cx={cx} cy={cy} r={r} fill={fill}
                stroke={effLayer === "permits" ? "none" : "var(--surface)"} strokeWidth={effLayer === "permits" ? 0 : 0.9}
                opacity={effLayer === "permits" ? 0.55 : 0.9}
                onMouseMove={interactive ? (e) => setTip({ x: e.clientX, y: e.clientY, node: effLayer === "ci" ? <><b>{CIK[p.k]} permit</b><div className="row">built {p.yr}</div></> : <><b>{p.ct} · {p.id}</b><div className="row">{p.cat} · {p.st}</div><div className="row" style={{ color: "var(--accent)" }}>click to open pipeline →</div></> }) : undefined}
                onMouseLeave={interactive ? () => setTip(null) : undefined}
                onClick={effLayer === "apps" ? () => (window.location.href = `/applications/${slugify(p.id)}`) : undefined}
                style={{ cursor: effLayer === "apps" ? "pointer" : "default" }} />
            );
          })}

          {mapType === "districts" && feats.map((f, i) => {
            const [lx, ly] = geoPath(geom.projection).centroid(f as any);
            return (
              <text key={"l" + i} x={lx} y={ly} textAnchor="middle" className="dlabel">
                <tspan>{geo.districts[i].name}</tspan><tspan x={lx} dy="14" className="dnum">{districtCounts[i].toLocaleString()}</tspan>
              </text>
            );
          })}
        </svg>
      </div>

      <div className="foot">
        {mapType === "dots" && (effLayer === "permits" ? "Each dot is a parcel-matched new dwelling. Press play to watch the county fill in — toggle the UDA to see how much lands outside the planned growth area." : effLayer === "ci" ? "Commercial & industrial permits — far fewer, far larger, clustered on the I-81 corridor. Click a dot for detail." : "Applications by category; click any point to open its full pipeline.")}
        {mapType === "density" && "A smooth kernel-density surface (d3-contour) — press play to watch the hot zones spread and intensify year by year."}
        {mapType === "districts" && "New dwellings by magisterial district — press play to see which districts absorbed the growth, and when."}
      </div>

      {tip && <div className="tip" style={{ opacity: 1, left: tip.x > (typeof window !== "undefined" ? innerWidth : 1200) - 240 ? tip.x - 220 : tip.x + 14, top: tip.y + 14 }}>{tip.node}</div>}
    </div>
  );
}
