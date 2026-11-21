"use client";

import type { ReactNode } from "react";

/** כפתור שליחה ששואל "בטוח?" לפני פעולה כמו מחיקה או הסרה; בתוך טופס קיים */
export function ConfirmButton({
  confirm: question,
  name,
  value,
  className,
  label,
  children,
}: {
  confirm: string;
  name?: string;
  value?: string;
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      name={name}
      value={value}
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
