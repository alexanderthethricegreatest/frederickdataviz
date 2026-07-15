// Shared MapLibre + deck.gl plumbing for the atlas maps (CountyMap, ValleyMap):
// the self-built vector basemap, its theme-aware palette, and a theme hook.
// Kept framework-light so both client map components can import the same code.
import { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";

export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const fmtMoney = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${Math.round(n)}`;

// ── theme-aware basemap palette (concrete colors — WebGL can't read light-dark()) ──
export type Pal = ReturnType<typeof palette>;
export function palette(theme: "light" | "dark") {
  return theme === "dark"
    ? { plane: "#0f1317", sheet: "#191d22", countyLine: "#4a525b", water: "#16324f", waterLine: "#274f76", rail: "#454b52", town: "#8fb6da" }
    : { plane: "#eceee9", sheet: "#fbfcfa", countyLine: "#a7ada4", water: "#dbe8f4", waterLine: "#b4cfe8", rail: "#b6b0a3", town: "#2c5578" };
}
// road ranks 0..3 → color, per theme
export const ROAD_COLORS = {
  light: ["#a49f90", "#bab5a6", "#cfcabb", "#e6e3da"],
  dark: ["#5a626c", "#454d57", "#353c45", "#252b32"],
};

export function blankStyle(pal: Pal): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": pal.plane } }],
  };
}

export function addBasemap(map: maplibregl.Map, bm: any, theme: "light" | "dark") {
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

export function repaint(map: maplibregl.Map, theme: "light" | "dark") {
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

// read the app's current theme (data-theme on <html>, else prefers-color-scheme)
export function readTheme(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" ? "dark" : t === "light" ? "light" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// observe the app theme so the WebGL basemap recolors when the user toggles it
export function useMapTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () => setTheme(readTheme());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => { mo.disconnect(); mq.removeEventListener("change", read); };
  }, []);
  return theme;
}
