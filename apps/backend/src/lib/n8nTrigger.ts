import type { NormalizedLead } from "./normalize.js";

interface TriggerPayload {
  event: "lead_ingested";
  leadId: string;
  deduplicated: boolean;
  pipelineStage: string;
  tenantId: string | null;
  source: string;
  channel: string;
  normalized: {
    phone: string;
    name?: string;
    email?: string;
    source?: string;
    channel: string;
    leadType?: string;
    budget?: string;
    timeline?: string;
    whatsappOptIn?: boolean;
  };
  ingestedAt: string;
}

/**
 * Triggers n8n after a lead is ingested, so n8n can run S2+ workflows.
 * If no webhook URL is configured, this is a no-op.
 */
export async function triggerN8nOnIngest(args: {
  leadId: string;
  deduplicated: boolean;
  pipelineStage: string;
  tenantId: string | null;
  source: string;
  normalized: NormalizedLead;
}): Promise<void> {
  const url = process.env.N8N_INGEST_WEBHOOK_URL;
  if (!url) return;

  const payload: TriggerPayload = {
    event: "lead_ingested",
    leadId: args.leadId,
    deduplicated: args.deduplicated,
    pipelineStage: args.pipelineStage,
    tenantId: args.tenantId,
    source: args.source,
    channel: args.normalized.channel,
    normalized: {
      phone: args.normalized.phone,
      name: args.normalized.name,
      email: args.normalized.email,
      source: args.normalized.source,
      channel: args.normalized.channel,
      leadType: args.normalized.leadType,
      budget: args.normalized.budget,
      timeline: args.normalized.timeline,
      whatsappOptIn: args.normalized.whatsappOptIn,
    },
    ingestedAt: new Date().toISOString(),
  };

  const secret = process.env.N8N_INGEST_WEBHOOK_SECRET;
  const timeoutMs = Number(process.env.N8N_INGEST_WEBHOOK_TIMEOUT_MS ?? "4000");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (secret) headers["x-acqos-webhook-secret"] = secret;

    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("n8n ingest trigger failed:", err);
  } finally {
    clearTimeout(timer);
  }
}

