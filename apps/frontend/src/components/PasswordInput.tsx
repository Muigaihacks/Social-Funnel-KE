"use client";

import { useId, useState } from "react";

type PasswordInputProps = {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Extra classes on the outer relative wrapper (e.g. mt-1) */
  wrapperClassName?: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function PasswordInput({
  name,
  required,
  minLength,
  autoComplete,
  placeholder,
  className = "",
  autoFocus,
  wrapperClassName = "mt-1",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  const inputClass =
    className ||
    "w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-sf-teal/50 focus:outline-none";

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        id={inputId}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${inputClass} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--chart-grid)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-1 focus-visible:ring-sf-teal/50"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={0}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
