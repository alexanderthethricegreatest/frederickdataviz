import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MapPin, Gavel, CheckCircle2, Hammer, FileSignature, Layers, Vote } from "lucide-react";
import { Badge } from "@radix-ui/themes";
import { apps, getApp, getLifecycle, slugify, catColor, AppRec, Lifecycle, VoteRecord } from "@/lib/data";

const STCOLOR: Record<string, "green" | "red" | "gray" | "amber"> = {
  Approved: "green", Denied: "red", Withdrawn: "gray", Pending: "amber",
};

export function generateStaticParams() {
  return apps.map((a) => ({ id: slugify(a.id) }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getApp(id);
  return { title: a ? `${a.id} · ${a.name || a.casetype}` : "Application" };
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const STAGE_ICON: any = {
  filed: <FileText size={13} />, hearing: <Gavel size={13} />,
  decision: <CheckCircle2 size={13} />, built: <Hammer size={13} />,
  board_vote: <Vote size={13} />, pc_vote: <Vote size={13} />,
};
const VOTE_COLOR: Record<string, string> = {
  aye: "var(--good)", nay: "var(--crit)", abstain: "var(--s3)",
  absent: "var(--muted)", recused: "var(--muted)",
};
const capitalize = (s: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : "—");

// One card of recorded votes — used for both the Planning Commission
// recommendation and the Board of Supervisors decision (identical record shape).
function VotesCard({ title, subtitle, votes }: { title: string; subtitle: string; votes: VoteRecord[] }) {
  if (!votes.length) return null;
  return (
    <div className="card mt-sec">
      <h3><Vote size={15} className="ico-mid" /> {title}</h3>
      <div className="cdesc">{subtitle}</div>
      {votes.map((v, i) => {
        const t = v.tally;
        const members = Object.entries(v.votes || {});
        // A tally is only meaningful when per-member votes were recorded. Voice /
        // unanimous-consent actions carry no counts (0–0), so label the method
        // instead of showing a confusing "0–0" next to an approval.
        const counted = t ? t.aye + t.nay + t.abstain : 0;
        const methodLabel = v.vote_method === "unanimous_consent" ? "Unanimous"
          : v.vote_method === "voice" ? "Voice vote" : null;
        return (
          <div key={i} className="bos-vote">
            <div className="bv-head">
              <span className={`bv-action ${v.action || ""}`}>{capitalize(v.action)}</span>
              <span className="muted">{fmtDate(v.date)}{v.meeting_type ? ` · ${v.meeting_type}` : ""}</span>
              {counted > 0
                ? <span className="bv-tally">{t!.aye}–{t!.nay}{t!.abstain ? ` · ${t!.abstain} abstain` : ""}{v.recused ? ` · ${v.recused} recused` : ""}</span>
                : methodLabel && <span className="bv-tally">{methodLabel}</span>}
            </div>
            {v.detail && <div className="bv-detail">{v.detail}</div>}
            {(v.motion_by || v.seconded_by) && (
              <div className="bv-motion muted">Motion: {v.motion_by || "—"}{v.seconded_by ? ` · 2nd: ${v.seconded_by}` : ""}</div>
            )}
            {members.length > 0 && (
              <div className="bv-members">
                {members.map(([name, vote]) => (
                  <span key={name} className="bv-member">
                    <i style={{ background: VOTE_COLOR[vote] || "var(--muted)" }} />{name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function AppDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a: AppRec | undefined = getApp(id);
  if (!a) return notFound();
  const lc: Lifecycle | undefined = getLifecycle(a.id);
  const tl = lc?.timeline || [];
  const related = lc?.related || [];
  const docs = lc?.docs || [];
  const votes = lc?.bos_votes || [];
  const pcVotes = lc?.pc_votes || [];

  return (
    <>
      <section className="detail-head">
        <div className="wrap">
          <div className="crumb"><Link href="/applications"><ArrowLeft size={13} className="ico-mid" /> All applications</Link></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <span className="pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{a.casetype}</span>
            <span className="cat"><i style={{ background: catColor(a.category) }} />{a.category}</span>
            <Badge color={STCOLOR[a.status] || "gray"} variant="soft" radius="full">{a.status}</Badge>
          </div>
          <h1>{a.name || a.casetype} <span className="muted" style={{ fontWeight: 500, fontSize: "0.6em" }}>{a.id}</span></h1>
          {a.description && a.description !== a.name && <p className="ink2" style={{ margin: "4px 0 0", maxWidth: "70ch" }}>{a.description}</p>}
          <div className="meta">
            {a.district && <span><MapPin size={13} className="ico-mid" /> {a.district}{a.precinct ? ` · ${a.precinct}` : ""}</span>}
            {a.acres > 0 && <span>{a.acres.toLocaleString()} acres</span>}
            <span>{a.in_uda ? "Inside UDA" : "Rural (outside UDA)"}</span>
            {a.applicant && <span>Applicant: {a.applicant}</span>}
          </div>
        </div>
      </section>

      <main className="wrap">
        <div className="detail-grid">
          {/* LEFT: pipeline + related + docs */}
          <div>
            <div className="card">
              <h3>Pipeline</h3>
              <div className="cdesc">The stages this application moved through.</div>
              {tl.length ? (
                <div className="timeline">
                  {tl.map((t, i) => (
                    <div key={i} className={`tl-item ${t.stage} ${t.stage === "decision" ? a.status : ""}`}>
                      <span className="node" />
                      <div className="d">{fmtDate(t.date)}</div>
                      <div className="l">{STAGE_ICON[t.stage]} <span style={{ verticalAlign: 1, marginLeft: 4 }}>{t.label}</span></div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty">No dated stages recorded for this case.</div>}
              {a.approval_months != null && <div className="foot">Recorded {a.approval_months} months from submittal to decision. {a.casetype === "Rezoning" && "Rezoning spans reflect the submit→hearing window, not the full legislative timeline."}</div>}
            </div>

            <VotesCard
              title="Planning Commission recommendations"
              subtitle={`Recorded Commission ${pcVotes.length > 1 ? "actions" : "action"} on this case, from the meeting minutes — the Commission recommends before the Board decides.`}
              votes={pcVotes}
            />

            <VotesCard
              title="Board of Supervisors votes"
              subtitle={`Recorded Board ${votes.length > 1 ? "actions" : "action"} on this case, from the meeting minutes.`}
              votes={votes}
            />

            <div className="card mt-sec">
              <h3><Layers size={15} className="ico-mid" /> Related cases on the same land</h3>
              <div className="cdesc">Other applications sharing parcels — usually stages of one project (rezoning → plan → subdivision → site plan).</div>
              {related.length ? related.map((r) => (
                <Link key={r.id} href={`/applications/${slugify(r.id)}`} className="related-item">
                  <i style={{ width: 9, height: 9, borderRadius: 2, background: catColor(r.category), flex: "none" }} />
                  <div>
                    <div className="rt">{r.casetype} <span className="muted" style={{ fontWeight: 500 }}>{r.id}</span></div>
                    <div className="rs">{r.status}{r.year ? ` · filed ${r.year}` : ""}</div>
                  </div>
                  <span className="badge">{r.shared_parcels} shared parcel{r.shared_parcels > 1 ? "s" : ""}</span>
                </Link>
              )) : <div className="empty">No other applications recorded on these parcels.</div>}
            </div>

            {docs.length > 0 && (
              <div className="card mt-sec">
                <h3><FileText size={15} className="ico-mid" /> Documents</h3>
                <div className="cdesc">{docs.length} record{docs.length > 1 ? "s" : ""} harvested from the county repository.</div>
                {docs.map((d, i) => (
                  <div key={i} className="doc-item"><FileText size={14} className="muted" /> {d.name}</div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: facts + proffers + parcels */}
          <div>
            <div className="card">
              <h3>Key facts</h3>
              <dl className="kv" style={{ marginTop: 12 }}>
                <dt>Case type</dt><dd>{a.casetype}</dd>
                <dt>Category</dt><dd>{a.category}</dd>
                <dt>Status</dt><dd><Badge color={STCOLOR[a.status] || "gray"} variant="soft" radius="full">{a.status}</Badge></dd>
                <dt>Filed</dt><dd>{a.year_filed ?? "—"}</dd>
                <dt>Approved</dt><dd>{a.year_approved ?? "—"}</dd>
                <dt>Acres</dt><dd>{a.acres ? a.acres.toLocaleString() : "—"}</dd>
                <dt>Parcels</dt><dd>{lc?.parcels_count ?? a.parcels ?? "—"}</dd>
                <dt>Location</dt><dd>{a.in_uda ? "Inside UDA" : "Rural"}</dd>
                {lc && lc.realized_units > 0 && <><dt>Dwellings built</dt><dd>{lc.realized_units}</dd></>}
              </dl>
            </div>

            {lc?.proffers && (
              <div className="card mt-sec">
                <h3><FileSignature size={15} className="ico-mid" /> Proffers</h3>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>Residential cash</dt><dd>{lc.proffers.residential_cash ? "Yes" : "No"}</dd>
                  {lc.proffers.per_sqft ? (<><dt>Per sq ft</dt><dd>{lc.proffers.per_sqft}</dd></>) : null}
                  <dt>Source</dt><dd>{lc.proffers.source}</dd>
                </dl>
                {lc.proffers.needs_review && <div className="foot">OCR-sourced — figures need manual verification.</div>}
              </div>
            )}

            {lc && lc.parcels.length > 0 && (
              <div className="card mt-sec">
                <h3><MapPin size={15} className="ico-mid" /> Parcels</h3>
                <div className="cdesc">{lc.parcels_count} parcel{lc.parcels_count > 1 ? "s" : ""} in this application.</div>
                <div>{lc.parcels.map((p) => <span key={p} className="parcelchip">{p}</span>)}</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
