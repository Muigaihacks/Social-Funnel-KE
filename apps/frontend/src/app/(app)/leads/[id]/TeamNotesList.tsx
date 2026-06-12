import type { ReactNode } from "react";

function isNotePayload(p: unknown): p is { text?: string } {
  return typeof p === "object" && p !== null && "text" in p;
}

export function TeamNotesList({
  notes,
}: {
  notes: Array<{ id: string; createdAt: string; payload: unknown }>;
}): ReactNode {
  if (notes.length === 0) {
    return <p className="text-sm text-[var(--text-dim)]">No team notes yet.</p>;
  }
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
      {notes.map((n) => {
        const text = isNotePayload(n.payload) ? n.payload.text : null;
        return (
          <li key={n.id} className="rounded-lg border border-[var(--chart-grid)] bg-[var(--row-bg)] px-3 py-2">
            <span className="text-xs text-[var(--text-dim)]">
              {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(n.createdAt)
              )}
            </span>
            <p className="mt-1 text-[var(--text-soft)] leading-snug">{text ?? JSON.stringify(n.payload)}</p>
          </li>
        );
      })}
    </ul>
  );
}
