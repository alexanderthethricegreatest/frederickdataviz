"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@radix-ui/themes";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer, PathLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import { RGB, hex, fmtMoney, palette, blankStyle, addBasemap, repaint, readTheme, useMapTheme } from "@/lib/mapkit";

type CatDef = { v: string; label: string; color: string };
type OverlayMeta = { key: string; label: string; kind: "fill" | "line" | "cat" | "point"; count: number; cats?: CatDef[] };
type Valley = {
  bbox: [number, number, number, number];
  centerline: number[][][];
  row: number[][][];
  substations: { kind: string; x: number; y: number; name: string }[];
  parcels: any;
  summary: any;
  overlayList: OverlayMeta[];
  scoreModes?: { key: string; label: string }[];
};
type ColorBy = string; // "tier" | "value" | <score key>
const BASE_MODES = new Set(["tier", "value"]);

const TIER_HEX: Record<string, string> = { crossed: "#cf3a24", band: "#e6a13c", corridor: "#6b8f71" };
const TIER_LABEL: Record<string, string> = { crossed: "Route-crossed (in modeled ROW)", band: "In project ROW band", corridor: "Wider study corridor" };
const TIER_SHORT: Record<string, string> = { crossed: "crossed", band: "ROW band", corridor: "corridor" };
const ROUTE = { light: [34, 48, 60] as RGB, dark: [205, 214, 223] as RGB };
const ROW_FILL: RGB = hex("#cf3a24");

// per-overlay colors; anything unmapped falls back to a neutral slate
const OV_COLOR: Record<string, string> = {
  conservevirginia: "#1c7a51", managed_conservation_lands: "#2e8b8b", natural_land_network: "#5a8f3c",
  ecological_cores: "#2d6a4f", wildlife_corridors: "#6d4aa7", wildlife_nexus_areas: "#8a5cc4",
  forest_conservation_values: "#3f7d3f", cultural_resource_index: "#b07d2b", scenic_rivers: "#3987e5",
  sinkholes: "#d98324", karst_bedrock: "#9c6b3f", nwi_wetlands: "#4a9db5", predicted_suitable_habitats: "#b5497f",
  conflict_row_x_growth: "#cf3a24", conflict_row_x_floodplain: "#1c5cab",
  conflict_row_x_carbonate: "#9c6b3f", conflict_row_x_high_shrink_swell: "#b07d2b",
  gw_national_forest: "#2d6a4f", publicly_accessible_lands: "#3f7d3f", parks: "#1baf7a",
  proposed_parks: "#8fd0a8", park_trails: "#b5732e", tuscarora_trail: "#b5732e",
  cultivated_farmland: "#70a800", rural_landmark: "#9085e9",
  floodplain: "#3987e5", building_footprints: "#3d4249",
  sinkholes_karst: "#d94a24", faults: "#8a5a2b",
};
const ovHex = (k: string) => OV_COLOR[k] || "#7a8a86";

// assessed-value ramp (neutral → ledger-green), log-scaled
const VAL_STOPS_HEX = ["#e8f3ec", "#a9d6ba", "#5cae82", "#1c7a51", "#0d4d31"];
const VAL_STOPS = VAL_STOPS_HEX.map(hex);
// impact-score ramp: low impact (green) → high impact (surveyor-red), matches the
// source symbology's "Lowest → Highest Impact" classes
const SCORE_STOPS_HEX = ["#2d8a5f", "#a7c957", "#e6a13c", "#e07b39", "#cf3a24"];
const SCORE_STOPS = SCORE_STOPS_HEX.map(hex);
// estimated value-at-risk ramp (pale → surveyor-red), log-scaled
const VLOST_STOPS_HEX = ["#f3ded8", "#e5a08d", "#d9634a", "#cf3a24", "#8f2417"];
const VLOST_STOPS = VLOST_STOPS_HEX.map(hex);
function rampOf(stops: RGB[], t: number): RGB {
  t = Math.max(0, Math.min(1, t));
  const s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
  const a = stops[i], b = stops[i + 1];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as RGB;
}
const ramp = (t: number) => rampOf(VAL_STOPS, t);
const scoreColor = (v: number | null | undefined): RGB => v == null ? [140, 146, 152] : rampOf(SCORE_STOPS, (v - 1) / 99);

