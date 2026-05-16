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

// Dashboard / CRM-style list (paginated)
router.get("/leads", async (req, res) => {
  try {
    const tenantId = getTenantId(req.headers as Record<string, unknown>);
    const stage = typeof req.query.stage === "string" && req.query.stage.length > 0 ? req.query.stage : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          ...(stage ? { pipelineStage: stage } : {}),
        },
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
      prisma.lead.count({
        where: {
          ...(tenantId ? { tenantId } : {}),
          ...(stage ? { pipelineStage: stage } : {}),
        },
      }),
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

    const [byStage, newLeadsInPeriod] = await Promise.all([
      prisma.lead.groupBy({
        by: ["pipelineStage"],
        where: whereBase,
        _count: true,
      }),
      prisma.lead.count({
        where: { ...whereBase, createdAt: { gte: from } },
      }),
    ]);

    const stages = byStage
      .map((s: (typeof byStage)[number]) => ({
        stage: s.pipelineStage,
        count: s._count,
      }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      ok: true,
      draft: true,
      note: "Snapshot by pipeline_stage. Official buckets, branches (booked vs nurture), and anomaly rules will be set with product — this shape stays stable for the UI.",
      period: {
        from: from.toISOString(),
        to: now.toISOString(),
        days,
        mode: "snapshot_by_stage",
      },
      newLeadsInPeriod,
      stages,
      anomalies: [] as Array<{ id: string; severity: "warning" | "critical"; message: string }>,
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

function internalSecretOk(req: { headers: Record<string, unknown> }): boolean {
  const expected = process.env.INTERNAL_AUTOMATION_SECRET;
  if (!expected || expected.length === 0) return true;
  const got = req.headers["x-internal-secret"];
  return typeof got === "string" && got === expected;
}

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

/** Latest pings for Command Centre / technician visibility (read-only). */
router.get("/workflow-heartbeats", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
    const items = await prisma.workflowHeartbeat.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        workflowKey: true,
        status: true,
        message: true,
        createdAt: true,
      },
    });
    return res.json({ ok: true, items });
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

router.post("/workflow-events", async (req, res) => {
  try {
    if (!internalSecretOk(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const body = WorkflowEventSchema.parse(req.body ?? {});
    const key = (body.workflowKey ?? body.workflowName ?? "unknown").trim();
    const parts = [
      body.errorMessage,
      body.executionId ? `exec:${body.executionId}` : null,
      body.durationMs != null ? `${body.durationMs}ms` : null,
      body.details && Object.keys(body.details).length > 0 ? JSON.stringify(body.details) : null,
    ].filter((x): x is string => !!x);
    const row = await prisma.workflowHeartbeat.create({
      data: {
        workflowKey: key,
        status: body.status,
        message: parts.length > 0 ? parts.join(" | ") : null,
      },
    });
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Failed" });
  }
});

export { router as automationRouter };
