"use server";

import { revalidatePath } from "next/cache";
import { backendBaseUrl } from "@/lib/backend";
import { PIPELINE_STAGES, type PipelineStageOption } from "@/lib/pipeline-stages";

export type LeadFormState = { ok: boolean; error?: string } | null;

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? (text || `HTTP ${res.status}`);
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export async function addLeadNoteAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!leadId) return { ok: false, error: "Missing lead" };
  if (!text) return { ok: false, error: "Note cannot be empty" };

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/leads/${encodeURIComponent(leadId)}/notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );

  if (!res.ok) {
    return { ok: false, error: await readApiError(res) };
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function terminateLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) return { ok: false, error: "Missing lead" };

  const reason = String(formData.get("reason") ?? "").trim();

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/leads/${encodeURIComponent(leadId)}/terminate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );

  if (!res.ok) {
    return { ok: false, error: await readApiError(res) };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/follow-ups");
  revalidatePath("/bookings");
  return { ok: true };
}

export async function updateLeadPriorityAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) return { ok: false, error: "Missing lead" };

  const pipelineStage = String(formData.get("pipelineStage") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const scoreRaw = String(formData.get("score") ?? "").trim();

  const body: Record<string, unknown> = {};
  if (pipelineStage) {
    if (!PIPELINE_STAGES.includes(pipelineStage as PipelineStageOption)) {
      return { ok: false, error: "Invalid pipeline stage" };
    }
    body.pipelineStage = pipelineStage;
  }
  if (reason) body.reason = reason;
  if (scoreRaw !== "") {
    const n = Number(scoreRaw);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      return { ok: false, error: "Score must be a whole number from 1 to 10 (or leave blank)" };
    }
    body.score = n;
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, error: "Change stage, set a score, or add a score reason" };
  }

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/leads/${encodeURIComponent(leadId)}/update-priority`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    return { ok: false, error: await readApiError(res) };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/follow-ups");
  revalidatePath("/bookings");
  return { ok: true };
}
