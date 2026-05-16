/**
 * DRAFT — stage list and FUNNEL_BACKBONE are placeholders until Lewis / product sign-off.
 * DB may contain any `pipeline_stage` string; unknown values still show in the Live shell.
 *
 * Single source of truth for funnel labels in the UI (Live Feed cohort view, Funnel Health, etc.).
 * Keep `pipeline_stage` values in Postgres / n8n aligned with agreed names — same spelling.
 *
 * Flow (Social Funnel narrative — subject to revision):
 * - Ingest → all become "new", then "contacted".
 * - From contacted: some book an audit call early (`audit_booked` = Cal.com booking for audit — not a different concept from "booking").
 * - Others enter 7-touch follow-up (`nurture` or implied by FollowUpQueue — refine when stages are finalized).
 * - Booked path: show / no-show → proposal → `client` or `dead` → eventual reactivation workflows for dormant/no-show/dead.
 */

export type PipelineStageKey =
  | "new"
  | "contacted"
  | "warm"
  | "hot"
  | "nurture"
  | "audit_booked"
  | "no_show"
  | "client"
  | "dead";

/** Prisma `Lead.pipelineStage` string — must match n8n updates. */
export const PIPELINE_DB_STAGES = [
  "new",
  "contacted",
  "warm",
  "hot",
  "nurture",
  "audit_booked",
  "no_show",
  "client",
  "dead",
] as const satisfies readonly PipelineStageKey[];

/**
 * Animation / metrics note (Live funnel + health):
 * After ingest → contacted, a lead may: (A) book an audit call quickly from first response, or
 * (B) enter 7-touch nurture. Path B is NOT sequential-only: at ANY touch (1–7), the same lead can
 * still move to `audit_booked`. Visuals (e.g. “train tracks”, merging branches) should allow both
 * “fast line” and “scenic line” to join the same booked junction — not a cage that only exits after touch 7.
 *
 * Wishlist (perf): sketch motion with SVG/CSS first; move to canvas only if needed — keep smooth on
 * slow-changing poll data (10–15s refresh, not 60fps simulation).
 */

/** Ordered “backbone” for cohort charts (counts moving down the funnel). Branch labels are UI-only splits. */
export const FUNNEL_BACKBONE = [
  { id: "captured", dbStages: ["new"], label: "New / ingested", shortLabel: "New" },
  { id: "contacted", dbStages: ["contacted", "warm", "hot"], label: "Contacted & qualified", shortLabel: "Contact" },
  {
    id: "nurture_branch",
    dbStages: ["nurture"],
    label: "7-touch / nurture",
    shortLabel: "Nurture",
    isBranch: true,
  },
  {
    id: "booked",
    dbStages: ["audit_booked", "no_show"],
    label: "Audit booked (incl. no-show)",
    shortLabel: "Booked",
  },
  { id: "won", dbStages: ["client"], label: "Closed deal", shortLabel: "Won" },
  { id: "lost", dbStages: ["dead"], label: "Dead / lost (reactivation later)", shortLabel: "Dead" },
] as const;

export function stageInSet(stage: string, dbStages: readonly string[]): boolean {
  return dbStages.some((s) => s.toLowerCase() === stage.toLowerCase());
}

/** Sort API stage rows for horizontal funnel: known order first, then by count. */
export function sortStagesForDisplay(rows: { stage: string; count: number }[]): { stage: string; count: number }[] {
  const rank = new Map<string, number>(PIPELINE_DB_STAGES.map((s, i) => [s, i]));
  return [...rows].sort((a, b) => {
    const ra = rank.has(a.stage) ? rank.get(a.stage)! : 1000;
    const rb = rank.has(b.stage) ? rank.get(b.stage)! : 1000;
    if (ra !== rb) return ra - rb;
    return b.count - a.count;
  });
}
