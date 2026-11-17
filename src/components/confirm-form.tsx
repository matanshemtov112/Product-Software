"use client";

import type { ReactNode } from "react";

/** טופס עם כפתור אחד ששואל "בטוח?" לפני פעולה שאי אפשר לבטל, כמו מחיקה */
export function ConfirmForm({
  action,
  fields,
  confirm: question,
  className = "text-sm text-danger hover:underline",
  children,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  confirm: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button className={className}>{children}</button>
    </form>
  );
}
