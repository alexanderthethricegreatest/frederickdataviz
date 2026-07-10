import atlasRaw from "@/data/atlas.json";
import libraryRaw from "@/data/applications_library.json";
import pipelineRaw from "@/data/applications_pipeline.json";
import votesRaw from "@/data/votes_analysis.json";

export const atlas = atlasRaw as any;
export const library = libraryRaw as any;
export const pipeline = pipelineRaw as any;
export const votesAnalysis = votesRaw as any;

export type AppRec = {
  id: string; casetype: string; name: string; description: string;
  applicant: string; category: string; district: string; precinct: string;
  acres: number; parcels: number; in_uda: boolean;
  year_filed: number | null; year_approved: number | null;
  approval_months: number | null; status: string;
  decided: boolean; approved: boolean; realized_units: number;
  has_proffers: boolean; residential_cash_proffer: boolean;
  bos_decision: BosSummary | null; n_bos_decisions: number;
  tags: string[];
};

export type Tally = { aye: number; nay: number; abstain: number; absent: number };
export type BosSummary = {
  action: string; date: string | null; tally: Tally;
  n_decisions: number; unanimous: boolean;
};
export type VoteRecord = {
  date: string | null; meeting_type: string | null; action: string | null;
  motion_by: string | null; seconded_by: string | null; vote_method: string | null;
  tally: Tally | null; recused: number;
  votes: Record<string, string>; detail: string | null; source_file: string | null;
};
// BOS and Planning Commission records share the same shape.
export type BosVote = VoteRecord;

export type Lifecycle = {
  timeline: { stage: string; date: string | null; label: string }[];
  related: { id: string; casetype: string; status: string; year: number | null;
             category: string; shared_parcels: number; stage_rank: number }[];
  proffers: any | null;
  realized_units: number;
  parcels: string[];
  parcels_count: number;
  docs: { name: string; file: string }[];
  hearing_body: string | null;
  bos_votes: VoteRecord[];
  pc_votes: VoteRecord[];
};

export const apps: AppRec[] = library.applications;
export const meta = library.meta;
export const slugify = (id: string) => id.replace(/ /g, "_");
export const unslug = (s: string) => s.replace(/_/g, " ");

export const CATEGORY_ORDER = ["Residential", "Commercial", "Industrial",
  "Institutional", "Solar", "Telecom", "Infrastructure", "Procedural", "Other"];
export const SERIES = ["#2a78d6", "#1baf7a", "#eda100", "#008300",
  "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
export const catColor = (c: string) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return SERIES[(i < 0 ? 8 : i) % 8];
};

export const fmtI = (n: number) => Math.round(n).toLocaleString();
export const fmtM = (n: number) => { const a = Math.abs(n); return a >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "B" : a >= 1e6 ? "$" + (n / 1e6).toFixed(0) + "M" : a >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "k" : "$" + Math.round(n); };
export const pctS = (n: number) => (Number.isInteger(n) ? n : +n.toFixed(1)) + "%";
export const fmtAc = (n: number) => Math.round(n).toLocaleString() + " ac";

export function getApp(slug: string): AppRec | undefined {
  return apps.find((a) => slugify(a.id) === slug);
}
export function getLifecycle(id: string): Lifecycle | undefined {
  return pipeline[id];
}
