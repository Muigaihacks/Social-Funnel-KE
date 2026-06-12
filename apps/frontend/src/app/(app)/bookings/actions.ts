"use server";

import { revalidatePath } from "next/cache";
import { backendBaseUrl } from "@/lib/backend";

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? (text || `HTTP ${res.status}`);
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export async function markBookingNoShowAction(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!leadId) throw new Error("Missing lead");

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/leads/${encodeURIComponent(leadId)}/mark-no-show`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note ? { note } : {}),
    }
  );

  if (!res.ok) throw new Error(await readApiError(res));

  revalidatePath("/bookings");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/follow-ups");
}

export async function markBookingClosedAction(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!leadId) throw new Error("Missing lead");

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/leads/${encodeURIComponent(leadId)}/mark-closed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note ? { note } : {}),
    }
  );

  if (!res.ok) throw new Error(await readApiError(res));

  revalidatePath("/bookings");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/follow-ups");
}
