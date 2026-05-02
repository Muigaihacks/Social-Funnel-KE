import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";

const router = Router();

function getTenantId(headers: Record<string, unknown>): string | null {
  const raw = headers["x-tenant-id"];
  return typeof raw === "string" ? raw : null;
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
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
      items: logs.map((l) => ({
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const items = await prisma.followUpQueue.findMany({
      where: {
        leadId: lead.id,
        ...(statusQ !== "all" ? { status: statusQ } : {}),
      },
      orderBy: { touchIndex: "asc" },
    });

    const pending = items.filter((i) => i.status === "pending").length;

    return res.json({
      ok: true,
      leadId: lead.id,
      summary: {
        total: items.length,
        pending,
        byStatus: {
          pending: items.filter((i) => i.status === "pending").length,
          sent: items.filter((i) => i.status === "sent").length,
          skipped: items.filter((i) => i.status === "skipped").length,
          aborted: items.filter((i) => i.status === "aborted").length,
        },
      },
      items: items.map((q) => ({
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
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const now = new Date();
    const limit = Math.min(Number(req.query.limit ?? 200), 1000);

    const due = await prisma.followUpQueue.findMany({
      where: {
        status: "pending",
        scheduledFor: { lte: now },
        lead: {
          ...(tenantId ? { tenantId } : {}),
          pipelineStage: { notIn: ["audit_booked", "client", "dead"] },
        },
      },
      include: { lead: true },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    return res.json({
      ok: true,
      items: due.map((q) => ({
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
    } else {
      await prisma.activityLog.create({
        data: {
          leadId: lead.id,
          action: body.eventType === "no_show" ? "no_show" : "booking_canceled",
          payload: { eventId: body.eventId, startsAt: body.startsAt },
        },
      });
    }

    return res.json({ ok: true, leadId: lead.id });
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

    const lead = await prisma.lead.findFirst({
      where: { email, ...(tenantId ? { tenantId } : {}) },
      orderBy: { updatedAt: "desc" },
    });
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
      recentMessages: recentMessages.map((m) => ({
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    if (resumeAfterDays > 0) {
      const now = new Date();
      const pending = await prisma.followUpQueue.findMany({
        where: { leadId: lead.id, status: "pending" },
        orderBy: { scheduledFor: "asc" },
      });
      const baseDelay = resumeAfterDays * 24 * 60 * 60 * 1000;
      await prisma.$transaction(
        pending.map((fq, idx) =>
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

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });

    const data: Record<string, unknown> = {};
    if (body.score !== undefined) data.leadScore = body.score;
    if (body.reason) data.scoreReason = body.reason;
    if (body.pipelineStage) {
      data.pipelineStage = body.pipelineStage;
      await prisma.stageTransition.create({
        data: { leadId: lead.id, fromStage: lead.pipelineStage, toStage: body.pipelineStage },
      });
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

router.get("/pipeline-stats", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = tenantId ? { tenantId } : {};

    const [totalLeads, newThisWeek, byStage, followUpsSent, hotLeads, warmLeads, coldLeads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
      prisma.lead.groupBy({ by: ["pipelineStage"], where, _count: true }),
      prisma.followUpQueue.count({ where: { status: "sent", sentAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { ...where, leadScore: { gte: 7 } } }),
      prisma.lead.count({ where: { ...where, leadScore: { gte: 4, lt: 7 } } }),
      prisma.lead.count({ where: { ...where, leadScore: { lt: 4 } } }),
    ]);

    return res.json({
      ok: true,
      period: { from: weekAgo.toISOString(), to: now.toISOString() },
      stats: {
        totalLeads,
        newThisWeek,
        followUpsSentThisWeek: followUpsSent,
        byScore: { hot: hotLeads, warm: warmLeads, cold: coldLeads },
        byStage: Object.fromEntries(byStage.map((s) => [s.pipelineStage, s._count])),
      },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

export { router as automationRouter };
