import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

const control =
  "rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={control} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={control} />;
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
