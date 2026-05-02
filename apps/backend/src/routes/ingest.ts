/**
 * POST /api/v1/ingest
 * Multi-Channel Capture & Normalization (Section 3A).
 * - Normalizes payloads from FB/IG, Web, WhatsApp, LinkedIn into a single Lead schema.
 * - Deduplication: if Lead exists by Email OR Phone, update Last_Contact_Date and append Source.
 */

import { Router } from "express";
import { z } from "zod";
import { normalize, type IngestSource, NormalizedLeadSchema } from "../lib/normalize.js";
import { ingestLead } from "../lib/ingestCore.js";

const router = Router();

const IngestBodySchema = z.object({
  _source: z.enum(["facebook", "web", "whatsapp", "linkedin"]).optional(),
  _channel: z.enum(["facebook", "web", "whatsapp", "linkedin"]).optional(),
}).catchall(z.unknown());

function mapToIngestSource(val: string): IngestSource | null {
  const v = val.toLowerCase();
  if (v.includes("linkedin")) return "linkedin";
  if (v.includes("facebook") || v.includes("fb") || v.includes("instagram") || v.includes("ig")) return "facebook";
  if (v.includes("whatsapp") || v.includes("wa")) return "whatsapp";
  if (v === "web" || v.includes("website") || v.includes("organic") || v.includes("google")) return "web";
  return null;
}

function detectSource(body: unknown): IngestSource {
  const b = body as Record<string, unknown>;
  if (b._source && typeof b._source === "string") return b._source as IngestSource;
  if (b._channel && typeof b._channel === "string") return b._channel as IngestSource;
  for (const field of ["source", "marketingSource", "ingestSource"]) {
    if (b[field] && typeof b[field] === "string") {
      const mapped = mapToIngestSource(b[field] as string);
      if (mapped) return mapped;
    }
  }
  if (b.contacts && Array.isArray(b.contacts)) return "whatsapp";
  if (b.messages && Array.isArray(b.messages)) return "whatsapp";
  if (b.wa_id != null) return "whatsapp";
  if (b.full_name != null && b.phone_number != null) return "facebook";
  if (b.firstName != null && b.lastName != null && b.phoneNumber != null) return "linkedin";
  return "web";
}

router.post("/ingest", async (req, res) => {
  try {
    const raw = req.body as Record<string, unknown>;
    IngestBodySchema.parse(raw);
    const source: IngestSource = (raw._source as IngestSource) ?? (raw._channel as IngestSource) ?? detectSource(req.body);

    const normalized = normalize(req.body, source);
    NormalizedLeadSchema.parse(normalized);

    const tenantId = (req.headers["x-tenant-id"] as string) ?? null;
    const result = await ingestLead(normalized, tenantId, source);

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
    console.error("Ingest error:", err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Ingest failed",
    });
  }
});

export { router as ingestRouter };
