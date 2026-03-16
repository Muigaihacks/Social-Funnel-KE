/**
 * Multi-Channel Capture & Normalization (Section 3A).
 * Maps disparate payloads (FB, Web, WhatsApp, LinkedIn) into a single Lead schema.
 */

import { z } from "zod";

export const CHANNELS = ["facebook", "web", "whatsapp", "linkedin"] as const;
export type Channel = (typeof CHANNELS)[number];

export const NormalizedLeadSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  channel: z.enum(CHANNELS),
  leadType: z.enum(["REAL_ESTATE", "CONSTRUCTION"]).optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  whatsappOptIn: z.boolean().optional(),
});
export type NormalizedLead = z.infer<typeof NormalizedLeadSchema>;

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (!digits.startsWith("254")) return "254" + digits;
  return digits;
}

/** Facebook / Instagram Lead Form webhook payload */
export function normalizeFacebookLeadForm(body: unknown): NormalizedLead {
  const raw = z.object({
    full_name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone_number: z.string(),
    email: z.string().optional(),
    lead_source: z.string().optional(),
    ad_id: z.string().optional(),
  }).passthrough().parse(body);

  const name = (raw.full_name ?? [raw.first_name, raw.last_name].filter(Boolean).join(" ")) || undefined;
  return {
    phone: toE164(raw.phone_number),
    name: name || undefined,
    email: raw.email?.trim() || undefined,
    source: raw.lead_source ?? raw.ad_id ?? "facebook_lead",
    channel: "facebook",
    whatsappOptIn: true,
  };
}

/** Generic website webhook (e.g. form submit) */
export function normalizeWebhook(body: unknown): NormalizedLead {
  const raw = z.object({
    name: z.string().optional(),
    fullName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string(),
    email: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    budget: z.string().optional(),
    timeline: z.string().optional(),
    leadType: z.string().optional(),
  }).passthrough().parse(body);

  const name = (raw.name ?? raw.fullName ?? [raw.firstName, raw.lastName].filter(Boolean).join(" ")) || undefined;
  const source = [raw.utm_source, raw.utm_medium, raw.utm_campaign].filter(Boolean).join("_") || "web";
  const leadType = raw.leadType?.toUpperCase() === "CONSTRUCTION" ? "CONSTRUCTION" : raw.leadType?.toUpperCase() === "REAL_ESTATE" ? "REAL_ESTATE" : undefined;
  return {
    phone: toE164(raw.phone),
    name: name || undefined,
    email: raw.email?.trim() || undefined,
    source: source || "web",
    channel: "web",
    leadType,
    budget: raw.budget || undefined,
    timeline: raw.timeline || undefined,
  };
}

/** WhatsApp inbound (e.g. 360dialog / Business API) */
export function normalizeWhatsApp(body: unknown): NormalizedLead {
  const raw = z.object({
    contacts: z.array(z.object({
      wa_id: z.string(),
      profile: z.object({ name: z.string().optional() }).optional(),
    })).optional(),
    messages: z.array(z.object({
      from: z.string(),
      type: z.string().optional(),
      text: z.object({ body: z.string().optional() }).optional(),
    })).optional(),
  }).passthrough().parse(body);

  const contact = raw.contacts?.[0] ?? raw.messages?.[0];
  const phone = (contact && "wa_id" in contact ? contact.wa_id : contact && "from" in contact ? (contact as { from: string }).from : "") || "";
  const name = raw.contacts?.[0]?.profile?.name ?? undefined;
  return {
    phone: toE164(phone),
    name,
    email: undefined,
    source: "whatsapp_inbound",
    channel: "whatsapp",
    whatsappOptIn: true,
  };
}

/** LinkedIn Lead Gen / Webhook */
export function normalizeLinkedIn(body: unknown): NormalizedLead {
  const raw = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
    formName: z.string().optional(),
    campaignId: z.string().optional(),
  }).passthrough().parse(body);

  const phone = raw.phoneNumber ?? "";
  if (!phone) throw new Error("LinkedIn payload missing phoneNumber");
  const name = [raw.firstName, raw.lastName].filter(Boolean).join(" ") || undefined;
  return {
    phone: toE164(phone),
    name,
    email: raw.email?.trim() || undefined,
    source: raw.formName ?? raw.campaignId ?? "linkedin",
    channel: "linkedin",
  };
}

export type IngestSource = "facebook" | "web" | "whatsapp" | "linkedin";

export function normalize(payload: unknown, source: IngestSource): NormalizedLead {
  switch (source) {
    case "facebook":
      return normalizeFacebookLeadForm(payload);
    case "web":
      return normalizeWebhook(payload);
    case "whatsapp":
      return normalizeWhatsApp(payload);
    case "linkedin":
      return normalizeLinkedIn(payload);
    default:
      throw new Error(`Unknown ingest source: ${source}`);
  }
}
