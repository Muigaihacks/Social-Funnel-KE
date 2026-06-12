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

export async function markFollowUpAction(formData: FormData) {
  const id = String(formData.get("followUpId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !["sent", "skipped", "aborted"].includes(status)) {
    throw new Error("Invalid follow-up action");
  }

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/followups/${encodeURIComponent(id)}/mark`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );

  if (!res.ok) throw new Error(await readApiError(res));
  revalidatePath("/follow-ups");
}

export async function bumpFollowUpAction(formData: FormData) {
  const id = String(formData.get("followUpId") ?? "").trim();
  if (!id) throw new Error("Missing follow-up id");

  const res = await fetch(
    `${backendBaseUrl()}/api/v1/automation/followups/${encodeURIComponent(id)}/bump`,
    { method: "POST" }
  );

  if (!res.ok) throw new Error(await readApiError(res));
  revalidatePath("/follow-ups");
}
