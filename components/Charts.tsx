"use client";
import { useId, useState, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";

// Reveal-on-scroll: flips true once when the chart enters the viewport, then
// disconnects. Drives the "plotter draws the plat" entrance (see globals.css).
// Degrades to visible immediately where IntersectionObserver is unavailable.
function useReveal<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}
const revClass = (inView: boolean) => "chart-anim" + (inView ? " in" : "");
const stagger = (i: number, step = 0.04, cap = 18) => ({ animationDelay: `${Math.min(i, cap) * step}s` });

// Narrower viewBox on phones so charts aren't squashed to a thin strip
// (a full-width desktop card wants ~2.4:1; a phone wants ~1.5:1).
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:640px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}
import { scaleLinear, scaleBand, scalePoint } from "d3-scale";
import { max } from "d3-array";
import { line as d3line, area as d3area, curveMonotoneX } from "d3-shape";

type Series = { label: string; color: string; values: number[] };
type Tip = { x: number; y: number; node: ReactNode } | null;

const FMT: Record<string, (n: number) => string> = {
  int: (n) => Math.round(n).toLocaleString(),
  pct: (n) => (Number.isInteger(n) ? n : +n.toFixed(1)) + "%",
  acres: (n) => Math.round(n).toLocaleString() + " ac",
  money: (n) => { const a = Math.abs(n); return a >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "B" : a >= 1e6 ? "$" + (n / 1e6).toFixed(0) + "M" : a >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "k" : "$" + Math.round(n); },
};
type FmtKey = keyof typeof FMT;
const F = (k?: FmtKey) => FMT[k || "int"];

