/** Mirrors backend `CHANNELS` in normalize.ts */
export const CHANNELS = ["facebook", "web", "whatsapp", "linkedin"] as const;
export type LeadChannel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  facebook: "Facebook / Instagram",
  web: "Web / form",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
};
