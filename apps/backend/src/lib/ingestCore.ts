/**
 * Shared ingest core: deduplicate by phone/email, create or update Lead, log activity.
 * Used by POST /api/v1/ingest and by webhook handlers that normalize payloads and then ingest.
 */

import { prisma } from "./db.js";
import type { NormalizedLead } from "./normalize.js";
import { triggerN8nOnIngest } from "./n8nTrigger.js";

export type IngestSource = "facebook" | "web" | "whatsapp" | "linkedin";

export interface IngestResult {
  leadId: string;
  deduplicated: boolean;
  pipelineStage: string;
}

export async function ingestLead(
  normalized: NormalizedLead,
  tenantId: string | null,
  source: IngestSource
): Promise<IngestResult> {
  const existingByPhone = normalized.phone
    ? await prisma.lead.findFirst({
        where: { phone: normalized.phone, ...(tenantId ? { tenantId } : {}) },
        orderBy: { updatedAt: "desc" },
      })
    : null;
  const existingByEmail =
    normalized.email && !existingByPhone
      ? await prisma.lead.findFirst({
          where: { email: normalized.email, ...(tenantId ? { tenantId } : {}) },
          orderBy: { updatedAt: "desc" },
        })
      : null;

  const existing = existingByPhone ?? existingByEmail;
  const now = new Date();
  const sourceStr = normalized.source ?? source;

  if (existing) {
    const sources = existing.sources.includes(sourceStr)
      ? existing.sources
      : [...existing.sources, sourceStr].filter(Boolean);

    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        lastContactDate: now,
        sources,
        name: normalized.name ?? existing.name,
        email: normalized.email ?? existing.email,
        source: normalized.source ?? existing.source,
        channel: normalized.channel,
        leadType: normalized.leadType ?? existing.leadType,
        budget: normalized.budget ?? existing.budget,
        timeline: normalized.timeline ?? existing.timeline,
        whatsappOptIn: normalized.whatsappOptIn ?? existing.whatsappOptIn,
        updatedAt: now,
      },
    });

    await prisma.activityLog.create({
      data: {
        leadId: updated.id,
        action: "ingested",
        payload: { source, deduplicated: true, previousStage: existing.pipelineStage },
      },
    });

    await triggerN8nOnIngest({
      leadId: updated.id,
      deduplicated: true,
      pipelineStage: updated.pipelineStage,
      tenantId,
      source,
      normalized,
    });

    return {
      leadId: updated.id,
      deduplicated: true,
      pipelineStage: updated.pipelineStage,
    };
  }

  const lead = await prisma.lead.create({
    data: {
      phone: normalized.phone,
      name: normalized.name ?? null,
      email: normalized.email ?? null,
      source: normalized.source ?? null,
      channel: normalized.channel,
      sources: [sourceStr].filter(Boolean),
      leadType: normalized.leadType ?? null,
      budget: normalized.budget ?? null,
      timeline: normalized.timeline ?? null,
      whatsappOptIn: normalized.whatsappOptIn ?? false,
      pipelineStage: "new",
      tenantId,
    },
  });

  await prisma.stageTransition.create({
    data: { leadId: lead.id, toStage: "new" },
  });

  await prisma.activityLog.create({
    data: {
      leadId: lead.id,
      action: "ingested",
      payload: { source, deduplicated: false },
    },
  });

  await triggerN8nOnIngest({
    leadId: lead.id,
    deduplicated: false,
    pipelineStage: lead.pipelineStage,
    tenantId,
    source,
    normalized,
  });

  return {
    leadId: lead.id,
    deduplicated: false,
    pipelineStage: lead.pipelineStage,
  };
}