type Sel = { kind: "parcel" | "sub" | "overlay"; props: any } | null;

export default function ValleyMap() {
  const [v, setV] = useState<Valley | null>(null);
  const [ovData, setOvData] = useState<Record<string, any>>({});
  const ovLoading = useRef<Set<string>>(new Set());
  const [vis, setVis] = useState<Set<string>>(new Set(["parcels", "row", "route", "subs"]));
  const [colorBy, setColorBy] = useState<ColorBy>("tier");
  const [sel, setSel] = useState<Sel>(null);
  const theme = useMapTheme();
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const fitRef = useRef(false);

  const shown = (k: string) => vis.has(k);
  const toggle = (k: string) => setVis((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  useEffect(() => { fetch("/valley.json").then((r) => r.json()).then(setV); }, []);
  // lazily fetch each overlay's own file the first time it's toggled on
  useEffect(() => {
    if (!v) return;
    for (const o of v.overlayList) {
      if (vis.has(o.key) && !ovData[o.key] && !ovLoading.current.has(o.key)) {
        ovLoading.current.add(o.key);
        fetch(`/valley_ov/${o.key}.json`).then((r) => r.json())
          .then((fc) => setOvData((d) => ({ ...d, [o.key]: fc }))).catch(() => {});
      }
    }
  }, [vis, v, ovData]);

  const valMax = useMemo(() => (v ? Math.max(1, ...v.parcels.features.map((f: any) => f.properties.val || 0)) : 1), [v]);
  const vlostMax = useMemo(() => (v ? Math.max(1, ...v.parcels.features.map((f: any) => f.properties.vlost || 0)) : 1), [v]);
  const hasVlost = useMemo(() => (v ? v.parcels.features.some((f: any) => f.properties.vlost != null) : false), [v]);

  // ── init MapLibre + deck overlay once ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: blankStyle(palette(readTheme())),
      center: [-78.23, 39.2], zoom: 10, minZoom: 8, maxZoom: 16,
      attributionControl: false, dragRotate: false, pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ customAttribution: "Frederick County GIS · VA NHDE · Valley Link" }));
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as any);
    overlayRef.current = overlay;
    mapRef.current = map;
    map.on("load", () => {
      fetch("/basemap.json").then((r) => r.json()).then((bm) => { addBasemap(map, bm, readTheme()); setReady(true); });
    });
    return () => { map.remove(); mapRef.current = null; overlayRef.current = null; };
  }, []);

  useEffect(() => { const m = mapRef.current; if (m && ready) repaint(m, theme); }, [theme, ready]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !v || fitRef.current) return;
    fitRef.current = true;
    const [w, s, e, n] = v.bbox;
    m.fitBounds([[w, s], [e, n]], { padding: 36, duration: 0 });
  }, [v, ready]);

  const selPin = sel?.kind === "parcel" ? sel.props.pin : null;
  const selFeat = useMemo(() => (selPin && v ? v.parcels.features.find((f: any) => f.properties.pin === selPin) : null), [selPin, v]);

  // ── deck layers ──
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !v) return;
    const layers: any[] = [];

    // click an overlay area → info panel shows what it is (per-feature label / category)
    const ovClick = (meta: OverlayMeta) => (info: any) => {
      if (!info.object) return;
      const p = info.object.properties || {};
      setSel({ kind: "overlay", props: { label: meta.label, name: p.n || p.c || null } });
    };

    // 1. context overlays (bottom), lazy data, all clickable
    if (ovData) {
      for (const meta of v.overlayList) {
        if (!shown(meta.key) || !ovData[meta.key]) continue;
        if (meta.key === "building_footprints") continue; // drawn on top of parcels below
        if (meta.kind === "cat") {
          const cmap = new Map((meta.cats || []).map((c) => [c.v, hex(c.color)] as const));
          const col = (f: any) => cmap.get(f.properties.c) || ([122, 138, 134] as RGB);
          layers.push(new GeoJsonLayer({
            id: `ov-${meta.key}`, data: ovData[meta.key], stroked: true, filled: true,
            getFillColor: (f: any) => [...col(f), 95] as any, getLineColor: (f: any) => [...col(f), 190] as any,
            getLineWidth: 0.5, lineWidthUnits: "pixels", parameters: { depthTest: false },
            pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 70], onClick: ovClick(meta),
          }));
          continue;
        }
        if (meta.kind === "point") {
          const rgb = hex(ovHex(meta.key));
          layers.push(new GeoJsonLayer({
            id: `ov-${meta.key}`, data: ovData[meta.key], pointType: "circle", stroked: true, filled: true,
            getFillColor: [...rgb, 225] as any, getLineColor: [255, 255, 255, 210], getLineWidth: 1, lineWidthUnits: "pixels",
            getPointRadius: 4, pointRadiusUnits: "pixels", pointRadiusMinPixels: 3, pointRadiusMaxPixels: 6,
            parameters: { depthTest: false }, pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 120], onClick: ovClick(meta),
          }));
          continue;
        }
        const rgb = hex(ovHex(meta.key));
        const props: any = { id: `ov-${meta.key}`, data: ovData[meta.key], stroked: true,
          getLineWidth: meta.kind === "line" ? 2 : 0.6, lineWidthUnits: "pixels", parameters: { depthTest: false },
          pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 70], onClick: ovClick(meta) };
        if (meta.kind === "line") { props.filled = false; props.getLineColor = [...rgb, 235]; }
        else { props.filled = true; props.getFillColor = [...rgb, 70]; props.getLineColor = [...rgb, 180]; }
        layers.push(new GeoJsonLayer(props));
      }
    }

    // 2. impacted parcels
    if (shown("parcels")) layers.push(new GeoJsonLayer({
      id: "parcels", data: v.parcels, stroked: true, filled: true, pickable: true, autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      getFillColor: (f: any) => {
        const p = f.properties;
        if (colorBy === "value") return [...ramp(Math.log1p(p.val || 0) / Math.log1p(valMax)), 210] as any;
        if (colorBy === "vlost") return [...rampOf(VLOST_STOPS, Math.log1p(p.vlost || 0) / Math.log1p(vlostMax)), 210] as any;
        if (!BASE_MODES.has(colorBy)) return [...scoreColor(p[colorBy]), 210] as any; // a score key
        return [...hex(TIER_HEX[p.tier] || "#7a8a86"), p.tier === "corridor" ? 130 : 205] as any;
      },
      getLineColor: [255, 255, 255, 55], getLineWidth: 0.5, lineWidthUnits: "pixels",
      updateTriggers: { getFillColor: [colorBy, valMax, vlostMax] },
      onClick: (info: any) => { if (info.object) setSel({ kind: "parcel", props: info.object.properties }); },
    }));

    // 3. building footprints, on top of parcels (solid, so they read as structures)
    if (shown("building_footprints") && ovData?.building_footprints) layers.push(new GeoJsonLayer({
      id: "buildings", data: ovData.building_footprints, stroked: true, filled: true,
      getFillColor: theme === "dark" ? [206, 213, 221, 235] : [55, 61, 68, 235],
      getLineColor: theme === "dark" ? [15, 19, 22, 200] : [255, 255, 255, 170],
      getLineWidth: 0.5, lineWidthUnits: "pixels", parameters: { depthTest: false },
      pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 90],
      onClick: (info: any) => { if (info.object) setSel({ kind: "overlay", props: { label: "Building footprint", name: null } }); },
    }));

    // 4. selected-parcel highlight outline
    if (selFeat) layers.push(new GeoJsonLayer({
      id: "sel", data: { type: "FeatureCollection", features: [selFeat] }, stroked: true, filled: false,
      getLineColor: theme === "dark" ? [143, 182, 218, 255] : [44, 85, 120, 255],
      getLineWidth: 2.4, lineWidthUnits: "pixels", parameters: { depthTest: false },
    }));

    // 4. modeled ±100 ft ROW (the honest easement footprint)
    if (shown("row") && v.row.length) layers.push(new PolygonLayer({
      id: "row", data: v.row, getPolygon: (d: any) => d, stroked: true, filled: true,
      getFillColor: [...ROW_FILL, 55] as any, getLineColor: [...ROW_FILL, 220] as any,
      getLineWidth: 1.2, lineWidthUnits: "pixels", parameters: { depthTest: false },
    }));

    // 5. route centerline
    if (shown("route") && v.centerline.length) layers.push(new PathLayer({
      id: "route", data: v.centerline, getPath: (d: any) => d,
      getColor: theme === "dark" ? ROUTE.dark : ROUTE.light, getWidth: 2.6, widthUnits: "pixels",
      widthMinPixels: 2, capRounded: true, jointRounded: true, parameters: { depthTest: false },
    }));

    // 6. substations + labels
    if (shown("subs") && v.substations.length) {
      layers.push(new ScatterplotLayer({
        id: "subs", data: v.substations, getPosition: (d: any) => [d.x, d.y],
        getFillColor: (d: any) => d.kind === "existing" ? [140, 146, 152] : hex("#cf3a24"),
        getRadius: 6, radiusUnits: "pixels", radiusMinPixels: 5, radiusMaxPixels: 11,
        stroked: true, getLineColor: [255, 255, 255, 235], getLineWidth: 1.4, lineWidthUnits: "pixels",
        pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 120],
        onClick: (info: any) => { if (info.object) setSel({ kind: "sub", props: info.object }); },
      }));
      layers.push(new TextLayer({
        id: "sub-labels", data: v.substations, getPosition: (d: any) => [d.x, d.y],
        getText: (d: any) => d.name, getSize: 12, sizeUnits: "pixels", getPixelOffset: [0, -14],
        getColor: theme === "dark" ? [235, 238, 234, 235] : [40, 45, 50, 235],
        fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700, getTextAnchor: "middle", getAlignmentBaseline: "bottom",
        fontSettings: { sdf: true }, outlineWidth: 3, outlineColor: theme === "dark" ? [15, 19, 22, 255] : [251, 252, 250, 255],
      }));
    }

    overlay.setProps({ layers });
  }, [v, ovData, vis, colorBy, theme, ready, valMax, selFeat]);

  const PROJECT_OV = ["building_footprints"];
  const GEO_KEYS = ["geology", "soils", "shrink_swell", "sinkholes_karst", "faults"];
  const HAZARD_KEYS = ["floodplain"];
  const PUBLIC_KEYS = ["gw_national_forest", "publicly_accessible_lands", "parks", "proposed_parks", "park_trails", "tuscarora_trail"];
  const LAND_KEYS = ["cultivated_farmland", "area_plans", "rural_landmark"];
  const GROUPED = [...PROJECT_OV, ...GEO_KEYS, ...HAZARD_KEYS, ...PUBLIC_KEYS, ...LAND_KEYS];
  const pick = (keys: string[]) => v?.overlayList.filter((o) => keys.includes(o.key)) || [];
  const buildingOv = pick(PROJECT_OV);
  const geoOv = pick(GEO_KEYS);
  const hazardOv = pick(HAZARD_KEYS);
  const publicOv = pick(PUBLIC_KEYS);
  const landOv = pick(LAND_KEYS);
  const naturalOv = v?.overlayList.filter((o) => !GROUPED.includes(o.key)) || [];

  const swatch = (o: OverlayMeta) =>
    o.kind === "line" ? <i className="sw-line" style={{ background: ovHex(o.key) }} />
    : o.kind === "point" ? <i className="sw-dot" style={{ background: ovHex(o.key) }} />
    : o.kind === "cat" ? <i className="sw" style={{ background: `linear-gradient(135deg, ${(o.cats || []).slice(0, 3).map((c) => c.color).join(", ")})`, borderColor: "var(--border)" }} />
    : <i className="sw" style={{ background: ovHex(o.key) + "66", borderColor: ovHex(o.key) }} />;

  const OvRow = (o: OverlayMeta) => (
    <div key={o.key}>
      <label htmlFor={`t-${o.key}`} className={`gis-row${shown(o.key) ? "" : " off"}`}>
        <input id={`t-${o.key}`} type="checkbox" checked={shown(o.key)} onChange={() => toggle(o.key)} />
        {swatch(o)}
        <span>{o.label}</span><span className="ct">{o.count.toLocaleString()}</span>
      </label>
      {o.kind === "cat" && shown(o.key) && o.cats && (
        <div className="gis-tiers">
          {o.cats.map((c) => <span key={c.v}><i style={{ background: c.color }} />{c.label}</span>)}
        </div>
      )}
    </div>
  );

  return (
    <div className="gis">
      <aside className="gis-panel">
        <div className="gis-group">
          <h4>Project</h4>
          <label htmlFor="t-parcels" className={`gis-row${shown("parcels") ? "" : " off"}`}>
            <input id="t-parcels" type="checkbox" checked={shown("parcels")} onChange={() => toggle("parcels")} />
            <i className="sw" style={{ background: "#cf3a24" }} /><span>Impacted parcels</span>
            <span className="ct">{v ? v.parcels.features.length.toLocaleString() : ""}</span>
          </label>
          <label htmlFor="t-row" className={`gis-row${shown("row") ? "" : " off"}`}>
            <input id="t-row" type="checkbox" checked={shown("row")} onChange={() => toggle("row")} />
            <i className="sw" style={{ background: "#cf3a2433", borderColor: "#cf3a24" }} /><span>Modeled 200 ft ROW</span>
          </label>
          <label htmlFor="t-route" className={`gis-row${shown("route") ? "" : " off"}`}>
            <input id="t-route" type="checkbox" checked={shown("route")} onChange={() => toggle("route")} />
            <i className="sw-line" style={{ background: theme === "dark" ? "#cdd6df" : "#22303c" }} /><span>Route centerline</span>
          </label>
          <label htmlFor="t-subs" className={`gis-row${shown("subs") ? "" : " off"}`}>
            <input id="t-subs" type="checkbox" checked={shown("subs")} onChange={() => toggle("subs")} />
            <i className="sw-dot" style={{ background: "#cf3a24" }} /><span>Substations</span>
          </label>
          {buildingOv.map(OvRow)}
        </div>

        <div className="gis-group">
          <h4>Parcel coloring</h4>
          <Select.Root value={colorBy} onValueChange={(x) => setColorBy(x as ColorBy)} size="1">
            <Select.Trigger variant="surface" style={{ width: "100%" }} />
            <Select.Content position="popper">
              <Select.Item value="tier">Impact tier</Select.Item>
              <Select.Item value="value">Assessed value</Select.Item>
              {hasVlost && <Select.Item value="vlost">Est. value lost ($)</Select.Item>}
              {(v?.scoreModes || []).map((m) => <Select.Item key={m.key} value={m.key}>{m.label}</Select.Item>)}
            </Select.Content>
          </Select.Root>
          <div className="gis-tiers">
            {colorBy === "tier"
              ? ["crossed", "band", "corridor"].map((t) => <span key={t}><i style={{ background: TIER_HEX[t] }} />{TIER_SHORT[t]}</span>)
              : colorBy === "value"
                ? <><span><i style={{ background: VAL_STOPS_HEX[0] }} />lower $</span><span><i style={{ background: VAL_STOPS_HEX[VAL_STOPS_HEX.length - 1] }} />higher $</span></>
                : colorBy === "vlost"
                  ? <><span><i style={{ background: VLOST_STOPS_HEX[0] }} />less lost</span><span><i style={{ background: VLOST_STOPS_HEX[VLOST_STOPS_HEX.length - 1] }} />more lost</span></>
                  : <><span><i style={{ background: SCORE_STOPS_HEX[0] }} />lower</span><span><i style={{ background: SCORE_STOPS_HEX[SCORE_STOPS_HEX.length - 1] }} />higher</span></>}
          </div>
        </div>

        {naturalOv.length > 0 && (
          <div className="gis-group">
            <h4>Natural heritage · NHDE</h4>
            {naturalOv.map(OvRow)}
          </div>
        )}
        {publicOv.length > 0 && (
          <div className="gis-group">
            <h4>Public lands &amp; recreation</h4>
            {publicOv.map(OvRow)}
          </div>
        )}
        {geoOv.length > 0 && (
          <div className="gis-group">
            <h4>Geology, soils &amp; hazards</h4>
            {geoOv.map(OvRow)}
          </div>
        )}
        {hazardOv.length > 0 && (
          <div className="gis-group">
            <h4>Flood &amp; hazards</h4>
            {hazardOv.map(OvRow)}
          </div>
        )}
        {landOv.length > 0 && (
          <div className="gis-group">
            <h4>Farmland, plans &amp; landmarks</h4>
            {landOv.map(OvRow)}
          </div>
        )}

        <div className="gis-info">
          {sel?.kind === "parcel" ? (() => { const p = sel.props; return (
            <>
              <div className="hd"><b>{p.owner || "-"}</b><span className="x" onClick={() => setSel(null)}>×</span></div>
              <div className="tag">PIN {p.pin} · {TIER_LABEL[p.tier]}</div>
              <dl>
                <dt>Acreage</dt><dd>{p.acres != null ? p.acres.toLocaleString() : "-"}</dd>
                <dt>Assessed value</dt><dd>{p.val != null ? fmtMoney(p.val) : "-"}</dd>
                <dt>Distance to line</dt><dd>{p.tier === "crossed" ? "crossed" : p.dist != null ? `${Math.round(p.dist).toLocaleString()} ft` : "-"}</dd>
                <dt>Has home</dt><dd>{p.home ? "yes" : "no"}</dd>
                {p.vlost != null && <><dt>Est. value lost (mid)</dt><dd>{fmtMoney(p.vlost)}</dd></>}
                {(v?.scoreModes || []).map((m) => p[m.key] != null && (
                  <Fragment key={m.key}>
                    <dt>{m.label}</dt>
                    <dd>{p[m.key]}{p[m.key + "Max"] != null && p[m.key + "Max"] !== p[m.key] ? ` (max ${p[m.key + "Max"]})` : ""} / 100</dd>
                  </Fragment>
                ))}
              </dl>
            </>
          ); })() : sel?.kind === "sub" ? (
            <>
              <div className="hd"><b>{sel.props.name}</b><span className="x" onClick={() => setSel(null)}>×</span></div>
              <div className="tag">{sel.props.kind} substation</div>
            </>
          ) : sel?.kind === "overlay" ? (
            <>
              <div className="hd"><b>{sel.props.name || sel.props.label}</b><span className="x" onClick={() => setSel(null)}>×</span></div>
              <div className="tag">{sel.props.label}</div>
            </>
          ) : (
            <div className="empty">Click any parcel to inspect its owner, acreage, assessed value, and how the corridor affects it, or click an overlay area to see what it is.</div>
          )}
        </div>
      </aside>

      <div ref={containerRef} className="gis-map" style={{ background: "var(--surface-2)" }} />
    </div>
  );
}
