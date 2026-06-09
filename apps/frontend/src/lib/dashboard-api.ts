import { backendBaseUrl } from "./backend";

export async function getJson<T>(path: string, revalidateSeconds = 15): Promise<T> {
  const base = backendBaseUrl();
  const res = await fetch(`${base}${path}`, {
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getJsonNoStore<T>(path: string): Promise<T> {
  const base = backendBaseUrl();
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
