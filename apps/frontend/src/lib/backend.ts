/** Base URL for server-side fetch to the Acquisition OS API (no trailing slash). */
export function backendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  return raw.replace(/\/$/, "");
}
