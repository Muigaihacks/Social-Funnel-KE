export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "nurture",
  "booked",
  "no_show",
  "closed",
  "dead",
] as const;

export type PipelineStageOption = (typeof PIPELINE_STAGES)[number];
