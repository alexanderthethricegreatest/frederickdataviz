"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select, TextField, Badge } from "@radix-ui/themes";
import { AppRec, slugify, catColor } from "@/lib/data";

const STCOLOR: Record<string, "green" | "red" | "gray" | "amber"> = {
  Approved: "green", Denied: "red", Withdrawn: "gray", Pending: "amber",
};
const fmtI = (n: number) => Math.round(n).toLocaleString();
const PAGE = 50;

type Sort = { key: string; dir: number };

export default function LibraryBrowser({ apps, meta }: { apps: AppRec[]; meta: any }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [casetype, setCasetype] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [sorts, setSorts] = useState<Sort[]>([{ key: "year_filed", dir: -1 }]);
  const [limit, setLimit] = useState(PAGE);

  const facetTags: string[] = meta.tags.filter((t: string) =>
    !meta.casetypes.includes(t) && !meta.categories.includes(t) && !meta.statuses.includes(t));

  const defaultDir = (k: string) => (typeof (apps[0] as any)[k] === "string" ? 1 : -1);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const r = apps.filter((a) => {
      if (casetype && a.casetype !== casetype) return false;
      if (category && a.category !== category) return false;
      if (status && a.status !== status) return false;
      for (const t of tags) if (!a.tags.includes(t)) return false;
      if (ql) { const h = (a.id + " " + a.name + " " + a.description + " " + a.applicant).toLowerCase(); if (!h.includes(ql)) return false; }
      return true;
    });
    return [...r].sort((x: any, y: any) => {
      for (const { key, dir } of sorts) {
        let av = x[key], bv = y[key];
        av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
        const c = typeof av === "string" ? av.localeCompare(bv) : (av - bv);
        if (c) return dir * c;
      }
      return 0;
    });
  }, [q, casetype, category, status, tags, sorts, apps]);

  // reset the visible window whenever the result set changes
  useEffect(() => setLimit(PAGE), [q, casetype, category, status, tags, sorts]);

  const filteredAcres = useMemo(() => rows.reduce((s, a) => s + (a.acres || 0), 0), [rows]);

  const toggleTag = (t: string) => { const n = new Set(tags); n.has(t) ? n.delete(t) : n.add(t); setTags(n); };

  // multi-sort: click cycles a column absent -> default -> reversed -> absent,
  // preserving click order so several columns compose (1st = primary, etc.).
  const cycleSort = (k: string) => setSorts((prev) => {
    const i = prev.findIndex((s) => s.key === k);
    if (i < 0) return [...prev, { key: k, dir: defaultDir(k) }];
    const cur = prev[i];
    if (cur.dir === defaultDir(k)) { const n = [...prev]; n[i] = { key: k, dir: -cur.dir }; return n; }
    return prev.filter((s) => s.key !== k);
  });
  const sortInfo = (k: string) => {
    const i = sorts.findIndex((s) => s.key === k);
    return i < 0 ? null : { rank: i + 1, dir: sorts[i].dir };
  };

  const clearAll = () => { setQ(""); setCasetype(""); setCategory(""); setStatus(""); setTags(new Set()); };
  const activePills = [
    q && { label: `“${q}”`, clear: () => setQ("") },
    casetype && { label: casetype, clear: () => setCasetype("") },
    category && { label: category, clear: () => setCategory("") },
    status && { label: status, clear: () => setStatus("") },
    ...[...tags].map((t) => ({ label: t, clear: () => toggleTag(t) })),
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const cols: [string, string, string][] = [
    ["id", "ID", ""], ["casetype", "Type", ""], ["category", "Category", "cat"], ["name", "Name", "wide"],
    ["district", "District", ""], ["acres", "Acres", "num"], ["year_filed", "Filed", "num"],
    ["year_approved", "Appr.", "num"], ["status", "Status", "st"], ["approval_months", "Mo.", "num"],
  ];
  const visible = rows.slice(0, limit);

  return (
    <>
      <div className="filters">
        <TextField.Root size="3" placeholder="Search name, description, applicant, ID…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 240px" }}>
          <TextField.Slot><Search size={16} /></TextField.Slot>
        </TextField.Root>
        <Sel v={casetype} set={setCasetype} all="All types" opts={meta.casetypes} />
        <Sel v={category} set={setCategory} all="All categories" opts={meta.categories} />
        <Sel v={status} set={setStatus} all="All statuses" opts={meta.statuses} />
      </div>
      <div className="chips">
        {facetTags.map((t) => <span key={t} className={"chip" + (tags.has(t) ? " on" : "")} onClick={() => toggleTag(t)}>{t}</span>)}
      </div>

      {activePills.length > 0 && (
        <div className="activebar">
          <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>Filters:</span>
          {activePills.map((p, i) => (
            <span key={i} className="fpill">{p.label}<button onClick={p.clear} aria-label={`Remove ${p.label}`}><X size={12} /></button></span>
          ))}
          <button className="clearall" onClick={clearAll}>Clear all</button>
        </div>
      )}

      <div className="rescount">
        <b style={{ color: "var(--ink)" }}>{rows.length.toLocaleString()}</b> of {meta.count.toLocaleString()} applications
        {filteredAcres > 0 && <> · {fmtI(filteredAcres)} acres</>}
        {sorts.length > 0 && (
          <span className="sorthint"> · sorted by {sorts.map((s) => `${cols.find((c) => c[0] === s.key)?.[1] || s.key} ${s.dir < 0 ? "↓" : "↑"}`).join(" › ")}
            {sorts.length > 1 && <button className="clearall" style={{ marginLeft: 8 }} onClick={() => setSorts([])}>reset</button>}
          </span>
        )}
      </div>

      <div className="tablewrap">
        <table>
          <thead><tr>{cols.map(([k, lab]) => {
            const si = sortInfo(k);
            return (
              <th key={k} onClick={() => cycleSort(k)} className={si ? "sorted" : ""} title="Click to sort; click again to reverse. Sort by several columns in order.">
                {lab}
                {si ? <span className="sortar">{si.dir < 0 ? "↓" : "↑"}{sorts.length > 1 && <span className="sortnum">{si.rank}</span>}</span>
                  : <span className="sortar idle">↕</span>}
              </th>
            );
          })}</tr></thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id} onClick={() => router.push(`/applications/${slugify(a.id)}`)}>
                <td style={{ fontWeight: 600 }}>{a.id}</td>
                <td>{a.casetype}</td>
                <td><span className="cat"><i style={{ background: catColor(a.category) }} />{a.category}</span></td>
                <td className="wide"><div>{a.name || "—"}</div>{a.description && a.description !== a.name && <div className="muted" style={{ fontSize: 11.5 }}>{a.description}</div>}</td>
                <td>{a.district || "—"}</td>
                <td className="num">{a.acres ? fmtI(a.acres) : "—"}</td>
                <td className="num">{a.year_filed ?? "—"}</td>
                <td className="num">{a.year_approved ?? "—"}</td>
                <td><Badge color={STCOLOR[a.status] || "gray"} variant="soft" radius="full">{a.status}</Badge></td>
                <td className="num">{a.approval_months ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > limit ? (
        <div className="loadmore">
          <button onClick={() => setLimit((l) => l + PAGE)}>
            Load {Math.min(PAGE, rows.length - limit)} more · showing {limit.toLocaleString()} of {rows.length.toLocaleString()}
          </button>
          <button className="ghost" onClick={() => setLimit(rows.length)}>Show all</button>
        </div>
      ) : rows.length > PAGE ? (
        <div className="rescount" style={{ textAlign: "center", marginTop: 12 }}>Showing all {rows.length.toLocaleString()}.</div>
      ) : null}
    </>
  );
}

function Sel({ v, set, all, opts }: { v: string; set: (s: string) => void; all: string; opts: string[] }) {
  return (
    <Select.Root size="3" value={v || "__all"} onValueChange={(val) => set(val === "__all" ? "" : val)}>
      <Select.Trigger variant="surface" placeholder={all} />
      <Select.Content>
        <Select.Item value="__all">{all}</Select.Item>
        {opts.map((o) => <Select.Item key={o} value={o}>{o}</Select.Item>)}
      </Select.Content>
    </Select.Root>
  );
}
