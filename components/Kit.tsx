import { ReactNode } from "react";

export function PageHead({ eyebrow, title, children, stats }:
  { eyebrow: string; title: string; children?: ReactNode; stats?: { v: string; l: string; cls?: string }[] }) {
  return (
    <section className="pagehead">
      <div className="wrap">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
        {stats && (
          <div className="statstrip">
            {stats.map((s, i) => (
              <div className="s" key={i}><div className={"v" + (s.cls ? " " + s.cls : "")}>{s.v}</div><div className="l">{s.l}</div></div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function Card({ title, note, desc, foot, wide, children }:
  { title?: string; note?: string; desc?: string; foot?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={"card" + (wide ? " card-lg" : "")}>
      {title && <h3>{title}{note && <span className="h3n">{note}</span>}</h3>}
      {desc && <div className="cdesc">{desc}</div>}
      {children}
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export function MiniTable({ cols, rows, open, label = "View the data" }:
  { cols: string[]; rows: (string | number)[][]; open?: boolean; label?: string }) {
  return (
    <details className="data" open={open}>
      <summary>{label}</summary>
      <div className="tblscroll">
        <table className="minitbl">
          <thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function KeyLine({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
      {items.map((it) => (
        <span className="keyline" key={it.label}><i style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}
