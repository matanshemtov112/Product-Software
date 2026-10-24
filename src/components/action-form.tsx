"use client";

import { type FormEvent, type ReactNode, startTransition } from "react";

/**
 * טופס ששולח ל-action של useActionState בלי לאפס את השדות.
 * (בברירת המחדל React מאפס טופס אחרי שליחה, כך שאחרי שגיאה המשתמש היה צריך למלא הכל מחדש.)
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (form: FormData) => void;
  className?: string;
  children: ReactNode;
}) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => action(form));
  };
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
}
