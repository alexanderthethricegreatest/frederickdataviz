"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Layers } from "lucide-react";
import { SegmentedControl, Select, Popover, Checkbox } from "@radix-ui/themes";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, GeoJsonLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { DataFilterExtension, PathStyleExtension, BrushingExtension } from "@deck.gl/extensions";
import { SERIES, catColor, CATEGORY_ORDER, slugify } from "@/lib/data";

type Geo = {
  bbox: [number, number, number, number];
  districts: { name: string; rings: number[][][] }[];
  uda: number[][][]; swsa: number[][][];
  permits: number[][]; builders: string[]; ci: number[][];
  apps: { id: string; x: number; y: number; ct: string; cat: string; st: string; yr: number | null; prof: number; units: number; appr: number; inuda: number }[];
};
type MapType = "dots" | "density" | "hex" | "districts" | "buildout" | "zoning" | "landuse" | "ledger";
type Layer = "permits" | "ci" | "apps";
type ColorBy = "uniform" | "uda" | "builder";
type LedgerBy = "vpa" | "use" | "sewer";
type RGB = [number, number, number];
const GROWTH: MapType[] = ["dots", "density", "hex", "districts", "buildout"];
const YEAR_VIEW: MapType[] = ["dots", "density", "hex", "districts"];
// context overlays (stack on any base view)
const OVERLAYS = [
  { k: "uda", label: "UDA (growth area)" }, { k: "swsa", label: "Sewer/water area" },
  { k: "schools", label: "Schools" }, { k: "fire", label: "Fire / EMS" },
  { k: "firstdue", label: "Fire response areas" }, { k: "floodplain", label: "Floodplain (FEMA)" },
  { k: "conservation", label: "Conservation land" }, { k: "agdistrict", label: "Ag & forestal districts" },
  { k: "watersheds", label: "Watersheds" }, { k: "labels", label: "Place labels" },
  { k: "brush", label: "Spotlight on hover" },
] as const;

