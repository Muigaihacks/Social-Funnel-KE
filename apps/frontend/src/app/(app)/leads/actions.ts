"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backendBaseUrl } from "@/lib/backend";
import { CHANNELS } from "@/lib/lead-channels";

export type LeadFormState = { ok: boolean; error?: string; leadId?: string } | null;

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? (text || `HTTP ${res.status}`);
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export async function createLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { ok: false, error: "Phone is required" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const channel = String(formData.get("channel") ?? "web").trim();
  const source = String(formData.get("source") ?? "").trim();
  const leadType = String(formData.get("leadType") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const whatsappOptIn = formData.get("whatsappOptIn") === "on";

  if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) {
    return { ok: false, error: "Invalid channel" };
  }

  const body: Record<string, unknown> = {
    phone,
    channel,
    whatsappOptIn,
  };
  if (name) body.name = name;
  if (email) body.email = email;
  if (source) body.source = source;
  else body.source = "dashboard_manual";
  if (leadType) body.leadType = leadType;
  if (budget) body.budget = budget;
  if (timeline) body.timeline = timeline;
  if (notes) body.notes = notes;

  const res = await fetch(`${backendBaseUrl()}/api/v1/automation/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { ok: false, error: await readApiError(res) };
  }

  const data = (await res.json()) as { ok?: boolean; leadId?: string; deduplicated?: boolean };
  const leadId = data.leadId;
  if (!leadId) return { ok: false, error: "Lead created but no id returned" };

  revalidatePath("/leads");
  revalidatePath("/live-feed");
  revalidatePath(`/leads/${leadId}`);

  redirect(`/leads/${leadId}`);
}
