import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";
import { CHANNELS, normalizeWebhook, NormalizedLeadSchema } from "../lib/normalize.js";
import { ingestLead } from "../lib/ingestCore.js";

const router = Router();

/** n8n path params and Set-node strings sometimes include trailing newlines; Express leaves them in `:leadId`. */
function normalizedLeadIdParam(raw: string | undefined): string {
  try {
    return decodeURIComponent(String(raw ?? "").trim());
  } catch {
    return String(raw ?? "").trim();
  }
}

function getTenantId(headers: Record<string, unknown>): string | null {
  const raw = headers["x-tenant-id"];
  return typeof raw === "string" ? raw : null;
}

function internalSecretOk(req: { headers: Record<string, unknown> }): boolean {
  const expected = process.env.INTERNAL_AUTOMATION_SECRET;
  if (!expected || expected.length === 0) return true;
  const got = req.headers["x-internal-secret"];
  return typeof got === "string" && got === expected;
}

/** Lead id is globally unique; `x-tenant-id` only hides cross-tenant rows when the lead has a non-null tenant_id. */
function leadFailsTenantGate(lead: { tenantId: string | null }, requestTenantId: string | null): boolean {
  if (!requestTenantId) return false;
  if (!lead.tenantId) return false;
  return lead.tenantId !== requestTenantId;
}

async function findLeadVisibleToTenant(leadIdRaw: string, tenantId: string | null) {
  const leadId = normalizedLeadIdParam(leadIdRaw);
  if (!leadId) return null;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  if (leadFailsTenantGate(lead, tenantId)) return null;
  return lead;
}

const MarkContactedSchema = z.object({
  stage: z.string().optional().default("contacted"),
  respondedAt: z.string().datetime().optional(),
});

router.post("/leads/:leadId/mark-contacted", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = MarkContactedSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const now = body.respondedAt ? new Date(body.respondedAt) : new Date();

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineStage: body.stage,
        lastContactDate: now,
      },
    });

    await prisma.stageTransition.create({
      data: {
        leadId: updated.id,
        fromStage: lead.pipelineStage,
        toStage: updated.pipelineStage,
      },
    });

    await prisma.activityLog.create({
      data: {
        leadId: updated.id,
        action: "first_response_sent",
        payload: { stage: updated.pipelineStage, respondedAt: now.toISOString() },
      },
    });

    return res.json({ ok: true, leadId: updated.id, pipelineStage: updated.pipelineStage });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const TerminateLeadSchema = z.object({
  reason: z.string().max(2000).optional(),
});

/** Mark lead as dead, skip pending follow-ups, audit trail (dashboard or n8n). */
router.post("/leads/:leadId/terminate", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = TerminateLeadSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const fromStage = lead.pipelineStage;
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineStage: "dead",
        lastContactDate: new Date(),
      },
    });

    await prisma.stageTransition.create({
      data: { leadId: updated.id, fromStage, toStage: "dead" },
    });

    await prisma.followUpQueue.updateMany({
      where: { leadId: updated.id, status: "pending" },
      data: { status: "skipped" },
    });

    await prisma.activityLog.create({
      data: {
        leadId: updated.id,
        action: "lead_terminated",
        payload: { fromStage, reason: body.reason ?? null },
      },
    });

    return res.json({ ok: true, leadId: updated.id, pipelineStage: updated.pipelineStage });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const ReactivateLeadSchema = z.object({
  note: z.string().max(2000).optional(),
  reactivationAttempt: z.number().int().min(1).max(3).optional(),
});

/**
 * Mark lead as reactivated (S7 dormant reactivation workflow).
 * Updates pipeline stage to "reactivated" and logs activity.
 */