function useTip(): [Tip, (x: number, y: number, n: ReactNode) => void, () => void] {
  const [tip, setTip] = useState<Tip>(null);
  return [tip, (x, y, node) => setTip({ x, y, node }), () => setTip(null)];
}
function TipBox({ tip }: { tip: Tip }) {
  if (!tip || typeof document === "undefined") return null;
  const w = window.innerWidth, h = window.innerHeight;
  // Portal to <body>: the chart lives inside a .card whose backdrop-filter would
  // otherwise make position:fixed resolve against the card, not the viewport.
  return createPortal(
    <div className="tip" style={{ opacity: 1, left: tip.x > w - 280 ? tip.x - 250 : tip.x + 14, top: tip.y > h - 150 ? tip.y - 130 : tip.y + 14 }}>{tip.node}</div>,
    document.body
  );
}
export function Legend({ series }: { series: { label: string; color: string }[] }) {
  return <div className="legend">{series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div>;
}
// rounded-top bar path
function barTop(x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export function Bars({ cats, series, mode = "single", fmt, unit = "" }:
  { cats: (string | number)[]; series: Series[]; mode?: "single" | "stack" | "group"; fmt?: FmtKey; unit?: string }) {
  const yfmt = F(fmt);
  const [tip, show, hide] = useTip();
  const [wrapRef, inView] = useReveal<HTMLDivElement>();
  const W = useNarrow() ? 440 : 720, H = 300, m = { t: 16, r: 16, b: 34, l: 56 };
  const cs = cats.map(String);
  const x = scaleBand<string>().domain(cs).range([m.l, W - m.r]).padding(0.32);
  const yMax = (mode === "stack"
    ? max(cs, (_c, i) => series.reduce((s, se) => s + (se.values[i] || 0), 0))
    : max(series, (se) => max(se.values))) || 1;
  const y = scaleLinear().domain([0, yMax]).nice().range([H - m.b, m.t]);
  const inner = scaleBand<string>().domain(series.map((s) => s.label)).range([0, x.bandwidth()]).padding(0.12);
  // thin x labels so they never overlap (fewer on the narrow mobile viewBox)
  const lblStep = Math.max(1, Math.ceil(cs.length / (W > 560 ? 14 : 8)));

  return (
    <div ref={wrapRef} className={revClass(inView)} style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {y.ticks(4).map((tv, i) => (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={y(tv)} y2={y(tv)} stroke="var(--grid)" strokeWidth={1} />
            <text x={m.l - 8} y={y(tv) + 3} textAnchor="end" className="axtick tnum">{yfmt(tv)}</text>
          </g>
        ))}
        {/* drafting baseline — a firmer rule at zero */}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1.25} />
        {cs.map((c, i) => i % lblStep === 0 ? <text key={i} x={(x(c) || 0) + x.bandwidth() / 2} y={H - m.b + 16} textAnchor="middle" className="axtick tnum">{cats[i]}</text> : null)}
        {cs.map((c, i) => {
          const bx = x(c) || 0;
          const nodes: ReactNode[] = [];
          if (mode === "stack") {
            let acc = 0;
            series.forEach((se, k) => { const v = se.values[i] || 0; if (!v) return; const y0 = y(acc), y1 = y(acc + v); nodes.push(<path key={k} className="gbar" style={stagger(i)} d={barTop(bx, y1, x.bandwidth(), y0 - y1 - 2)} fill={se.color} />); acc += v; });
          } else if (mode === "group") {
            series.forEach((se) => { const v = se.values[i] || 0; const ix = bx + (inner(se.label) || 0); nodes.push(<path key={se.label} className="gbar" style={stagger(i)} d={barTop(ix, y(v), inner.bandwidth(), H - m.b - y(v))} fill={se.color} />); });
          } else {
            const v = series[0].values[i] || 0;
            nodes.push(<path key="s" className="gbar" style={stagger(i)} d={barTop(bx, y(v), x.bandwidth(), H - m.b - y(v))} fill={series[0].color} />);
            nodes.push(<text key="l" className="vlabel" style={stagger(i)} x={bx + x.bandwidth() / 2} y={y(v) - 5} textAnchor="middle">{yfmt(v)}</text>);
          }
          return (
            <g key={i}>{nodes}
              <rect x={bx - x.step() * x.padding() / 2} y={m.t} width={x.step()} height={H - m.b - m.t} fill="transparent"
                onMouseMove={(e) => show(e.clientX, e.clientY, <><b>{cats[i]}{unit}</b>{series.filter((se) => se.values[i]).map((se) => <div className="row" key={se.label}><i style={{ background: se.color }} />{se.label}<span className="n">{yfmt(se.values[i])}</span></div>)}{mode === "stack" && <div className="row" style={{ borderTop: "1px solid var(--border)", marginTop: 5, paddingTop: 5 }}>Total<span className="n">{yfmt(series.reduce((s, se) => s + (se.values[i] || 0), 0))}</span></div>}</>)}
                onMouseLeave={hide} />
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

export function Line({ cats, series, fmt, unit = "" }:
  { cats: (string | number)[]; series: Series[]; fmt?: FmtKey; unit?: string }) {
  const yfmt = F(fmt);
  const uid = useId().replace(/:/g, "");
  const [tip, show, hide] = useTip();
  const [cx, setCx] = useState(-1);
  const [wrapRef, inView] = useReveal<HTMLDivElement>();
  const W = useNarrow() ? 440 : 720, H = 300, m = { t: 16, r: 18, b: 34, l: 56 };
  const cs = cats.map(String);
  const x = scalePoint<string>().domain(cs).range([m.l, W - m.r]).padding(0.1);
  const y = scaleLinear().domain([0, max(series, (se) => max(se.values)) || 1]).nice().range([H - m.b, m.t]);
  const lg = d3line<number>().x((_d, i) => x(cs[i]) || 0).y((d) => y(d)).curve(curveMonotoneX);
  const ag = d3area<number>().x((_d, i) => x(cs[i]) || 0).y0(H - m.b).y1((d) => y(d)).curve(curveMonotoneX);
  const lblStep = Math.max(1, Math.ceil(cs.length / (W > 560 ? 14 : 8)));

  return (
    <div ref={wrapRef} className={revClass(inView)} style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        <defs>{series.map((se, k) => (
          <linearGradient key={k} id={`g${uid}-${k}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={se.color} stopOpacity={0.22} /><stop offset="100%" stopColor={se.color} stopOpacity={0} />
          </linearGradient>))}</defs>
        {y.ticks(4).map((tv, i) => (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={y(tv)} y2={y(tv)} stroke="var(--grid)" strokeWidth={1} />
            <text x={m.l - 8} y={y(tv) + 3} textAnchor="end" className="axtick tnum">{yfmt(tv)}</text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1.25} />
        {cs.map((c, i) => i % lblStep === 0 ? <text key={i} x={x(c) || 0} y={H - m.b + 16} textAnchor="middle" className="axtick tnum">{cats[i]}</text> : null)}
        {cx >= 0 && <line x1={x(cs[cx]) || 0} x2={x(cs[cx]) || 0} y1={m.t} y2={H - m.b} stroke="var(--axis)" strokeWidth={1} />}
        {series.map((se, k) => (
          <g key={se.label}>
            <path className="carea" d={ag(se.values) || ""} fill={`url(#g${uid}-${k})`} />
            <path className="cline" pathLength={1} d={lg(se.values) || ""} fill="none" stroke={se.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {se.values.map((v, i) => <circle className="cdot" style={{ animationDelay: `${0.85 + Math.min(i, 24) * 0.03}s` }} key={i} cx={x(cs[i]) || 0} cy={y(v)} r={3.2} fill={se.color} stroke="var(--surface)" strokeWidth={2} />)}
          </g>
        ))}
        <rect x={m.l} y={m.t} width={W - m.r - m.l} height={H - m.b - m.t} fill="transparent"
          onMouseMove={(e) => {
            const bb = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const rel = ((e.clientX - bb.left) / bb.width) * W;
            let best = 0, bd = Infinity;
            cs.forEach((c, i) => { const d = Math.abs((x(c) || 0) - rel); if (d < bd) { bd = d; best = i; } });
            setCx(best);
            show(e.clientX, e.clientY, <><b>{cats[best]}{unit}</b>{series.map((se) => <div className="row" key={se.label}><i style={{ background: se.color }} />{se.label}<span className="n">{yfmt(se.values[best])}</span></div>)}</>);
          }}
          onMouseLeave={() => { hide(); setCx(-1); }} />
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

export function HBar({ items, fmt }:
  { items: { label: string; value: number; sub?: string; color?: string }[]; fmt?: FmtKey }) {
  const vfmt = F(fmt);
  const [tip, show, hide] = useTip();
  const narrow = useNarrow();
  const rowH = 30, W = narrow ? 392 : 720, m = narrow ? { t: 6, r: 60, l: 96, b: 6 } : { t: 6, r: 128, l: 168, b: 6 };
  const H = m.t + m.b + items.length * rowH;
  const x = scaleLinear().domain([0, max(items, (d) => d.value) || 1]).nice().range([m.l, W - m.r]);
  const [wrapRef, inView] = useReveal<HTMLDivElement>();
  return (
    <div ref={wrapRef} className={revClass(inView)} style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {items.map((d, i) => {
          const yy = m.t + i * rowH, bw = Math.max(2, x(d.value) - m.l), col = d.color || "var(--s1)";
          const r = Math.min(4, (rowH - 12) / 2, bw);
          return (
            <g key={i}>
              <text x={m.l - 10} y={yy + rowH / 2 + 1} textAnchor="end" className="axtick" style={{ fill: "var(--ink-2)" }}>{d.label}</text>
              <path className="hbar" style={stagger(i, 0.05)} d={`M${m.l},${yy + 5} L${m.l + bw - r},${yy + 5} Q${m.l + bw},${yy + 5} ${m.l + bw},${yy + 5 + r} L${m.l + bw},${yy + rowH - 7 - r} Q${m.l + bw},${yy + rowH - 7} ${m.l + bw - r},${yy + rowH - 7} L${m.l},${yy + rowH - 7} Z`} fill={col} />
              {/* value right-aligned in the reserved right margin so it never clips */}
              <text className="vlabel" style={stagger(i, 0.05)} x={W - 4} y={yy + rowH / 2 + 1} textAnchor="end">{vfmt(d.value)}{d.sub && !narrow ? "  " + d.sub : ""}</text>
              <rect x={0} y={yy} width={W} height={rowH} fill="transparent"
                onMouseMove={(e) => show(e.clientX, e.clientY, <><b>{d.label}</b><div className="row">{vfmt(d.value)}{d.sub ? " · " + d.sub : ""}</div></>)}
                onMouseLeave={hide} />
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

export function Stacked100({ segs, fmt }:
  { segs: { label: string; value: number; color: string }[]; fmt?: FmtKey }) {
  const fmtv = F(fmt);
  const [tip, show, hide] = useTip();
  const tot = segs.reduce((s, d) => s + d.value, 0) || 1;
  const W = 720, H = 46, bh = 30;
  const [wrapRef, inView] = useReveal<HTMLDivElement>();
  let acc = 0;
  return (
    <div ref={wrapRef} className={revClass(inView)} style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {segs.map((d, si) => {
          const w = (d.value / tot) * W, xx = acc; acc += w;
          return (
            <g key={d.label}>
              <rect className="sseg" style={stagger(si, 0.09)} x={xx + 1} y={6} width={Math.max(0, w - 2)} height={bh} rx={4} fill={d.color} />
              {w > 52 && <text x={xx + w / 2} y={6 + bh / 2 + 4} textAnchor="middle" className="vlabel" style={{ fill: "#fff", fontWeight: 600 }}>{((d.value / tot) * 100).toFixed(0)}%</text>}
              <rect x={xx} y={0} width={w} height={H} fill="transparent"
                onMouseMove={(e) => show(e.clientX, e.clientY, <><b>{d.label}</b><div className="row">{((d.value / tot) * 100).toFixed(1)}% · {fmtv(d.value)}</div></>)}
                onMouseLeave={hide} />
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

// interpolate near-surface -> deep sequential blue by t in [0,1] (RGB lerp)
const _hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const _LO = _hex("eef4fd"), _HI = _hex("1c5cab");
const seqColor = (t: number) => {
  const c = _LO.map((lo, i) => Math.round(lo + (_HI[i] - lo) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Agreement matrix. cells[i][j] = {n, agree} | null. Encodes DISAGREEMENT
// (1-agree) as magnitude so the pairs that split most are the darkest.
export function Heatmap({ names, cells }:
  { names: string[]; cells: ({ n: number; agree: number } | null)[][] }) {
  const [tip, show, hide] = useTip();
  const narrow = useNarrow();
  const n = names.length;
  const cell = narrow ? 22 : 30, lab = narrow ? 72 : 96, pad = 6;
  const W = lab + n * cell + pad, H = lab + n * cell + pad;
  const dmax = Math.max(0.35, ...cells.flat().map((c) => (c ? 1 - c.agree : 0)));
  const short = (s: string) => (s.length > 12 ? s.slice(0, 11) + "…" : s);
  const [wrapRef, inView] = useReveal<HTMLDivElement>();
  return (
    <div className="heatscroll">
      <div ref={wrapRef} className={revClass(inView)} style={{ position: "relative", width: W }}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
          {names.map((nm, j) => (
            <text key={"c" + j} transform={`translate(${lab + j * cell + cell / 2},${lab - 6}) rotate(-45)`}
              className="axtick" style={{ fill: "var(--ink-2)" }}>{short(nm)}</text>
          ))}
          {names.map((nm, i) => (
            <text key={"r" + i} x={lab - 8} y={lab + i * cell + cell / 2 + 3} textAnchor="end"
              className="axtick" style={{ fill: "var(--ink-2)" }}>{short(nm)}</text>
          ))}
          {cells.map((row, i) => row.map((c, j) => {
            const x = lab + j * cell, y = lab + i * cell;
            const dis = c ? 1 - c.agree : 0;
            const fill = i === j ? "var(--grid)" : c ? seqColor(dis / dmax) : "var(--surface-2)";
            return (
              <rect key={i + "-" + j} className="hcell" style={{ animationDelay: `${(i + j) * 0.02}s` }}
                x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} rx={3}
                fill={fill} stroke={c ? "none" : "var(--border-2)"}
                onMouseMove={c ? (e) => show(e.clientX, e.clientY,
                  <><b>{names[i]} · {names[j]}</b><div className="row">agreed {(c.agree * 100).toFixed(0)}% of {c.n} shared votes</div></>) : undefined}
                onMouseLeave={hide} />
            );
          }))}
        </svg>
        <TipBox tip={tip} />
      </div>
    </div>
  );
}