const CIK = ["Commercial", "Industrial", "Institutional"];
const CICOL_HEX = [SERIES[0], SERIES[7], "#82868c"];
const YEAR_MIN = 2017, YEAR_MAX = 2026;

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const CI_RGB = CICOL_HEX.map(hex);
// sequential ramp for heatmap / choropleth (blue → deep), theme-independent
const SEQ_HEX = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab"];
const HEAT_RANGE: RGB[] = ["#eef4fc", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#123a6e"].map(hex);
const GRAY: RGB = [140, 146, 152];
// surveyor-red (cost / outside the growth area) vs ledger-green (inside) — the identity
const udaColors = (t: "light" | "dark") => ({
  in: (t === "dark" ? "#43b581" : "#1c7a51"),
  out: (t === "dark" ? "#f2604a" : "#cf3a24"),
});
// subdivision build-out ramp: unbuilt (red) → half (amber) → built-out (green)
const BUILDOUT_STOPS = [hex("#cf3a24"), hex("#e6a13c"), hex("#1c7a51")];
function buildoutColor(pct: number): RGB {
  const t = Math.max(0, Math.min(1, pct)) * 2;
  const i = t < 1 ? 0 : 1, f = t < 1 ? t : t - 1;
  const a = BUILDOUT_STOPS[i], b = BUILDOUT_STOPS[i + 1];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as RGB;
}

// zoning / land-use → broad class → color (residential = the fiscal protagonist)
const CLASS_HEX: Record<string, string> = { res: SERIES[0], biz: SERIES[1], ind: SERIES[2], civ: SERIES[4], rural: "#8a6d3b" };
const CLASS_LABEL: Record<string, string> = { res: "Residential", biz: "Business", ind: "Industrial", civ: "Institutional / civic", rural: "Rural / agricultural" };
const zoneClass = (z: string) => /^(R|RP|MH)/.test(z) ? "res" : /^B/.test(z) ? "biz" : /^(M|EM)/.test(z) ? "ind" : /^(RA|OM)/.test(z) ? "rural" : "civ";
const luClass = (s: string) => {
  const t = (s || "").toLowerCase();
  if (/resid|density re|mobile home|neighborhood|urban center|pud|planned unit|mixed/.test(t)) return "res";
  if (/business|employ|commerc|warehouse|b2|b3|airport|hc|muco|muio/.test(t)) return "biz";
  if (/industr|extract|landfill|heavy/.test(t)) return "ind";
  if (/instit|park|recreat|community|sna|nrr|err/.test(t)) return "civ";
  return "rural";
};
// translucent fills for constraint overlays
const OV_FILL: Record<string, RGB> = { floodplain: hex("#3987e5"), conservation: hex("#1c7a51"), agdistrict: hex("#b9a97e"), firstdue: hex("#8fb6da"), watersheds: hex("#5a8fbf") };
const SCHOOL_RGB = hex("#4a3aa7"), FIRE_RGB = hex("#e34948");

// tax-base (ledger) ramps: value/acre = ledger-green; residential share = blue; sewer = red→blue
const VPA_STOPS = ["#e8f3ec", "#a9d6ba", "#5cae82", "#1c7a51", "#0d4d31"].map(hex);
const SEW_STOPS = ["#cf3a24", "#e6a13c", "#86b6ef", "#1c5cab"].map(hex);
function rampN(stops: RGB[], t: number): RGB {
  t = Math.max(0, Math.min(1, t));
  const s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
  const a = stops[i], b = stops[i + 1];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as RGB;
}
const fmtMoney = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${Math.round(n)}`;

// point-in-ring (lon/lat planar test — fine at county scale)
const inRing = (x: number, y: number, r: number[][]) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) c = !c;
  }
  return c;
};

// ── theme-aware basemap palette (concrete colors — WebGL can't read light-dark()) ──
type Pal = ReturnType<typeof palette>;
function palette(theme: "light" | "dark") {
  return theme === "dark"
    ? { plane: "#0f1317", sheet: "#191d22", countyLine: "#4a525b", water: "#16324f", waterLine: "#274f76", rail: "#454b52", town: "#8fb6da" }
    : { plane: "#eceee9", sheet: "#fbfcfa", countyLine: "#a7ada4", water: "#dbe8f4", waterLine: "#b4cfe8", rail: "#b6b0a3", town: "#2c5578" };
}
// road ranks 0..3 → color, per theme
const ROAD_COLORS = {
  light: ["#a49f90", "#bab5a6", "#cfcabb", "#e6e3da"],
  dark: ["#5a626c", "#454d57", "#353c45", "#252b32"],
};

function blankStyle(pal: Pal): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": pal.plane } }],
  };
}

function addBasemap(map: maplibregl.Map, bm: any, theme: "light" | "dark") {
  const pal = palette(theme);
  const rc = ROAD_COLORS[theme];
  for (const k of ["county", "water", "streams", "roads", "rail", "towns"]) {
    if (!map.getSource(k)) map.addSource(k, { type: "geojson", data: bm[k] });
  }
  const zw = (a: number, b: number): any => ["interpolate", ["linear"], ["zoom"], 8, a, 14, b];

  map.addLayer({ id: "county-fill", type: "fill", source: "county", paint: { "fill-color": pal.sheet } });
  map.addLayer({ id: "water-fill", type: "fill", source: "water", paint: { "fill-color": pal.water } });
  map.addLayer({ id: "water-line", type: "line", source: "water", paint: { "line-color": pal.waterLine, "line-width": 0.6 } });
  map.addLayer({ id: "streams", type: "line", source: "streams", minzoom: 9.5, paint: { "line-color": pal.waterLine, "line-width": zw(0.3, 1.2), "line-opacity": 0.75 } });

  map.addLayer({ id: "road-local", type: "line", source: "roads", minzoom: 11.5, filter: ["==", ["get", "r"], 3], paint: { "line-color": rc[3], "line-width": zw(0.4, 1.4) } });
  map.addLayer({ id: "road-collector", type: "line", source: "roads", minzoom: 9, filter: ["==", ["get", "r"], 2], paint: { "line-color": rc[2], "line-width": zw(0.5, 2) } });
  map.addLayer({ id: "road-primary", type: "line", source: "roads", filter: ["==", ["get", "r"], 1], paint: { "line-color": rc[1], "line-width": zw(1, 3) } });
  map.addLayer({ id: "road-interstate", type: "line", source: "roads", filter: ["==", ["get", "r"], 0], paint: { "line-color": rc[0], "line-width": zw(1.6, 4.5) } });

  map.addLayer({ id: "rail", type: "line", source: "rail", paint: { "line-color": pal.rail, "line-width": 1, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "town-line", type: "line", source: "towns", paint: { "line-color": pal.town, "line-width": 1.2, "line-dasharray": [3, 2], "line-opacity": 0.7 } });
  map.addLayer({ id: "county-line", type: "line", source: "county", paint: { "line-color": pal.countyLine, "line-width": 1.4 } });
}

function repaint(map: maplibregl.Map, theme: "light" | "dark") {
  if (!map.getLayer("county-fill")) return;
  const pal = palette(theme), rc = ROAD_COLORS[theme];
  const set = (id: string, prop: string, val: any) => map.getLayer(id) && map.setPaintProperty(id, prop as any, val);
  map.setPaintProperty("bg", "background-color", pal.plane);
  set("county-fill", "fill-color", pal.sheet);
  set("county-line", "line-color", pal.countyLine);
  set("water-fill", "fill-color", pal.water);
  set("water-line", "line-color", pal.waterLine);
  set("streams", "line-color", pal.waterLine);
  set("road-local", "line-color", rc[3]);
  set("road-collector", "line-color", rc[2]);
  set("road-primary", "line-color", rc[1]);
  set("road-interstate", "line-color", rc[0]);
  set("rail", "line-color", pal.rail);
  set("town-line", "line-color", pal.town);
}

export default function CountyMap() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [subs, setSubs] = useState<any>(null);
  const [mapType, setMapType] = useState<MapType>("dots");
  const [layer, setLayer] = useState<Layer>("permits");
  const [colorBy, setColorBy] = useState<ColorBy>("uniform");
  const [year, setYear] = useState(YEAR_MAX);
  const [cumulative, setCumulative] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [overlays, setOverlays] = useState<Set<string>>(new Set(["uda"]));
  const [ctx, setCtx] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [ledgerBy, setLedgerBy] = useState<LedgerBy>("vpa");
  const [threeD, setThreeD] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const fitRef = useRef(false);
  const urlReady = useRef(false);

  const effLayer: Layer = mapType === "dots" ? layer : layer === "apps" ? "permits" : layer;
  const has = (k: string) => overlays.has(k);
  const toggle = (k: string) => setOverlays((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const uda = has("uda"), swsa = has("swsa"), brush = has("brush");
  // context.json is needed for the land views and any context overlay
  const needCtx = mapType === "zoning" || mapType === "landuse" ||
    ["schools", "fire", "firstdue", "floodplain", "conservation", "agdistrict", "watersheds", "labels"].some(has);

  useEffect(() => { fetch("/geo.json").then((r) => r.json()).then(setGeo); }, []);
  useEffect(() => { if (mapType === "buildout" && !subs) fetch("/thematic.json").then((r) => r.json()).then((d) => setSubs(d.subdivisions)); }, [mapType, subs]);
  useEffect(() => { if (needCtx && !ctx) fetch("/context.json").then((r) => r.json()).then(setCtx); }, [needCtx, ctx]);
  useEffect(() => { if (mapType === "ledger" && !ledger) fetch("/ledger.json").then((r) => r.json()).then(setLedger); }, [mapType, ledger]);

  // ── shareable state: read the URL once on mount, then mirror state → URL ──
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("v")) setMapType(q.get("v") as MapType);
    if (q.get("l")) setLayer(q.get("l") as Layer);
    if (q.get("cb")) setColorBy(q.get("cb") as ColorBy);
    if (q.get("lb")) setLedgerBy(q.get("lb") as LedgerBy);
    if (q.get("y")) setYear(Math.min(YEAR_MAX, Math.max(YEAR_MIN, +q.get("y")!)) || YEAR_MAX);
    if (q.get("c")) setCumulative(q.get("c") === "1");
    if (q.get("d")) setThreeD(q.get("d") === "1");
    if (q.has("o")) setOverlays(new Set(q.get("o") ? q.get("o")!.split(",") : []));
    urlReady.current = true;
  }, []);
  useEffect(() => {
    if (!urlReady.current) return;
    const q = new URLSearchParams();
    q.set("v", mapType); q.set("y", String(year)); q.set("c", cumulative ? "1" : "0");
    if (["dots", "density", "hex", "districts"].includes(mapType)) q.set("l", effLayer);
    if (mapType === "dots" && effLayer === "permits") q.set("cb", colorBy);
    if (mapType === "ledger") q.set("lb", ledgerBy);
    if (threeD) q.set("d", "1");
    q.set("o", [...overlays].join(","));
    history.replaceState(null, "", `?${q.toString()}`);
  }, [mapType, layer, colorBy, ledgerBy, year, cumulative, threeD, overlays]);
  useEffect(() => { if (!playing) return; const t = setInterval(() => setYear((y) => (y >= YEAR_MAX ? YEAR_MIN : y + 1)), 850); return () => clearInterval(t); }, [playing]);

  // observe the app's theme (data-theme on <html>) so the WebGL basemap recolors
  useEffect(() => {
    const read = () => {
      const t = document.documentElement.getAttribute("data-theme");
      setTheme(t === "dark" ? "dark" : t === "light" ? "light" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => { mo.disconnect(); mq.removeEventListener("change", read); };
  }, []);

  // ── init MapLibre + deck overlay once ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const t = document.documentElement.getAttribute("data-theme");
    const t0: "light" | "dark" = t === "dark" ? "dark" : t === "light" ? "light" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: blankStyle(palette(t0)),
      center: [-78.28, 39.23], zoom: 9.2, minZoom: 8, maxZoom: 15,
      attributionControl: false,
      dragRotate: false, pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ customAttribution: "Frederick County GIS" }));
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as any);
    overlayRef.current = overlay;
    mapRef.current = map;

    map.on("load", () => {
      fetch("/basemap.json").then((r) => r.json()).then((bm) => {
        const cur = document.documentElement.getAttribute("data-theme");
        const th: "light" | "dark" = cur === "dark" ? "dark" : cur === "light" ? "light" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        addBasemap(map, bm, th);
        setReady(true);
      });
    });
    return () => { map.remove(); mapRef.current = null; overlayRef.current = null; };
  }, []);

  // recolor basemap on theme change
  useEffect(() => { const m = mapRef.current; if (m && ready) repaint(m, theme); }, [theme, ready]);

  // fit to county once geo + map are ready
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !geo || fitRef.current) return;
    fitRef.current = true;
    const [w, s, e, n] = geo.bbox;
    m.fitBounds([[w, s], [e, n]], { padding: 24, duration: 0 });
  }, [geo, ready]);

  // tilt the camera for 3D views (hex, or extruded ledger/districts), flatten otherwise
  const tilted = mapType === "hex" || (threeD && (mapType === "ledger" || mapType === "districts"));
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    m.easeTo({ pitch: tilted ? 45 : 0, duration: 600 });
  }, [tilted, ready]);

  // ── data prepared for deck (stable references so the GPU filter stays smooth) ──
  const points = useMemo(() => {
    if (!geo) return [] as any[];
    if (effLayer === "permits") return geo.permits.map((p) => ({ position: [p[0], p[1]], yr: p[2], uda: p[3], bi: p[4] }));
    if (effLayer === "ci") return geo.ci.map((p) => ({ position: [p[0], p[1]], yr: p[2], k: p[3] }));
    return geo.apps.map((a) => ({ position: [a.x, a.y], yr: a.yr || 0, id: a.id, cat: a.cat, ct: a.ct, st: a.st, prof: a.prof }));
  }, [geo, effLayer]);

  // top builders (by permit count) → stable color slots; the rest lump to gray
  const builderTop = useMemo(() => {
    if (!geo) return { color: new Map<number, RGB>(), legend: [] as { label: string; color: string }[] };
    const cnt = new Map<number, number>();
    geo.permits.forEach((p) => cnt.set(p[4], (cnt.get(p[4]) || 0) + 1));
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);
    const color = new Map<number, RGB>();
    const legend = top.map((idx, i) => { color.set(idx, hex(SERIES[i % 8])); return { label: geo.builders[idx], color: SERIES[i % 8] }; });
    return { color, legend };
  }, [geo]);

  const districtFC = useMemo(() => {
    if (!geo) return null;
    return {
      type: "FeatureCollection",
      features: geo.districts.map((d, i) => ({
        type: "Feature", properties: { i, name: d.name },
        geometry: { type: "MultiPolygon", coordinates: d.rings.map((r) => [r]) },
      })),
    };
  }, [geo]);

  const memberOf = useMemo(() => {
    if (!geo) return [] as number[];
    return points.map((p) => { for (let d = 0; d < geo.districts.length; d++) for (const r of geo.districts[d].rings) if (inRing(p.position[0], p.position[1], r)) return d; return -1; });
  }, [geo, points]);

  const districtCounts = useMemo(() => {
    if (!geo) return [] as number[];
    const c = new Array(geo.districts.length).fill(0);
    points.forEach((p, i) => { if ((cumulative ? p.yr <= year : p.yr === year) && memberOf[i] >= 0) c[memberOf[i]]++; });
    return c;
  }, [geo, points, memberOf, cumulative, year]);
  const dMax = Math.max(1, ...districtCounts);

  const ledgerMaxVal = useMemo(() => ledger ? Math.max(1, ...ledger.grid.features.map((f: any) => f.properties.val)) : 1, [ledger]);
  const heatData = useMemo(() => points.filter((p) => (cumulative ? p.yr <= year : p.yr === year)), [points, cumulative, year]);
  const shownCount = mapType === "districts" ? districtCounts.reduce((a, b) => a + b, 0) : heatData.length;
  const subsStat = useMemo(() => {
    if (!subs) return { n: 0, remaining: 0 };
    let remaining = 0, n = 0;
    for (const f of subs.features) { if (f.properties.remaining > 0) remaining += f.properties.remaining; if (f.properties.measured) n++; }
    return { n, remaining };
  }, [subs]);

  const showTip = (info: any, node: React.ReactNode) => {
    if (!info.object) { setTip(null); return; }
    const rect = containerRef.current!.getBoundingClientRect();
    setTip({ x: rect.left + info.x, y: rect.top + info.y, node });
  };

  // ── deck layers ──
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !geo) return;
    const filterRange: [number, number] = cumulative ? [0, year] : [year, year];
    const seqRGB = SEQ_HEX.map(hex);
    const layers: any[] = [];

    // dashed / solid boundary outline (PathStyleExtension for the dashes)
    const outline = (id: string, rings: number[][][], color: RGB, dashed?: boolean) =>
      new PolygonLayer({
        id, data: rings, getPolygon: (d: any) => d, stroked: true, filled: false,
        getLineColor: color, getLineWidth: dashed ? 1.5 : 1.8, lineWidthUnits: "pixels",
        getDashArray: dashed ? [6, 3] : [0, 0], dashJustified: true,
        extensions: dashed ? [new PathStyleExtension({ dash: true })] : [],
        parameters: { depthTest: false },
      });
    // translucent constraint fill from a context FeatureCollection
    const fillOv = (id: string, data: any, rgb: RGB, fa: number, la = 170, tipLabel?: string) =>
      new GeoJsonLayer({
        id, data, stroked: true, filled: true, pickable: !!tipLabel,
        getFillColor: [...rgb, fa] as any, getLineColor: [...rgb, la] as any, lineWidthUnits: "pixels", getLineWidth: 0.8,
        parameters: { depthTest: false },
        onHover: (info: any) => { if (tipLabel) showTip(info, info.object ? <><b>{info.object.properties.name || tipLabel}</b><div className="row">{tipLabel}</div></> : null); },
      });

    // ── 1. base polygon choropleths (bottom) ──
    if (mapType === "zoning" && ctx) {
      layers.push(new GeoJsonLayer({
        id: "zoning", data: ctx.zoning, pickable: true, stroked: true, filled: true,
        getFillColor: (f: any) => [...hex(CLASS_HEX[zoneClass(f.properties.zone)]), 155] as any,
        getLineColor: [255, 255, 255, 45], getLineWidth: 0.5, lineWidthUnits: "pixels",
        onHover: (info: any) => showTip(info, info.object ? <><b>{info.object.properties.zone}</b><div className="row">{info.object.properties.desc || CLASS_LABEL[zoneClass(info.object.properties.zone)]}</div></> : null),
      }));
    } else if (mapType === "landuse" && ctx) {
      layers.push(new GeoJsonLayer({
        id: "landuse", data: ctx.landuse, pickable: true, stroked: true, filled: true,
        getFillColor: (f: any) => [...hex(CLASS_HEX[luClass(f.properties.lu)]), 155] as any,
        getLineColor: [255, 255, 255, 45], getLineWidth: 0.5, lineWidthUnits: "pixels",
        onHover: (info: any) => showTip(info, info.object ? <><b>{info.object.properties.lu}</b><div className="row">planned: {CLASS_LABEL[luClass(info.object.properties.lu)]}</div></> : null),
      }));
    } else if (mapType === "ledger" && ledger) {
      const vpaMax = ledger.summary?.vpaMax || 1e6;
      const ledColor = (p: any): RGB =>
        ledgerBy === "use" ? hex(CLASS_HEX[p.cls] || "#8c9298") :
        ledgerBy === "sewer" ? rampN(SEW_STOPS, p.sewShare) :
        rampN(VPA_STOPS, Math.log1p(p.vpa) / Math.log1p(vpaMax));
      layers.push(new GeoJsonLayer({
        id: "ledger", data: ledger.grid, pickable: true, stroked: false, filled: true,
        extruded: threeD, getElevation: (f: any) => f.properties.val, elevationScale: threeD ? 2600 / ledgerMaxVal : 0, material: false,
        getFillColor: (f: any) => [...ledColor(f.properties), threeD ? 255 : 210] as any,
        updateTriggers: { getFillColor: [ledgerBy, threeD] },
        onHover: (info: any) => showTip(info, info.object ? (() => { const p = info.object.properties; return (
          <><b>{fmtMoney(p.vpa)}/acre</b><div className="row">{fmtMoney(p.val)} assessed · {p.acres.toLocaleString()} ac · {p.n} parcels</div><div className="row">mostly {CLASS_LABEL[p.cls]} ({Math.round(p.clsPct * 100)}% of value) · {Math.round(p.sewShare * 100)}% on public sewer</div></>
        ); })() : null),
      }));
    } else if (mapType === "buildout" && subs) {
      layers.push(new GeoJsonLayer({
        id: "buildout", data: subs, pickable: true, stroked: true, filled: true,
        getLineColor: [120, 128, 120, 120], lineWidthUnits: "pixels", getLineWidth: 0.5,
        getFillColor: (f: any) => { const pct = f.properties.pct; return pct == null ? [150, 150, 150, 20] as any : [...buildoutColor(pct), 200] as any; },
        onHover: (info: any) => showTip(info, info.object ? (() => { const p = info.object.properties; return (
          <><b>{p.name}</b><div className="row">{p.measured ? `${(p.built || 0).toLocaleString()} / ${(p.lots || 0).toLocaleString()} lots built (${Math.round((p.pct || 0) * 100)}%)` : `${(p.lots || 0).toLocaleString()} platted lots`}</div>{p.remaining > 0 && <div className="row" style={{ color: "var(--crit)" }}>{p.remaining.toLocaleString()} lots still to build</div>}</>
        ); })() : null),
      }));
    } else if (mapType === "districts" && districtFC) {
      layers.push(new GeoJsonLayer({
        id: "districts", data: districtFC as any, pickable: true, stroked: true, filled: true,
        extruded: threeD, getElevation: (f: any) => districtCounts[f.properties.i] || 0, elevationScale: threeD ? 4000 / dMax : 0, material: false,
        getLineColor: [120, 128, 120, 180], lineWidthUnits: "pixels", getLineWidth: 1,
        getFillColor: (f: any) => { const t = Math.min(1, districtCounts[f.properties.i] / dMax); return [...seqRGB[Math.min(3, Math.floor(t * 3.999))], threeD ? 255 : 205] as any; },
        updateTriggers: { getFillColor: [districtCounts, dMax, threeD], getElevation: [districtCounts, threeD] },
        onHover: (info: any) => showTip(info, info.object ? <><b>{info.object.properties.name}</b><div className="row">{districtCounts[info.object.properties.i].toLocaleString()} homes {cumulative ? `by ${year}` : `in ${year}`}</div></> : null),
      }));
    }

    // ── 2. constraint / service fills (context overlays) ──
    if (ctx) {
      if (has("firstdue")) layers.push(fillOv("firstdue", ctx.firstdue, OV_FILL.firstdue, 22, 150, "Fire response area"));
      if (has("watersheds")) layers.push(fillOv("watersheds", ctx.watersheds, OV_FILL.watersheds, 14, 150, "Watershed"));
      if (has("agdistrict")) layers.push(fillOv("agdistrict", ctx.agdistrict, OV_FILL.agdistrict, 55, 150));
      if (has("conservation")) layers.push(fillOv("conservation", ctx.conservation, OV_FILL.conservation, 70, 170, "Conservation land"));
      if (has("floodplain")) layers.push(fillOv("floodplain", ctx.floodplain, OV_FILL.floodplain, 70, 130));
    }

    // ── 3. point / heat / hex base (growth) ──
    if (mapType === "density") {
      layers.push(new HeatmapLayer({ id: "heat", data: heatData, getPosition: (d: any) => d.position, getWeight: 1, radiusPixels: 34, intensity: 1, threshold: 0.05, colorRange: HEAT_RANGE as any, aggregation: "SUM" }));
    } else if (mapType === "hex") {
      layers.push(new HexagonLayer({
        id: "hex", data: heatData, getPosition: (d: any) => d.position, radius: 480, coverage: 0.88,
        extruded: true, elevationScale: 5, elevationRange: [0, 1400], colorRange: HEAT_RANGE.slice(1) as any,
        material: false, pickable: true,
        onHover: (info: any) => showTip(info, info.object ? <><b>{info.object.points.length.toLocaleString()} homes</b><div className="row">in this ~½ mi cell {cumulative ? `by ${year}` : `in ${year}`}</div></> : null),
      } as any));
    } else if (mapType === "dots") {
      const udaC = udaColors(theme);
      const getColor: any =
        effLayer === "ci" ? (d: any) => CI_RGB[d.k] :
        effLayer === "apps" ? (d: any) => hex(catColor(d.cat)) :
        colorBy === "uda" ? (d: any) => (d.uda ? hex(udaC.in) : hex(udaC.out)) :
        colorBy === "builder" ? (d: any) => builderTop.color.get(d.bi) || GRAY :
        [...hex(SERIES[0])];
      const radius = effLayer === "permits" ? 2.2 : effLayer === "ci" ? 4.2 : 3.2;
      layers.push(new ScatterplotLayer({
        id: "dots", data: points, getPosition: (d: any) => d.position,
        getFillColor: getColor, getRadius: radius, radiusUnits: "pixels", radiusMinPixels: 1.5, radiusMaxPixels: 7,
        stroked: effLayer !== "permits", getLineColor: [255, 255, 255, 200], lineWidthUnits: "pixels", getLineWidth: 0.8,
        opacity: effLayer === "permits" ? 0.7 : 0.92, pickable: true,
        getFilterValue: (d: any) => d.yr, filterRange,
        brushingEnabled: brush, brushingRadius: 1600,
        extensions: [new DataFilterExtension({ filterSize: 1 }), ...(brush ? [new BrushingExtension()] : [])],
        updateTriggers: { getFillColor: [effLayer, colorBy, theme] },
        onHover: (info: any) => showTip(info, info.object ? (
          effLayer === "ci" ? <><b>{CIK[info.object.k]} permit</b><div className="row">built {info.object.yr}</div></>
          : effLayer === "apps" ? <><b>{info.object.ct} · {info.object.id}</b><div className="row">{info.object.cat} · {info.object.st}</div><div className="row" style={{ color: "var(--accent)" }}>click to follow it through approval →</div></>
          : <><b>New dwelling permit</b><div className="row">built {info.object.yr}</div></>
        ) : null),
        onClick: (info: any) => { if (effLayer === "apps" && info.object) window.location.href = `/applications/${slugify(info.object.id)}`; },
      }));
    }

    // ── 4. growth-area / service-area outlines ──
    if (swsa && geo.swsa.length) layers.push(outline("swsa", geo.swsa, hex(SERIES[1]), true));
    if (uda && geo.uda.length) layers.push(outline("uda", geo.uda, hex(SERIES[4])));

    // ── 5. facilities + labels (top) ──
    if (ctx && has("schools")) layers.push(new ScatterplotLayer({
      id: "schools", data: ctx.schools.features, getPosition: (f: any) => f.geometry.coordinates,
      getFillColor: SCHOOL_RGB, getRadius: 5, radiusUnits: "pixels", radiusMinPixels: 4, radiusMaxPixels: 9,
      stroked: true, getLineColor: [255, 255, 255, 235], getLineWidth: 1.3, lineWidthUnits: "pixels", pickable: true,
      onHover: (info: any) => showTip(info, info.object ? <><b>{info.object.properties.name}</b><div className="row">{info.object.properties.type || "School"}</div></> : null),
    }));
    if (ctx && has("fire")) layers.push(new ScatterplotLayer({
      id: "fire", data: ctx.fire.features, getPosition: (f: any) => f.geometry.coordinates,
      getFillColor: FIRE_RGB, getRadius: 5, radiusUnits: "pixels", radiusMinPixels: 4, radiusMaxPixels: 9,
      stroked: true, getLineColor: [255, 255, 255, 235], getLineWidth: 1.3, lineWidthUnits: "pixels", pickable: true,
      onHover: (info: any) => showTip(info, info.object ? <><b>{info.object.properties.name}</b><div className="row">Fire / EMS station</div></> : null),
    }));
    if (ctx && has("labels")) layers.push(new TextLayer({
      id: "labels", data: ctx.places.features, getPosition: (f: any) => f.geometry.coordinates,
      getText: (f: any) => f.properties.name || "", getSize: 13, sizeUnits: "pixels",
      getColor: theme === "dark" ? [235, 238, 234, 235] : [40, 45, 50, 235],
      fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700, getTextAnchor: "middle", getAlignmentBaseline: "center",
      fontSettings: { sdf: true }, outlineWidth: 3, outlineColor: theme === "dark" ? [15, 19, 22, 255] : [251, 252, 250, 255],
    }));

    overlay.setProps({ layers });
  }, [geo, ctx, ledger, ledgerBy, threeD, ledgerMaxVal, ready, mapType, effLayer, colorBy, theme, subs, year, cumulative, overlays, brush, uda, swsa, points, builderTop, districtFC, districtCounts, dMax, heatData]);

  const uc = udaColors(theme);
  const landLegend = ["res", "biz", "ind", "civ", "rural"].map((c) => ({ label: CLASS_LABEL[c], color: CLASS_HEX[c] }));
  const ledgerLegend = ledgerBy === "use" ? ["res", "biz", "ind", "rural", "civ"].map((c) => ({ label: CLASS_LABEL[c], color: CLASS_HEX[c] }))
    : ledgerBy === "sewer" ? [{ label: "well / septic", color: "#cf3a24" }, { label: "public sewer", color: "#1c5cab" }]
      : [{ label: "low $/ac", color: "#e8f3ec" }, { label: "high value/acre", color: "#0d4d31" }];
  const legend = mapType === "ledger" ? ledgerLegend
    : (mapType === "zoning" || mapType === "landuse") ? landLegend
    : mapType === "buildout" ? [{ label: "unbuilt", color: "#cf3a24" }, { label: "half built", color: "#e6a13c" }, { label: "built out", color: "#1c7a51" }]
      : mapType === "districts" ? [{ label: "fewer", color: SEQ_HEX[0] }, { label: "more homes", color: SEQ_HEX[3] }]
        : (mapType === "density" || mapType === "hex") ? [{ label: "few", color: SEQ_HEX[0] }, { label: "many homes", color: SEQ_HEX[3] }]
          : effLayer === "ci" ? CIK.map((k, i) => ({ label: k, color: CICOL_HEX[i] }))
            : effLayer === "apps" ? CATEGORY_ORDER.slice(0, 8).map((c) => ({ label: c, color: catColor(c) }))
              : colorBy === "uda" ? [{ label: "inside UDA", color: uc.in }, { label: "outside UDA", color: uc.out }]
                : colorBy === "builder" ? builderTop.legend
                  : [{ label: "New dwelling permit", color: SERIES[0] }];
  const showLayerCtl = ["dots", "density", "hex", "districts"].includes(mapType);

  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="mapctl">
        <Select.Root value={mapType} onValueChange={(v) => setMapType(v as MapType)} size="2">
          <Select.Trigger variant="surface" />
          <Select.Content position="popper">
            <Select.Group>
              <Select.Label>Growth</Select.Label>
              <Select.Item value="dots">Dots</Select.Item>
              <Select.Item value="density">Heatmap</Select.Item>
              <Select.Item value="hex">3D hexbins</Select.Item>
              <Select.Item value="districts">Districts</Select.Item>
              <Select.Item value="buildout">Build-out</Select.Item>
            </Select.Group>
            <Select.Group>
              <Select.Label>Land</Select.Label>
              <Select.Item value="zoning">Zoning</Select.Item>
              <Select.Item value="landuse">Future land use</Select.Item>
            </Select.Group>
            <Select.Group>
              <Select.Label>Ledger</Select.Label>
              <Select.Item value="ledger">Tax base</Select.Item>
            </Select.Group>
          </Select.Content>
        </Select.Root>
        {mapType === "ledger" && (
          <SegmentedControl.Root value={ledgerBy} onValueChange={(v) => setLedgerBy(v as LedgerBy)} size="2">
            <SegmentedControl.Item value="vpa">$ / acre</SegmentedControl.Item>
            <SegmentedControl.Item value="use">By use</SegmentedControl.Item>
            <SegmentedControl.Item value="sewer">On public sewer</SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
        {(mapType === "ledger" || mapType === "districts") && (
          <label htmlFor="threeD-toggle" className="ovbtn" style={{ cursor: "pointer" }}><Checkbox id="threeD-toggle" size="1" checked={threeD} onCheckedChange={() => setThreeD((v) => !v)} /> 3D</label>
        )}
        {showLayerCtl && (
          <SegmentedControl.Root value={effLayer} onValueChange={(v) => setLayer(v as Layer)} size="2">
            <SegmentedControl.Item value="permits">Homes</SegmentedControl.Item>
            <SegmentedControl.Item value="ci">C/I</SegmentedControl.Item>
            {mapType === "dots" && <SegmentedControl.Item value="apps">Applications</SegmentedControl.Item>}
          </SegmentedControl.Root>
        )}
        {mapType === "dots" && effLayer === "permits" && (
          <SegmentedControl.Root value={colorBy} onValueChange={(v) => setColorBy(v as ColorBy)} size="2">
            <SegmentedControl.Item value="uniform">Uniform</SegmentedControl.Item>
            <SegmentedControl.Item value="uda">In/out UDA</SegmentedControl.Item>
            <SegmentedControl.Item value="builder">Builder</SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
        <Popover.Root>
          <Popover.Trigger>
            <button className="ovbtn" type="button"><Layers size={14} /> Overlays{overlays.size ? ` · ${overlays.size}` : ""}</button>
          </Popover.Trigger>
          <Popover.Content size="1" width="230px" style={{ display: "grid", gap: 2 }}>
            {OVERLAYS.map((o) => (
              <label key={o.k} htmlFor={`ov-${o.k}`} className="ovrow"><Checkbox id={`ov-${o.k}`} size="1" checked={has(o.k)} onCheckedChange={() => toggle(o.k)} /> {o.label}</label>
            ))}
          </Popover.Content>
        </Popover.Root>
      </div>

      {YEAR_VIEW.includes(mapType) && <div className="timectl">
        <button className="playbtn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <input type="range" min={YEAR_MIN} max={YEAR_MAX} step={1} value={year} onChange={(e) => { setPlaying(false); setYear(+e.target.value); }} className="yslider" />
        <div className="yearbig">{year}</div>
        <label className="chk"><input type="checkbox" checked={cumulative} onChange={(e) => setCumulative(e.target.checked)} /> cumulative</label>
        <span className="mapcount">{`${shownCount.toLocaleString()}${mapType === "districts" ? " homes" : " shown"}`}</span>
      </div>}
      {mapType === "buildout" && <div className="timectl" style={{ justifyContent: "flex-end" }}>
        <span className="mapcount">{subsStat.n.toLocaleString()} subdivisions · {subsStat.remaining.toLocaleString()} lots remaining</span>
      </div>}

      <div className="legend" style={{ marginTop: 12 }}>
        {legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}
        {uda && <span><i style={{ background: "none", border: `2px solid ${SERIES[4]}`, width: 9, height: 9 }} />UDA</span>}
        {swsa && <span><i style={{ background: "none", border: `2px dashed ${SERIES[1]}`, width: 9, height: 9 }} />Sewer/water</span>}
      </div>

      <div ref={containerRef} className="countymap" style={{ position: "relative", width: "100%", height: "clamp(380px, calc(100dvh - 250px), 860px)", borderRadius: 10, overflow: "hidden", marginTop: 6, background: "var(--surface-2)" }} />

      <div className="foot">
        {mapType === "dots" && (effLayer === "permits" ? (
          colorBy === "uda" ? "Each new dwelling colored by whether it landed inside the Urban Development Area (green) or outside it (red). Every red dot is a home the county serves at a net fiscal loss."
          : colorBy === "builder" ? "New dwellings colored by builder. The handful of top firms account for the bulk of the county's residential build-out."
          : "Each dot is a parcel-matched new dwelling, on the county's own road/water basemap. Press play to watch the county fill in. Recolor by In/out UDA or Builder to see cost and concentration."
        ) : effLayer === "ci" ? "Commercial & industrial permits: far fewer, far larger, clustered on the I-81 corridor. Click a dot for detail." : "Applications by category; click any point to follow it through approval.")}
        {mapType === "density" && "A GPU kernel-density surface (deck.gl). Press play to watch the hot zones spread and intensify year by year."}
        {mapType === "hex" && "New dwellings aggregated into ~½-mile hexbins, extruded by count: a 3D relief of where new homes are concentrated. Drag to orbit; press play to watch it rise."}
        {mapType === "districts" && "New dwellings by magisterial district. Press play to see which districts absorbed the growth, and when."}
        {mapType === "buildout" && "Platted subdivisions by build-out. Deep red = approved but still largely unbuilt: homes already entitled and awaiting construction, i.e. deficit the county has committed to but not yet paid for."}
        {mapType === "zoning" && "Current zoning, dissolved to its base districts. Blue = land zoned residential; green business, amber industrial. Compare against where homes got built."}
        {mapType === "landuse" && "The comprehensive plan's future land use. Blue = land the county has planned for residential: the growth (and its net cost) planned by policy but not yet built."}
        {mapType === "ledger" && (ledgerBy === "use"
          ? "Each cell colored by the land use holding the most assessed value (by zoning). Residential is 47% of the $21.5B base, rural/agricultural 32%, industrial 12%, business 7%; so most of the county's value is homes and farmland, not the C/I tax base that pays for services."
          : ledgerBy === "sewer"
          ? "Share of assessed value on public sewer. Red = value on wells & septic: growth the county isn't serving (and largely can't tax for utilities), the flip side of the sprawl-cost map."
          : "Assessed value per acre (~⅜-mi cells). Deep green = land that pays: a single commercial or dense block out-earns acres of cul-de-sac. This is the revenue side of the deficit, the ledger against the growth.")}
        {["dots", "density", "hex", "districts", "buildout", "ledger"].includes(mapType) || <span> Toggle constraint and service layers from <b>Overlays</b>.</span>}
      </div>

      {tip && <div className="tip" style={{ opacity: 1, left: tip.x > (typeof window !== "undefined" ? innerWidth : 1200) - 240 ? tip.x - 220 : tip.x + 14, top: tip.y + 14 }}>{tip.node}</div>}
    </div>
  );
}
