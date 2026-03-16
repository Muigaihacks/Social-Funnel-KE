/**
 * Webhook endpoints for external platforms (Meta, LinkedIn, 360dialog, web form, Twilio).
 * These URLs are what we give to the Social Funnel contact to configure in each platform.
 * GET handlers implement verification so the platform accepts the URL; POST handlers
 * receive payloads, normalize, and call ingest (or log and 200 for now).
 *
 * Base path: /api/v1/webhooks
 * Full URLs: https://<BACKEND_BASE>/api/v1/webhooks/<path>
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/db.js";
import { ingestLead } from "../lib/ingestCore.js";
import {
  normalizeFacebookLeadForm,
  normalizeWebhook,
  normalizeWhatsApp,
  normalizeLinkedIn,
  NormalizedLeadSchema,
  type IngestSource,
} from "../lib/normalize.js";

const router = Router();

const tenantId = (req: Request) => (req.headers["x-tenant-id"] as string) ?? null;

// ----- Meta (Facebook & Instagram Lead Ads, optional: Messenger/Instagram DMs) -----
const META_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "acquisition-os-verify";

router.get("/meta-leadgen", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN && challenge) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Verification failed");
});

router.post("/meta-leadgen", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (body.object !== "page" || !Array.isArray(body.entry)) {
      return res.status(200).send("ok");
    }
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    for (const entry of body.entry as Array<{ id?: string; changes?: Array<{ field?: string; value?: { leadgen_id?: string } }> }>) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen" || !change.value?.leadgen_id) continue;
        const leadgenId = change.value.leadgen_id;
        if (pageAccessToken) {
          const url = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${encodeURIComponent(pageAccessToken)}`;
          const fetchRes = await fetch(url);
          const leadData = (await fetchRes.json()) as Record<string, unknown>;
          const fieldData = leadData.field_data as Array<{ name?: string; values?: string[] }> | undefined;
          const raw: Record<string, unknown> = {};
          for (const f of fieldData ?? []) {
            const key = (f.name ?? "").toLowerCase().replace(/\s+/g, "_");
            const val = f.values?.[0];
            if (key && val) raw[key] = val;
          }
          if (raw.phone_number || raw.phone) {
            const normalized = normalizeFacebookLeadForm(raw);
            NormalizedLeadSchema.parse(normalized);
            await ingestLead(normalized, tenantId(req), "facebook");
          }
        }
      }
    }
    return res.status(200).send("ok");
  } catch (err) {
    console.error("Meta webhook error:", err);
    return res.status(200).send("ok"); // 200 so Meta doesn't retry
  }
});

// ----- LinkedIn Lead Gen -----
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET ?? "";

router.get("/linkedin-leadgen", (req, res) => {
  const challengeCode = req.query.challengeCode as string | undefined;
  if (!challengeCode) return res.status(400).send("Missing challengeCode");
  const signature = crypto.createHmac("sha256", LINKEDIN_CLIENT_SECRET).update(challengeCode).digest("hex");
  return res.status(200).send(signature);
});

router.post("/linkedin-leadgen", async (req, res) => {
  try {
    const normalized = normalizeLinkedIn(req.body);
    NormalizedLeadSchema.parse(normalized);
    await ingestLead(normalized, tenantId(req), "linkedin");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("LinkedIn webhook error:", err);
    return res.status(200).json({ ok: true });
  }
});

// ----- 360dialog WhatsApp inbound -----
router.post("/whatsapp-inbound", async (req, res) => {
  try {
    const normalized = normalizeWhatsApp(req.body);
    NormalizedLeadSchema.parse(normalized);
    await ingestLead(normalized, tenantId(req), "whatsapp");
    return res.status(200).send("ok");
  } catch (err) {
    console.error("WhatsApp inbound webhook error:", err);
    return res.status(200).send("ok");
  }
});

// ----- Web form (generic) -----
router.post("/web-form", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const normalized = normalizeWebhook({ ...body, _channel: "web" });
    NormalizedLeadSchema.parse(normalized);
    const result = await ingestLead(normalized, tenantId(req), "web");
    return res.status(201).json({ ok: true, leadId: result.leadId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Validation failed", details: err.flatten() });
    }
    console.error("Web form webhook error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Ingest failed" });
  }
});

// ----- Meta Messenger / Instagram DMs (optional; same verify as leadgen, payload different) -----
router.get("/meta-messenger", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN && challenge) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Verification failed");
});

router.post("/meta-messenger", async (req, res) => {
  // Messenger/Instagram message payloads: we'd parse and ingest (e.g. by sender id → lookup or create lead). For now 200.
  return res.status(200).send("ok");
});

// ----- Twilio voice status (missed call) -----
const TwilioStatusSchema = z.object({
  CallSid: z.string().optional(),
  From: z.string(),
  To: z.string().optional(),
  CallStatus: z.string(), // no-answer, completed, busy, failed, etc.
});

router.post("/twilio-voice-status", async (req, res) => {
  try {
    const raw = TwilioStatusSchema.parse(req.body);
    if (!["no-answer", "busy", "failed", "completed"].includes(raw.CallStatus)) {
      return res.status(200).send("ok");
    }
    const phone = raw.From.replace(/\D/g, "");
    const e164 = phone.startsWith("254") ? `+${phone}` : `+254${phone.replace(/^0/, "")}`;
    const existing = await prisma.lead.findFirst({
      where: { phone: e164, ...(tenantId(req) ? { tenantId: tenantId(req) } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      await prisma.activityLog.create({
        data: {
          leadId: existing.id,
          action: "missed_call",
          payload: { from: raw.From, callStatus: raw.CallStatus },
        },
      });
    } else {
      const lead = await prisma.lead.create({
        data: {
          phone: e164,
          channel: "web", // schema has facebook|web|whatsapp|linkedin; missed-call stored in activity
          pipelineStage: "new",
          tenantId: tenantId(req),
        },
      });
      await prisma.activityLog.create({
        data: {
          leadId: lead.id,
          action: "missed_call",
          payload: { from: raw.From, callStatus: raw.CallStatus },
        },
      });
    }
    return res.status(200).send("ok");
  } catch (err) {
    console.error("Twilio webhook error:", err);
    return res.status(200).send("ok");
  }
});

export { router as webhooksRouter };