router.post("/leads/:leadId/mark-reactivated", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = ReactivateLeadSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    if (lead.pipelineStage === "reactivated") {
      return res.json({ ok: true, leadId: lead.id, pipelineStage: "reactivated", already: true });
    }

    const fromStage = lead.pipelineStage;
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineStage: "reactivated",
        lastContactDate: new Date(),
      },
    });

    await prisma.stageTransition.create({
      data: { leadId: lead.id, fromStage, toStage: "reactivated" },
    });

    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "reactivated",
        payload: {
          fromStage,
          note: body.note ?? null,
          reactivationAttempt: body.reactivationAttempt ?? null,
          source: "s7_dormant_reactivation",
        },
      },
    });

    return res.json({ ok: true, leadId: lead.id, pipelineStage: "reactivated" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const DashboardNoteSchema = z.object({
  text: z.string().min(1).max(8000),
});

/** Internal dashboard note — stored as activity row (`dashboard_note`), shown on lead profile. */
router.post("/leads/:leadId/notes", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = DashboardNoteSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "dashboard_note",
        payload: { text: body.text.trim() },
      },
    });

    return res.status(201).json({ ok: true, leadId: lead.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const UpsertScoreSchema = z.object({
  score: z.number().int().min(1).max(10),
  reason: z.string().min(1),
  stage: z.string().optional(),
});

router.post("/leads/:leadId/score", async (req, res) => {
  try {
    const { leadId } = req.params;
    const { score, reason, stage } = UpsertScoreSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        leadScore: score,
        scoreReason: reason,
        ...(stage ? { pipelineStage: stage } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        leadId: updated.id,
        action: "scored",
        payload: { score, reason, stage: updated.pipelineStage },
      },
    });

    return res.json({ ok: true, leadId: updated.id, score: updated.leadScore, stage: updated.pipelineStage });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const MessageLogSchema = z.object({
  channel: z.string(),
  direction: z.enum(["outbound", "inbound"]).optional().default("outbound"),
  body: z.string().optional(),
  externalId: z.string().optional(),
  sentAt: z.string().datetime().optional(),
});

router.post("/leads/:leadId/messages", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = MessageLogSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const sentAt = body.sentAt ? new Date(body.sentAt) : new Date();

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const log = await prisma.messageLog.create({
      data: {
        leadId: lead.id,
        channel: body.channel,
        direction: body.direction,
        body: body.body,
        externalId: body.externalId,
        sentAt,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContactDate: sentAt },
    });

    return res.status(201).json({ ok: true, messageLogId: log.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

// n8n poller: get newly ingested leads still in "new" stage
router.get("/new-leads", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const sinceStr = typeof req.query.since === "string" ? req.query.since : undefined;
    const since = sinceStr ? new Date(sinceStr) : new Date(Date.now() - 1000 * 60 * 60);
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const logs = await prisma.activityLog.findMany({
      where: {
        action: "ingested",
        createdAt: { gt: since },
        lead: {
          pipelineStage: "new",
          ...(tenantId ? { tenantId } : {}),
        },
      },
      include: {
        lead: true,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return res.json({
      ok: true,
      items: logs.map((l: (typeof logs)[number]) => ({
        ingestedAt: l.createdAt,
        leadId: l.lead.id,
        name: l.lead.name,
        phone: l.lead.phone,
        email: l.lead.email,
        source: l.lead.source,
        channel: l.lead.channel,
        pipelineStage: l.lead.pipelineStage,
      })),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const CreateFollowUpsSchema = z.object({
  touches: z.array(
    z.object({
      touchIndex: z.number().int().min(1),
      channel: z.string(),
      scheduledFor: z.string().datetime(),
    })
  ).min(1),
});

router.post("/leads/:leadId/followups", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = CreateFollowUpsSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const created = await prisma.$transaction(
      body.touches.map((t) =>
        prisma.followUpQueue.create({
          data: {
            leadId: lead.id,
            touchIndex: t.touchIndex,
            channel: t.channel,
            scheduledFor: new Date(t.scheduledFor),
          },
        })
      )
    );

    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "followup_scheduled",
        payload: { count: created.length },
      },
    });

    return res.status(201).json({ ok: true, count: created.length });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** List follow-up queue rows for a lead (dev, demos, dashboard). ?status=pending|all */
router.get("/leads/:leadId/followups", async (req, res) => {
  try {
    const { leadId } = req.params;
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const statusQ = typeof req.query.status === "string" ? req.query.status : "all";

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const items = await prisma.followUpQueue.findMany({
      where: {
        leadId: lead.id,
        ...(statusQ !== "all" ? { status: statusQ } : {}),
      },
      orderBy: { touchIndex: "asc" },
    });

    const pending = items.filter((i: (typeof items)[number]) => i.status === "pending").length;

    return res.json({
      ok: true,
      leadId: lead.id,
      summary: {
        total: items.length,
        pending,
        byStatus: {
          pending: items.filter((i: (typeof items)[number]) => i.status === "pending").length,
          sent: items.filter((i: (typeof items)[number]) => i.status === "sent").length,
          skipped: items.filter((i: (typeof items)[number]) => i.status === "skipped").length,
          aborted: items.filter((i: (typeof items)[number]) => i.status === "aborted").length,
        },
      },
      items: items.map((q: (typeof items)[number]) => ({
        followUpId: q.id,
        touchIndex: q.touchIndex,
        channel: q.channel,
        scheduledFor: q.scheduledFor,
        status: q.status,
        sentAt: q.sentAt,
      })),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/due-followups", async (req, res) => {
  try {
    const now = new Date();
    const limit = Math.min(Number(req.query.limit ?? 200), 1000);

    const due = await prisma.followUpQueue.findMany({
      where: {
        status: "pending",
        scheduledFor: { lte: now },
        lead: {
          pipelineStage: { notIn: ["audit_booked", "client", "dead"] },
        },
      },
      include: { lead: true },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    return res.json({
      ok: true,
      items: due.map((q: (typeof due)[number]) => ({
        followUpId: q.id,
        leadId: q.leadId,
        touchIndex: q.touchIndex,
        channel: q.channel,
        scheduledFor: q.scheduledFor,
        lead: {
          id: q.lead.id,
          name: q.lead.name,
          phone: q.lead.phone,
          email: q.lead.email,
          pipelineStage: q.lead.pipelineStage,
          followUpCount: q.lead.followUpCount,
        },
      })),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const MarkFollowUpSchema = z.object({
  status: z.enum(["sent", "skipped", "aborted"]),
});

router.post("/followups/:id/mark", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = MarkFollowUpSchema.parse(req.body ?? {});
    const q = await prisma.followUpQueue.findUnique({ where: { id } });
    if (!q) return res.status(404).json({ ok: false, error: "Follow-up not found" });

    const now = new Date();
    await prisma.followUpQueue.update({
      where: { id },
      data: {
        status,
        sentAt: status === "sent" ? now : null,
      },
    });

    if (status === "sent") {
      await prisma.lead.update({
        where: { id: q.leadId },
        data: {
          followUpCount: { increment: 1 },
          lastContactDate: now,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        leadId: q.leadId,
        action: `followup_${status}`,
        payload: { followUpId: id, touchIndex: q.touchIndex },
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Set a pending follow-up’s schedule to now so S4b / due poller picks it up immediately. */
router.post("/followups/:id/bump", async (req, res) => {
  try {
    const { id } = req.params;
    const q = await prisma.followUpQueue.findUnique({ where: { id } });
    if (!q) return res.status(404).json({ ok: false, error: "Follow-up not found" });
    if (q.status !== "pending") {
      return res.status(400).json({ ok: false, error: "Only pending follow-ups can be bumped" });
    }

    await prisma.followUpQueue.update({
      where: { id },
      data: { scheduledFor: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        leadId: q.leadId,
        action: "followup_bumped",
        payload: { followUpId: id, touchIndex: q.touchIndex },
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const CalendlyEventSchema = z.object({
  eventType: z.enum(["invitee.created", "invitee.canceled", "no_show"]),
  eventId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  startsAt: z.string().datetime().optional(),
});

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return `254${digits}`;
}

router.post("/calendly-event", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const body = CalendlyEventSchema.parse(req.body ?? {});
    const phone = normalizePhone(body.phone);

    const lead = await prisma.lead.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          ...(body.email ? [{ email: body.email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found for calendly event" });

    if (body.eventType === "invitee.created") {
      const fromStage = lead.pipelineStage;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          pipelineStage: "audit_booked",
          lastContactDate: new Date(),
        },
      });
      await prisma.stageTransition.create({
        data: { leadId: lead.id, fromStage, toStage: "audit_booked" },
      });
      await prisma.followUpQueue.updateMany({
        where: { leadId: lead.id, status: "pending" },
        data: { status: "skipped" },
      });
      await prisma.activityLog.create({
        data: {
          leadId: lead.id,
          action: "booked",
          payload: { eventId: body.eventId, startsAt: body.startsAt },
        },
      });
    } else if (body.eventType === "no_show") {
      const fromStage = lead.pipelineStage;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          pipelineStage: "no_show",
          lastContactDate: new Date(),
        },
      });
      await prisma.stageTransition.create({
        data: { leadId: lead.id, fromStage, toStage: "no_show" },
      });
      await prisma.activityLog.create({
        data: {
          leadId: lead.id,
          action: "no_show",
          payload: { eventId: body.eventId, startsAt: body.startsAt },
        },
      });
    } else {
      await prisma.activityLog.create({
        data: {
          leadId: lead.id,
          action: "booking_canceled",
          payload: { eventId: body.eventId, startsAt: body.startsAt },
        },
      });
    }

    return res.json({ ok: true, leadId: lead.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const ManualNoShowSchema = z.object({
  note: z.string().max(2000).optional(),
});

/**
 * Dashboard — record a no-show when Cal.com did not send `no_show` (host forgot, event auto-completed, etc.).
 * Same pipeline + activity outcome as webhook no_show.
 */
router.post("/leads/:leadId/mark-no-show", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = ManualNoShowSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    if (lead.pipelineStage === "no_show") {
      return res.json({ ok: true, leadId: lead.id, pipelineStage: "no_show", already: true });
    }
    if (lead.pipelineStage === "dead" || lead.pipelineStage === "client" || lead.pipelineStage === "closed") {
      return res.status(400).json({ ok: false, error: "Cannot mark no-show for client, closed or dead leads" });
    }

    const fromStage = lead.pipelineStage;
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineStage: "no_show",
        lastContactDate: new Date(),
      },
    });
    await prisma.stageTransition.create({
      data: { leadId: lead.id, fromStage, toStage: "no_show" },
    });
    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "no_show",
        payload: {
          manual: true,
          source: "dashboard",
          note: body.note ?? null,
        },
      },
    });

    return res.json({ ok: true, leadId: lead.id, pipelineStage: "no_show" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const ManualClosedSchema = z.object({
  note: z.string().max(2000).optional(),
});

/**
 * Dashboard — record a closed deal when a booked call results in a successful sale.
 */
router.post("/leads/:leadId/mark-closed", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = ManualClosedSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    if (lead.pipelineStage === "closed") {
      return res.json({ ok: true, leadId: lead.id, pipelineStage: "closed", already: true });
    }

    const fromStage = lead.pipelineStage;
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineStage: "closed",
        lastContactDate: new Date(),
      },
    });
    await prisma.stageTransition.create({
      data: { leadId: lead.id, fromStage, toStage: "closed" },
    });
    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "closed",
        payload: {
          manual: true,
          source: "dashboard",
          note: body.note ?? null,
        },
      },
    });

    return res.json({ ok: true, leadId: lead.id, pipelineStage: "closed" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** All pending touches (optionally only overdue). Same lead stage rules as due-followups. */
router.get("/follow-up-queue", async (req, res) => {
  try {
    const now = new Date();
    const dueOnly =
      req.query.dueOnly === "1" || String(req.query.dueOnly).toLowerCase() === "true";
    const channelRaw = typeof req.query.channel === "string" ? req.query.channel.trim().toLowerCase() : "";
    const channelQ = channelRaw === "email" || channelRaw === "whatsapp" ? channelRaw : null;
    const qSearch = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limit = Math.min(Math.max(Number(req.query.limit ?? 200), 1), 500);

    const leadSearch =
      qSearch.length > 0
        ? {
            OR: [
              { phone: { contains: qSearch } },
              { name: { contains: qSearch, mode: "insensitive" as const } },
              { email: { contains: qSearch, mode: "insensitive" as const } },
            ],
          }
        : undefined;

    const items = await prisma.followUpQueue.findMany({
      where: {
        status: "pending",
        ...(dueOnly ? { scheduledFor: { lte: now } } : {}),
        ...(channelQ ? { channel: channelQ } : {}),
        lead: {
          pipelineStage: { notIn: ["audit_booked", "client", "dead"] },
          ...(leadSearch ?? {}),
        },
      },
      include: { lead: true },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    return res.json({
      ok: true,
      items: items.map((q: (typeof items)[number]) => ({
        followUpId: q.id,
        leadId: q.leadId,
        touchIndex: q.touchIndex,
        channel: q.channel,
        scheduledFor: q.scheduledFor,
        isDue: q.scheduledFor <= now,
        lead: {
          id: q.lead.id,
          name: q.lead.name,
          phone: q.lead.phone,
          email: q.lead.email,
          pipelineStage: q.lead.pipelineStage,
        },
      })),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Mark a follow-up as skipped (sent immediately without actual sending) */
router.post("/follow-up/:id/skip", async (req, res) => {
  try {
    const { id } = req.params;
    
    const followUp = await prisma.followUpQueue.findUnique({
      where: { id },
    });

    if (!followUp) {
      return res.status(404).json({ ok: false, error: "Follow-up not found" });
    }

    await prisma.followUpQueue.update({
      where: { id },
      data: {
        status: "skipped",
        sentAt: new Date(),
      },
    });

    return res.json({ ok: true, followUpId: id, status: "skipped" });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Bump a follow-up by specified hours (default 24) */
router.post("/follow-up/:id/bump", async (req, res) => {
  try {
    const { id } = req.params;
    const hours = Number(req.body?.hours ?? 24);
    
    const followUp = await prisma.followUpQueue.findUnique({
      where: { id },
    });

    if (!followUp) {
      return res.status(404).json({ ok: false, error: "Follow-up not found" });
    }

    const newScheduledFor = new Date(followUp.scheduledFor.getTime() + hours * 60 * 60 * 1000);

    await prisma.followUpQueue.update({
      where: { id },
      data: {
        scheduledFor: newScheduledFor,
      },
    });

    return res.json({ ok: true, followUpId: id, newScheduledFor: newScheduledFor.toISOString() });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Cal.com / booking webhook outcomes for the dashboard (activity feed). */
router.get("/booking-events", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 80), 1), 200);

    const logs = await prisma.activityLog.findMany({
      where: {
        action: { in: ["booked", "booking_canceled", "no_show"] },
        ...(tenantId ? { lead: { tenantId } } : {}),
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            pipelineStage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.json({
      ok: true,
      items: logs.map((log: (typeof logs)[number]) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        payload: log.payload,
        lead: log.lead,
      })),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/leads/by-email", async (req, res) => {
  try {
    const raw = req.query.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    console.log("[by-email] raw query:", JSON.stringify(req.query), "| resolved email:", email);
    if (!email) return res.status(400).json({ ok: false, error: "email query param required" });
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const candidates = await prisma.lead.findMany({
      where: { email },
      orderBy: { updatedAt: "desc" },
      take: 25,
    });
    const lead = candidates.find((l) => !leadFailsTenantGate(l, tenantId)) ?? null;
    if (!lead) return res.status(404).json({ ok: false, error: "No lead found with that email" });

    const recentMessages = await prisma.messageLog.findMany({
      where: { leadId: lead.id },
      orderBy: { sentAt: "desc" },
      take: 10,
    });

    const pendingFollowUps = await prisma.followUpQueue.count({
      where: { leadId: lead.id, status: "pending" },
    });

    return res.json({
      ok: true,
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        leadScore: lead.leadScore,
        scoreReason: lead.scoreReason,
        pipelineStage: lead.pipelineStage,
        leadType: lead.leadType,
        followUpCount: lead.followUpCount,
        lastContactDate: lead.lastContactDate,
      },
      recentMessages: recentMessages.map((m: (typeof recentMessages)[number]) => ({
        id: m.id,
        channel: m.channel,
        direction: m.direction,
        body: m.body,
        sentAt: m.sentAt,
      })),
      pendingFollowUps,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/leads/:leadId/pause-followups", async (req, res) => {
  try {
    const { leadId } = req.params;
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const resumeAfterDays = Number(req.body?.resumeAfterDays ?? 0);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    if (resumeAfterDays > 0) {
      const now = new Date();
      const pending = await prisma.followUpQueue.findMany({
        where: { leadId: lead.id, status: "pending" },
        orderBy: { scheduledFor: "asc" },
      });
      const baseDelay = resumeAfterDays * 24 * 60 * 60 * 1000;
      await prisma.$transaction(
        pending.map((fq: (typeof pending)[number], idx: number) =>
          prisma.followUpQueue.update({
            where: { id: fq.id },
            data: { scheduledFor: new Date(now.getTime() + baseDelay + idx * 2 * 24 * 60 * 60 * 1000) },
          })
        )
      );
      await prisma.activityLog.create({
        data: { leadId: lead.id, action: "followups_rescheduled", payload: { resumeAfterDays, count: pending.length } },
      });
      return res.json({ ok: true, action: "rescheduled", count: pending.length, resumeAfterDays });
    }

    const result = await prisma.followUpQueue.updateMany({
      where: { leadId: lead.id, status: "pending" },
      data: { status: "aborted" },
    });

    await prisma.activityLog.create({
      data: { leadId: lead.id, action: "followups_paused", payload: { count: result.count } },
    });

    return res.json({ ok: true, action: "paused", count: result.count });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const UpdatePrioritySchema = z.object({
  score: z.number().int().min(1).max(10).optional(),
  reason: z.string().optional(),
  pipelineStage: z.string().optional(),
});

router.post("/leads/:leadId/update-priority", async (req, res) => {
  try {
    const { leadId } = req.params;
    const body = UpdatePrioritySchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const data: Record<string, unknown> = {};
    if (body.score !== undefined) data.leadScore = body.score;
    if (body.reason) data.scoreReason = body.reason;
    if (body.pipelineStage && body.pipelineStage !== lead.pipelineStage) {
      data.pipelineStage = body.pipelineStage;
      await prisma.stageTransition.create({
        data: { leadId: lead.id, fromStage: lead.pipelineStage, toStage: body.pipelineStage },
      });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "No fields to update" });
    }

    const updated = await prisma.lead.update({ where: { id: lead.id }, data });

    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "priority_updated",
        payload: { oldScore: lead.leadScore, newScore: updated.leadScore, pipelineStage: updated.pipelineStage },
      },
    });

    return res.json({ ok: true, leadId: updated.id, score: updated.leadScore, pipelineStage: updated.pipelineStage });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Single lead + recent related rows (dashboard / CRM detail drawer). */
router.get("/leads/:leadId", async (req, res) => {
  try {
    const leadId = normalizedLeadIdParam(req.params.leadId);
    if (!leadId) {
      return res.status(400).json({ ok: false, error: "Missing lead id" });
    }
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activityLogs: { orderBy: { createdAt: "desc" }, take: 50 },
        messageLogs: { orderBy: { sentAt: "desc" }, take: 40 },
        stageTransitions: { orderBy: { at: "desc" }, take: 40 },
        followUpQueue: { orderBy: { scheduledFor: "desc" }, take: 30 },
        conversationContexts: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    if (leadFailsTenantGate(lead, tenantId)) {
      return res.status(404).json({ ok: false, error: "Lead not found" });
    }

    const { activityLogs, messageLogs, stageTransitions, followUpQueue, conversationContexts, ...rest } = lead;
    return res.json({
      ok: true,
      lead: rest,
      activityLogs,
      messageLogs,
      stageTransitions,
      followUpQueue,
      conversationContexts,
      /** Convenience for S4b: same as conversationContexts[0] when sorted desc. */
      latestConversation: conversationContexts[0] ?? null,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const ConversationContextInSchema = z.object({
  summary: z.string().min(1).max(20000),
  topics: z.record(z.unknown()).optional(),
  rawExcerpt: z.string().max(8000).optional(),
  channel: z.string().optional().default("email"),
  s11Action: z.string().max(128).optional(),
  externalMessageId: z.string().max(512).optional(),
});

/**
 * n8n S11 — persist inbound-reply understanding for S4b personalization.
 * Call once per parsed inbound email (all routes: reply sent, priority-only, reschedule, etc.) when you have a summary.
 * Requires x-internal-secret when INTERNAL_AUTOMATION_SECRET is set.
 */
router.post("/leads/:leadId/conversation-context", async (req, res) => {
  try {
    if (!internalSecretOk(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const { leadId } = req.params;
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const body = ConversationContextInSchema.parse(req.body ?? {});

    const lead = await findLeadVisibleToTenant(leadId, tenantId);
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const row = await prisma.leadConversationContext.create({
      data: {
        leadId: lead.id,
        summary: body.summary,
        topics: body.topics === undefined ? undefined : (body.topics as object),
        rawExcerpt: body.rawExcerpt ?? null,
        channel: body.channel,
        s11Action: body.s11Action ?? null,
        externalMessageId: body.externalMessageId ?? null,
      },
    });

    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: "conversation_context_stored",
        payload: {
          contextId: row.id,
          s11Action: body.s11Action ?? null,
          channel: body.channel,
        },
      },
    });

    return res.status(201).json({ ok: true, id: row.id, leadId: lead.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

function buildLeadsListWhere(req: {
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
}): Prisma.LeadWhereInput {
  const tenantId = getTenantId(req.headers);
  const stage = typeof req.query.stage === "string" && req.query.stage.length > 0 ? req.query.stage : undefined;
  const channelRaw = typeof req.query.channel === "string" ? req.query.channel.trim().toLowerCase() : "";
  const channel =
    channelRaw === "facebook" ||
    channelRaw === "web" ||
    channelRaw === "whatsapp" ||
    channelRaw === "linkedin"
      ? channelRaw
      : undefined;
  const qSearch = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const minScoreRaw = req.query.minScore;
  const maxScoreRaw = req.query.maxScore;
  const minScore =
    minScoreRaw !== undefined && minScoreRaw !== "" && !Number.isNaN(Number(minScoreRaw))
      ? Number(minScoreRaw)
      : undefined;
  const maxScore =
    maxScoreRaw !== undefined && maxScoreRaw !== "" && !Number.isNaN(Number(maxScoreRaw))
      ? Number(maxScoreRaw)
      : undefined;

  const leadSearch =
    qSearch.length > 0
      ? {
          OR: [
            { phone: { contains: qSearch } },
            { name: { contains: qSearch, mode: "insensitive" as const } },
            { email: { contains: qSearch, mode: "insensitive" as const } },
          ],
        }
      : undefined;

  const scoreFilter =
    minScore !== undefined || maxScore !== undefined
      ? {
          leadScore: {
            ...(minScore !== undefined ? { gte: minScore } : {}),
            ...(maxScore !== undefined ? { lte: maxScore } : {}),
          },
        }
      : {};

  return {
    ...(tenantId ? { tenantId } : {}),
    ...(stage ? { pipelineStage: stage } : {}),
    ...(channel ? { channel } : {}),
    ...(leadSearch ?? {}),
    ...scoreFilter,
  };
}

const ManualLeadCreateSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  channel: z.enum(CHANNELS).optional().default("web"),
  source: z.string().optional(),
  leadType: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  whatsappOptIn: z.boolean().optional(),
  /** Optional note stored on the lead profile at creation time */
  notes: z.string().max(4000).optional(),
});

/** Dashboard: add a new lead to the pipeline (same dedupe + ingest path as webhooks). */
router.post("/leads", async (req, res) => {
  try {
    const body = ManualLeadCreateSchema.parse(req.body ?? {});
    const tenantId = getTenantId(req.headers as Record<string, unknown>);

    const normalized = {
      ...normalizeWebhook({
        phone: body.phone,
        name: body.name,
        email: body.email || undefined,
        source: body.source?.trim() || "dashboard_manual",
        leadType: body.leadType,
        budget: body.budget,
        timeline: body.timeline,
      }),
      channel: body.channel,
      whatsappOptIn: body.whatsappOptIn,
    };
    NormalizedLeadSchema.parse(normalized);

    const ingestSource =
      body.channel === "facebook"
        ? "facebook"
        : body.channel === "whatsapp"
          ? "whatsapp"
          : body.channel === "linkedin"
            ? "linkedin"
            : "web";

    const result = await ingestLead(normalized, tenantId, ingestSource);

    if (body.notes?.trim()) {
      await prisma.activityLog.create({
        data: {
          leadId: result.leadId,
          action: "dashboard_note",
          payload: { text: body.notes.trim(), createdWithLead: true },
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        leadId: result.leadId,
        action: "lead_created_manual",
        payload: { source: "dashboard", deduplicated: result.deduplicated },
      },
    });

    return res.status(result.deduplicated ? 200 : 201).json({
      ok: true,
      leadId: result.leadId,
      deduplicated: result.deduplicated,
      pipelineStage: result.pipelineStage,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Validation failed", details: err.flatten() });
    }
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

// Dashboard / CRM-style list (paginated, filterable)
router.get("/leads", async (req, res) => {
  try {
    const where = buildLeadsListWhere({
      query: req.query as Record<string, unknown>,
      headers: req.headers as Record<string, unknown>,
    });
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          name: true,
          email: true,
          phone: true,
          source: true,
          channel: true,
          leadType: true,
          budget: true,
          pipelineStage: true,
          leadScore: true,
          lastContactDate: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return res.json({
      ok: true,
      total,
      offset,
      limit,
      items,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/dormant-leads", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const days = Math.max(Number(req.query.days ?? 30), 1);
    const limit = Math.min(Number(req.query.limit ?? 200), 1000);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const leads = await prisma.lead.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        pipelineStage: { notIn: ["client", "dead"] },
        OR: [
          { lastContactDate: { lt: cutoff } },
          { lastContactDate: null, createdAt: { lt: cutoff } },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });

    return res.json({ ok: true, items: leads });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Live funnel shell + future Lewis health — draft counts; does not change pipeline-stats contract. */
router.get("/funnel-live", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const days = Math.min(Math.max(Number(req.query.days ?? 7), 1), 90);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const whereBase = tenantId ? { tenantId } : {};

    // Define all pipeline stages we want to show (in order)
    const allStages = ["new", "contacted", "nurture", "booked", "audit_booked", "no_show", "closed", "dead", "reactivated"];

    // Get actual stage counts, new leads, and metrics in parallel
    const [byStage, newLeadsInPeriod, funnelMetrics] = await Promise.all([
      prisma.lead.groupBy({
        by: ["pipelineStage"],
        where: whereBase,
        _count: true,
      }),
      prisma.lead.count({
        where: { ...whereBase, createdAt: { gte: from } },
      }),
      calculateFunnelMetrics(tenantId ?? null, days),
    ]);

    // Create a map of existing counts
    const stageCounts = new Map(
      byStage.map((s: { pipelineStage: string; _count: number }) => [s.pipelineStage, s._count])
    );

    // Return all stages with their counts (0 for missing stages)
    const stages = allStages.map((stage) => ({
      stage,
      count: stageCounts.get(stage) ?? 0,
    }));

    // Generate anomalies based on metrics
    const anomalies: Array<{ id: string; severity: "warning" | "critical"; message: string }> = [];

    // Low daily lead volume (configurable threshold - default 5)
    const avgLeadsPerDay = funnelMetrics.avgLeadsPerDay;
    if (avgLeadsPerDay < 5) {
      anomalies.push({
        id: "low-lead-volume",
        severity: "warning",
        message: `Average lead volume (${avgLeadsPerDay.toFixed(1)}/day) below threshold of 5/day`,
      });
    }

    // High no-show rate
    if (funnelMetrics.noShowRate > 30) {
      anomalies.push({
        id: "high-no-show-rate",
        severity: "critical",
        message: `No-show rate at ${funnelMetrics.noShowRate.toFixed(1)}% (${funnelMetrics.noShowCount}/${funnelMetrics.totalBooked})`,
      });
    } else if (funnelMetrics.noShowRate > 20) {
      anomalies.push({
        id: "elevated-no-show-rate",
        severity: "warning",
        message: `No-show rate elevated at ${funnelMetrics.noShowRate.toFixed(1)}% (${funnelMetrics.noShowCount}/${funnelMetrics.totalBooked})`,
      });
    }

    // Low nurture conversion
    if (funnelMetrics.nurtureConversionRate < 15 && funnelMetrics.nurturedLeads > 10) {
      anomalies.push({
        id: "low-nurture-conversion",
        severity: "warning",
        message: `Only ${funnelMetrics.nurtureConversionRate.toFixed(1)}% of nurtured leads converted to booking`,
      });
    }

    // High score downgrades
    const downgrades = funnelMetrics.scoreMovements.hotToCold + 
                      funnelMetrics.scoreMovements.hotToWarm + 
                      funnelMetrics.scoreMovements.warmToCold;
    const upgrades = funnelMetrics.scoreMovements.coldToWarm + 
                    funnelMetrics.scoreMovements.coldToHot + 
                    funnelMetrics.scoreMovements.warmToHot;
    
    if (downgrades > upgrades && funnelMetrics.totalScoreChanges > 10) {
      anomalies.push({
        id: "high-score-downgrades",
        severity: "warning",
        message: `${downgrades} score downgrades vs ${upgrades} upgrades in period`,
      });
    }

    return res.json({
      ok: true,
      period: {
        from: from.toISOString(),
        to: now.toISOString(),
        days,
        mode: "snapshot_by_stage",
      },
      newLeadsInPeriod,
      stages,
      metrics: {
        nurtureConversionRate: funnelMetrics.nurtureConversionRate,
        nurturedLeads: funnelMetrics.nurturedLeads,
        nurturedThenBooked: funnelMetrics.nurturedThenBooked,
        touchpointBreakdown: funnelMetrics.touchpointBreakdown,
        touchpointPercentages: funnelMetrics.touchpointPercentages,
        totalTouchpointBookings: funnelMetrics.totalTouchpointBookings,
        noShowRate: funnelMetrics.noShowRate,
        totalBooked: funnelMetrics.totalBooked,
        noShowCount: funnelMetrics.noShowCount,
        scoreMovements: funnelMetrics.scoreMovements,
        avgLeadsPerDay: Math.round(avgLeadsPerDay * 10) / 10,
      },
      anomalies,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/pipeline-stats", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where = tenantId ? { tenantId } : {};
    const activityWhere = {
      createdAt: { gte: weekAgo },
      action: { equals: "no_show", mode: "insensitive" as const },
      ...(tenantId ? { lead: { tenantId } } : {}),
    };

    const reactivatedActivityWhere = {
      createdAt: { gte: weekAgo },
      action: { equals: "reactivated", mode: "insensitive" as const },
      ...(tenantId ? { lead: { tenantId } } : {}),
    };

    const [
      totalLeads,
      newThisWeek,
      byStage,
      followUpsSent,
      hotLeads,
      warmLeads,
      coldLeads,
      scoreAgg,
      noShowsThisWeek,
      reactivatedThisWeek,
      hbPings24h,
      hbErrors24h,
      latestHb,
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
      prisma.lead.groupBy({ by: ["pipelineStage"], where, _count: true }),
      prisma.followUpQueue.count({ where: { status: "sent", sentAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { ...where, leadScore: { gte: 7 } } }),
      prisma.lead.count({ where: { ...where, leadScore: { gte: 4, lt: 7 } } }),
      prisma.lead.count({ where: { ...where, leadScore: { lt: 4 } } }),
      prisma.lead.aggregate({
        where: { ...where, leadScore: { not: null } },
        _avg: { leadScore: true },
      }),
      prisma.activityLog.count({ where: activityWhere }),
      prisma.activityLog.count({ where: reactivatedActivityWhere }),
      prisma.workflowHeartbeat.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.workflowHeartbeat.count({ where: { createdAt: { gte: dayAgo }, status: "error" } }),
      prisma.workflowHeartbeat.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    const avg = scoreAgg._avg.leadScore;
    const averageLeadScore = avg === null || avg === undefined ? null : Math.round(avg * 10) / 10;

    return res.json({
      ok: true,
      period: { from: weekAgo.toISOString(), to: now.toISOString() },
      stats: {
        totalLeads,
        newThisWeek,
        followUpsSentThisWeek: followUpsSent,
        byScore: { hot: hotLeads, warm: warmLeads, cold: coldLeads },
        byStage: Object.fromEntries(byStage.map((s: (typeof byStage)[number]) => [s.pipelineStage, s._count])),
        averageLeadScore,
        noShowsThisWeek,
        reactivatedThisWeek,
        workflowHealth: {
          lastPingAt: latestHb?.createdAt.toISOString() ?? null,
          lastWorkflowKey: latestHb?.workflowKey ?? null,
          lastStatus: latestHb?.status ?? null,
          pings24h: hbPings24h,
          errors24h: hbErrors24h,
        },
      },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Rolling-window attribution & funnel stats (dashboard analytics section). */
router.get("/analytics/attribution", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const tenantWhere = tenantId ? { tenantId } : {};
    const tenantSql =
      tenantId != null && tenantId !== ""
        ? Prisma.sql`AND l."tenant_id" = ${tenantId}`
        : Prisma.empty;

    const [byChannel, byScore, topSources, leadsPerDay, bookingRows, totalNew, unscored] = await Promise.all([
      prisma.lead.groupBy({
        by: ["channel"],
        where: { createdAt: { gte: from, lte: to }, ...tenantWhere },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["leadScore"],
        where: { createdAt: { gte: from, lte: to }, leadScore: { not: null }, ...tenantWhere },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { createdAt: { gte: from, lte: to }, source: { not: null }, ...tenantWhere },
        _count: { _all: true },
        orderBy: { _count: { source: "desc" } },
        take: 14,
      }),
      prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
        SELECT date_trunc('day', l."createdAt")::date AS d, COUNT(*)::bigint AS c
        FROM "Lead" l
        WHERE l."createdAt" >= ${from} AND l."createdAt" <= ${to}
        ${tenantSql}
        GROUP BY 1 ORDER BY 1 ASC
      `,
      prisma.$queryRaw<Array<{ channel: string; new_leads: bigint; booked_like: bigint }>>`
        SELECT l."channel" AS channel,
          COUNT(*)::bigint AS new_leads,
          SUM(CASE WHEN l."pipeline_stage" IN ('audit_booked', 'client') THEN 1 ELSE 0 END)::bigint AS booked_like
        FROM "Lead" l
        WHERE l."createdAt" >= ${from} AND l."createdAt" <= ${to}
        ${tenantSql}
        GROUP BY l."channel" ORDER BY new_leads DESC
      `,
      prisma.lead.count({ where: { createdAt: { gte: from, lte: to }, ...tenantWhere } }),
      prisma.lead.count({
        where: { createdAt: { gte: from, lte: to }, leadScore: null, ...tenantWhere },
      }),
    ]);

    const scoreMap = new Map<number, number>();
    for (const row of byScore) {
      if (row.leadScore != null) scoreMap.set(row.leadScore, row._count._all);
    }
    const scoreHistogram = Array.from({ length: 10 }, (_, i) => ({
      score: i + 1,
      count: scoreMap.get(i + 1) ?? 0,
    }));

    return res.json({
      ok: true,
      period: { from: from.toISOString(), to: to.toISOString(), days },
      totalNewLeads: totalNew,
      unscoredCount: unscored,
      leadsByChannel: (byChannel as Array<{ channel: string; _count: { _all: number } }>).map((x) => ({
        label: x.channel,
        count: x._count._all,
      })),
      topUtmSources: (topSources as Array<{ source: string | null; _count: { _all: number } }>).map((x) => ({
        source: x.source ?? "",
        count: x._count._all,
      })),
      leadsPerDay: leadsPerDay.map((r) => ({
        date: r.d.toISOString().slice(0, 10),
        count: Number(r.c),
      })),
      scoreHistogram,
      bookingRateByChannel: bookingRows.map((r) => {
        const n = Number(r.new_leads);
        const b = Number(r.booked_like);
        return {
          channel: r.channel,
          newLeads: n,
          bookedLike: b,
          rate: n > 0 ? b / n : 0,
        };
      }),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const WeeklyReportUpsertSchema = z.object({
  weekStart: z.string().datetime(),
  weekEnd: z.string().datetime(),
  metrics: z.record(z.string(), z.unknown()),
  commentary: z.string().optional(),
});

/** n8n S10 (or cron) — persist a weekly digest for dashboard history + WoW charts. */
router.post("/weekly-reports", async (req, res) => {
  try {
    if (!internalSecretOk(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const tenantId = getTenantId(req.headers as Record<string, unknown>) ?? "";
    const body = WeeklyReportUpsertSchema.parse(req.body ?? {});
    const weekStart = new Date(body.weekStart);
    const weekEnd = new Date(body.weekEnd);

    const row = await prisma.weeklyReportSnapshot.upsert({
      where: {
        weekStart_tenantId: { weekStart, tenantId },
      },
      create: {
        weekStart,
        weekEnd,
        metrics: body.metrics as object,
        commentary: body.commentary ?? null,
        tenantId,
      },
      update: {
        weekEnd,
        metrics: body.metrics as object,
        commentary: body.commentary ?? null,
      },
    });

    return res.status(200).json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Dashboard — list saved weeks (newest first) for Weekly Report module + trend APIs. */
router.get("/weekly-reports", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>) ?? "";
    const limit = Math.min(Math.max(Number(req.query.limit ?? 52), 1), 104);

    const items = await prisma.weeklyReportSnapshot.findMany({
      where: { tenantId },
      orderBy: { weekStart: "desc" },
      take: limit,
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        metrics: true,
        commentary: true,
        createdAt: true,
      },
    });

    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

const HeartbeatSchema = z.object({
  workflowKey: z.string().min(1),
  status: z.enum(["ok", "error"]),
  message: z.string().optional(),
});

/**
 * Calculate advanced funnel metrics for anomaly detection
 */
async function calculateFunnelMetrics(tenantId: string | null, days: number) {
  const now = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const tenantWhere = tenantId ? { tenantId } : {};

  // 1. % of leads booked after going through nurture
  // Count leads that went through nurture stage (via activity log)
  const leadsWhoWentThroughNurture = await prisma.activityLog.findMany({
    where: {
      createdAt: { gte: from, lte: now },
      action: "stage_change",
      ...(tenantId ? { lead: { tenantId } } : {}),
    },
    select: {
      leadId: true,
      payload: true,
      lead: {
        select: {
          pipelineStage: true,
        },
      },
    },
  });

  // Filter to only those where toStage was "nurture"
  const nurturedLeadIds = new Set(
    leadsWhoWentThroughNurture
      .filter((log) => {
        const payload = log.payload as any;
        return payload?.toStage === "nurture";
      })
      .map((log) => log.leadId)
  );

  const nurturedLeads = nurturedLeadIds.size;

  // Count how many of those are now booked
  const nurturedThenBooked = leadsWhoWentThroughNurture
    .filter((log) => {
      const payload = log.payload as any;
      const isNurtureStage = payload?.toStage === "nurture";
      const isBooked = ["booked", "audit_booked", "client", "closed"].includes(log.lead.pipelineStage);
      return isNurtureStage && isBooked;
    })
    .length;

  // Touchpoint analysis: At which touch did the booking happen?
  const touchpointBookings = await prisma.$queryRaw<
    Array<{ touchIndex: number; count: bigint }>
  >`
    SELECT 
      COALESCE((al."payload"->>'touchIndex')::int, 0) AS "touchIndex",
      COUNT(*)::bigint AS count
    FROM "ActivityLog" al
    JOIN "Lead" l ON l."id" = al."lead_id"
    WHERE al."action" = 'booked_after_nurture'
      AND al."created_at" >= ${from}
      AND al."created_at" <= ${now}
      ${tenantId ? Prisma.sql`AND l."tenant_id" = ${tenantId}` : Prisma.empty}
    GROUP BY "touchIndex"
    ORDER BY "touchIndex" ASC
  `;

  const touchpointBreakdown: Record<string, number> = {};
  let totalTouchpointBookings = 0;
  
  for (const tp of touchpointBookings) {
    const touchNum = Number(tp.touchIndex);
    const count = Number(tp.count);
    touchpointBreakdown[`touch${touchNum}`] = count;
    totalTouchpointBookings += count;
  }

  // Calculate percentages
  const touchpointPercentages: Record<string, number> = {};
  for (const [key, count] of Object.entries(touchpointBreakdown)) {
    touchpointPercentages[key] = totalTouchpointBookings > 0 
      ? (count / totalTouchpointBookings) * 100 
      : 0;
  }

  // 2. % of bookings that resulted in no-show
  const [totalBooked, noShowCount] = await Promise.all([
    prisma.lead.count({
      where: {
        ...tenantWhere,
        createdAt: { gte: from, lte: now },
        pipelineStage: { in: ["booked", "audit_booked", "no_show", "client", "closed"] },
      },
    }),
    prisma.lead.count({
      where: {
        ...tenantWhere,
        createdAt: { gte: from, lte: now },
        pipelineStage: "no_show",
      },
    }),
  ]);

  // 3. Score category movements
  const scoreChanges = await prisma.$queryRaw<
    Array<{ leadId: string; oldScore: number | null; newScore: number | null; changedAt: Date }>
  >`
    SELECT 
      al."lead_id" AS "leadId",
      (al."payload"->>'oldScore')::int AS "oldScore",
      (al."payload"->>'newScore')::int AS "newScore",
      al."created_at" AS "changedAt"
    FROM "ActivityLog" al
    JOIN "Lead" l ON l."id" = al."lead_id"
    WHERE al."action" = 'score_change'
      AND al."created_at" >= ${from}
      AND al."created_at" <= ${now}
      ${tenantId ? Prisma.sql`AND l."tenant_id" = ${tenantId}` : Prisma.empty}
    ORDER BY al."created_at" DESC
  `;

  const scoreMovements = {
    coldToWarm: 0,
    coldToHot: 0,
    warmToHot: 0,
    warmToCold: 0,
    hotToCold: 0,
    hotToWarm: 0,
  };

  for (const change of scoreChanges) {
    const old = change.oldScore;
    const newScore = change.newScore;
    if (old === null || newScore === null) continue;

    const oldCategory = old >= 7 ? "hot" : old >= 4 ? "warm" : "cold";
    const newCategory = newScore >= 7 ? "hot" : newScore >= 4 ? "warm" : "cold";

    if (oldCategory === "cold" && newCategory === "warm") scoreMovements.coldToWarm++;
    if (oldCategory === "cold" && newCategory === "hot") scoreMovements.coldToHot++;
    if (oldCategory === "warm" && newCategory === "hot") scoreMovements.warmToHot++;
    if (oldCategory === "warm" && newCategory === "cold") scoreMovements.warmToCold++;
    if (oldCategory === "hot" && newCategory === "cold") scoreMovements.hotToCold++;
    if (oldCategory === "hot" && newCategory === "warm") scoreMovements.hotToWarm++;
  }

  return {
    nurtureConversionRate: nurturedLeads > 0 ? (nurturedThenBooked / nurturedLeads) * 100 : 0,
    nurturedLeads,
    nurturedThenBooked,
    touchpointBreakdown,
    touchpointPercentages,
    totalTouchpointBookings,
    noShowRate: totalBooked > 0 ? (noShowCount / totalBooked) * 100 : 0,
    totalBooked,
    noShowCount,
    scoreMovements,
    totalScoreChanges: scoreChanges.length,
  };
}

/** Latest pings for Command Centre / technician visibility (read-only). */
router.get("/workflow-heartbeats", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
    
    const allItems = await prisma.workflowHeartbeat.findMany({
      orderBy: { createdAt: "desc" },
      take: limit * 3, // Fetch more to account for deduplication
      select: {
        id: true,
        workflowKey: true,
        status: true,
        message: true,
        createdAt: true,
      },
    });

    // Deduplicate consecutive pings ONLY from S4B (cron-based workflow)
    const deduped: (typeof allItems) = [];
    let lastWorkflowKey: string | null = null;
    let lastStatus: string | null = null;
    let lastMessage: string | null = null;
    let count = 1;

    for (const item of allItems) {
      // Only deduplicate S4B workflow (cron task for processing due leads)
      const shouldDedupe = item.workflowKey.toLowerCase().includes('s4b');
      
      if (
        shouldDedupe &&
        item.workflowKey === lastWorkflowKey &&
        item.status === lastStatus &&
        item.message === lastMessage
      ) {
        count++;
        // Skip consecutive duplicates, but keep track of count
        continue;
      }

      // If we skipped any, add count indicator to the previous item
      if (count > 1 && deduped.length > 0 && shouldDedupe) {
        deduped[deduped.length - 1].message = 
          `${deduped[deduped.length - 1].message || ""}${deduped[deduped.length - 1].message ? " " : ""}(×${count})`;
      }

      deduped.push(item);
      lastWorkflowKey = item.workflowKey;
      lastStatus = item.status;
      lastMessage = item.message;
      count = 1;

      if (deduped.length >= limit) break;
    }

    // Add count to last item if needed
    if (count > 1 && deduped.length > 0 && lastWorkflowKey?.toLowerCase().includes('s4b')) {
      deduped[deduped.length - 1].message = 
        `${deduped[deduped.length - 1].message || ""}${deduped[deduped.length - 1].message ? " " : ""}(×${count})`;
    }

    return res.json({ ok: true, items: deduped.slice(0, limit) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Optional n8n terminal node — success ping or error capture for technician / external alerting. */
router.post("/workflow-heartbeat", async (req, res) => {
  try {
    if (!internalSecretOk(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const body = HeartbeatSchema.parse(req.body ?? {});
    const row = await prisma.workflowHeartbeat.create({
      data: {
        workflowKey: body.workflowKey,
        status: body.status,
        message: body.message ?? null,
      },
    });
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Unwrap n8n-shaped payloads and fix common mistakes (literal "=value" strings, "[object Object]" details). */
function stripLeadingExpressionMarkers(value: string): string {
  let s = value.trim();
  while (s.startsWith("=")) s = s.slice(1).trim();
  return s;
}

function normalizeWorkflowEventBody(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    const t = stripLeadingExpressionMarkers(raw);
    if (!t) return {};
    try {
      return normalizeWorkflowEventBody(JSON.parse(t));
    } catch {
      return {};
    }
  }
  if (raw === null || raw === undefined) return {};
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return normalizeWorkflowEventBody(first);
    }
    return {};
  }
  if (typeof raw !== "object") return {};
  const o = { ...(raw as Record<string, unknown>) };

  if (typeof o.json === "object" && o.json !== null && !Array.isArray(o.json)) {
    Object.assign(o, o.json as Record<string, unknown>);
  }
  if (typeof o.body === "string") {
    const inner = stripLeadingExpressionMarkers(o.body);
    if (inner) {
      try {
        const parsed = JSON.parse(inner) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.assign(o, parsed as Record<string, unknown>);
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (typeof o.body === "object" && o.body !== null && !Array.isArray(o.body)) {
    Object.assign(o, o.body as Record<string, unknown>);
  }
  if (typeof o.data === "object" && o.data !== null && !Array.isArray(o.data)) {
    Object.assign(o, o.data as Record<string, unknown>);
  }

  if (o.status === undefined && typeof o.Status === "string") {
    o.status = o.Status;
    delete o.Status;
  }

  if (o.workflowName === undefined && typeof o.workflow === "object" && o.workflow !== null) {
    const w = o.workflow as Record<string, unknown>;
    if (typeof w.name === "string") o.workflowName = w.name;
    if (typeof w.id === "string" && o.workflowKey === undefined) o.workflowKey = w.id;
  }

  if (o.errorMessage === undefined && typeof o.error === "object" && o.error !== null) {
    const e = o.error as Record<string, unknown>;
    if (typeof e.message === "string") o.errorMessage = e.message;
  }

  for (const key of ["status", "workflowName", "workflowKey", "errorMessage", "executionId"] as const) {
    const v = o[key];
    if (typeof v === "string") {
      const s = stripLeadingExpressionMarkers(v);
      if (s === "") delete o[key];
      else o[key] = s;
    }
  }

  if (o.details !== undefined) {
    if (typeof o.details === "string") {
      const d = stripLeadingExpressionMarkers(o.details);
      if (d === "" || d === "[object Object]" || d.toLowerCase() === "=[object object]") {
        delete o.details;
      } else {
        try {
          const parsed = JSON.parse(d) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            o.details = parsed as Record<string, unknown>;
          } else delete o.details;
        } catch {
          delete o.details;
        }
      }
    } else if (typeof o.details === "object" && o.details !== null && !Array.isArray(o.details)) {
      o.details = { ...(o.details as Record<string, unknown>) };
    } else {
      delete o.details;
    }
  }

  if (o.status === undefined) {
    if (typeof o.errorMessage === "string" && o.errorMessage.length > 0) {
      o.status = "error";
    }
  } else if (typeof o.status === "string") {
    const s = o.status.trim().toLowerCase();
    if (s === "failed" || s === "failure") o.status = "error";
    else if (s === "success") o.status = "ok";
  }

  return o;
}

/** n8n Error Trigger or unified reporter: one row per event (success or error), richer than bare heartbeat. */
const WorkflowEventSchema = z
  .object({
    status: z.enum(["ok", "error"]),
    workflowKey: z.string().min(1).optional(),
    workflowName: z.string().optional(),
    errorMessage: z.string().optional(),
    executionId: z.string().optional(),
    durationMs: z.number().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => !!(b.workflowKey?.trim() || b.workflowName?.trim()), {
    message: "workflowKey or workflowName required",
  });

async function persistWorkflowEventPayload(body: z.infer<typeof WorkflowEventSchema>) {
  const key = (body.workflowKey ?? body.workflowName ?? "unknown").trim();
  const parts = [
    body.errorMessage,
    body.executionId ? `exec:${body.executionId}` : null,
    body.durationMs != null ? `${body.durationMs}ms` : null,
    body.details && Object.keys(body.details).length > 0 ? JSON.stringify(body.details) : null,
  ].filter((x): x is string => !!x);
  return prisma.workflowHeartbeat.create({
    data: {
      workflowKey: key,
      status: body.status,
      message: parts.length > 0 ? parts.join(" | ") : null,
    },
  });
}

/**
 * Same as POST /workflow-events but via query string — supports n8n HTTP Request nodes configured as GET.
 * Required query: status=ok|error and workflowKey or workflowName. Optional: errorMessage, executionId, durationMs.
 */
router.get("/workflow-events", async (req, res) => {
  try {
    if (!internalSecretOk(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    let details: Record<string, unknown> | undefined;
    if (typeof req.query.details === "string" && req.query.details.length > 0) {
      try {
        details = JSON.parse(req.query.details) as Record<string, unknown>;
      } catch {
        return res.status(400).json({ ok: false, error: "Invalid JSON in details query param" });
      }
    }
    const raw = {
      status: req.query.status,
      workflowKey: req.query.workflowKey,
      workflowName: req.query.workflowName,
      errorMessage: req.query.errorMessage,
      executionId: req.query.executionId,
      durationMs:
        typeof req.query.durationMs === "string" && req.query.durationMs.length > 0
          ? Number(req.query.durationMs)
          : undefined,
      details,
    };
    const body = WorkflowEventSchema.parse(raw);
    const row = await persistWorkflowEventPayload(body);
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : err instanceof Error
          ? err.message
          : "Failed";
    return res.status(400).json({
      ok: false,
      error: msg,
      hint: "Use ?status=error&workflowName=MyWorkflow&errorMessage=... or POST JSON to this path.",
    });
  }
});

router.post("/workflow-events", async (req, res) => {
  try {
    if (!internalSecretOk(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const normalized = normalizeWorkflowEventBody(req.body ?? {});
    if (Object.keys(normalized).length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Empty or missing JSON body",
        hint: 'Empty body often means n8n did not send JSON. Fix: (1) Body → JSON, use a single expression for the whole body: ={{ JSON.stringify({ status: $json.status, workflowName: $json.workflowName, errorMessage: $json.errorMessage, executionId: $json.executionId, details: $json.details }) }}. (2) Do not wrap expressions as "={{ }}" inside quoted JSON — that produces "=value" strings. (3) For details object, never use a string template on a bare object — use JSON.stringify in a Code node or the expression above.',
      });
    }
    const body = WorkflowEventSchema.parse(normalized);
    const row = await persistWorkflowEventPayload(body);
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : err instanceof Error
          ? err.message
          : "Failed";
    return res.status(400).json({
      ok: false,
      error: msg,
      hint: "Required: status (ok|error) and workflowKey or workflowName — or send errorMessage to default status to error. Unwrap: nested json/body and n8n workflow/error objects are accepted.",
    });
  }
});

export { router as automationRouter };
