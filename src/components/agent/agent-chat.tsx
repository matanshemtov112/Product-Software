"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import type { AgentHistory, ConfirmResult, DisplayItem, PendingAction, TurnResult } from "@/lib/agent/types";

/** מה שמוצג בצ'אט: הודעות המשתמש, תשובות העוזר וכרטיסי אישור */
type Entry =
  | { type: "user"; text: string }
  | (DisplayItem & { done?: "ok" | "cancelled" | "failed"; result?: string; resultLink?: ConfirmResult["link"] });

interface Saved {
  history: AgentHistory;
  entries: Entry[];
}

function load(key: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // אחסון מלא או חסום: השיחה תישמר רק עד רענון הדף
  }
}

/**
 * חלון הצ'אט של העוזר, משותף ללקוח ולספק. השיחה נשמרת בלשונית (sessionStorage),
 * והפעולות עצמן תמיד רצות בשרת דרך send / confirm שהצד מעביר.
 */
export function AgentChat({
  storageKey,
  intro,
  suggestions,
  send,
  confirm,
  cancel,
  enabled,
}: {
  storageKey: string;
  intro: string;
  suggestions: string[];
  send: (history: AgentHistory, text: string) => Promise<TurnResult>;
  confirm: (token: string) => Promise<ConfirmResult>;
  cancel: (title: string) => Promise<string>;
  enabled: boolean;
}) {
  const [history, setHistory] = useState<AgentHistory>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = load(storageKey);
    if (saved) {
      setHistory(saved.history);
      setEntries(saved.entries);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (loaded) save(storageKey, { history, entries });
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [history, entries, loaded, storageKey]);

  const ask = (message: string) => {
    const clean = message.trim();
    if (!clean || pending) return;
    setText("");
    setEntries((e) => [...e, { type: "user", text: clean }]);
    startTransition(async () => {
      try {
        const result = await send(history, clean);
        setHistory(result.history);
        setEntries((e) => [...e, ...result.display]);
      } catch {
        setEntries((e) => [...e, { type: "error", text: "העוזר לא זמין כרגע. נסו שוב בעוד כמה דקות." }]);
      }
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
  };

  const decide = (index: number, action: PendingAction, approve: boolean) => {
    startTransition(async () => {
      let note: string;
      let update: Partial<Entry>;
      try {
        if (approve) {
          const r = await confirm(action.token);
          note = r.note;
          update = { done: r.ok ? "ok" : "failed", result: r.summary, resultLink: r.link };
        } else {
          note = await cancel(action.card.title);
          update = { done: "cancelled" };
        }
      } catch {
        note = "[הפעולה לא בוצעה בגלל תקלה]";
        update = { done: "failed", result: "משהו השתבש. נסו שוב." };
      }
      // ההערה נכנסת לשיחה, כדי שהעוזר ידע בתור הבא מה אושר ומה בוטל
      setHistory((h) => [...h, { role: "user", content: note }]);
      setEntries((list) => list.map((en, i) => (i === index ? ({ ...en, ...update } as Entry) : en)));
    });
  };

  const reset = () => {
    setHistory([]);
    setEntries([]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-live="polite"
        className="flex min-h-[320px] flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        data-agent-log
      >
        {entries.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{intro}</p>
            {enabled && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {entries.map((entry, i) => (
          <EntryView key={i} entry={entry} busy={pending} onDecide={(a, ok) => decide(i, a, ok)} />
        ))}
        {pending && <p className="text-sm text-muted">העוזר חושב…</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="agent-input">
          הודעה לעוזר
        </label>
        <textarea
          id="agent-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
          rows={2}
          maxLength={4000}
          disabled={!enabled}
          placeholder={enabled ? "מה תרצו לעשות? למשל: תבנה לי סל ירקות לשבוע" : "העוזר עוד לא מחובר"}
          className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <div className="flex gap-2 sm:flex-col">
          <button
            type="submit"
            disabled={!enabled || pending || !text.trim()}
            className="flex-1 rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            שליחה
          </button>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              שיחה חדשה
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function EntryView({
  entry,
  busy,
  onDecide,
}: {
  entry: Entry;
  busy: boolean;
  onDecide: (action: PendingAction, approve: boolean) => void;
}) {
  if (entry.type === "user") {
    return (
      <p className="max-w-[85%] self-start whitespace-pre-wrap rounded-lg bg-accent-soft px-3 py-2 text-sm">
        {entry.text}
      </p>
    );
  }
  if (entry.type === "text") {
    return <p className="max-w-[95%] self-end whitespace-pre-wrap text-sm leading-6">{entry.text}</p>;
  }
  if (entry.type === "error") {
    return (
      <p role="alert" className="self-end text-sm text-danger">
        {entry.text}
      </p>
    );
  }
  if (entry.type === "tool") {
    return (
      <p className="self-end text-xs text-muted">
        {entry.summary}
        {entry.link && (
          <>
            {" · "}
            <Link href={entry.link.href} className="text-accent underline">
              {entry.link.label}
            </Link>
          </>
        )}
      </p>
    );
  }
  const { card } = entry.action;
  return (
    <div className="flex flex-col gap-2 self-stretch rounded-lg border border-accent bg-background p-3" data-agent-card>
      <p className="font-medium">{card.title}</p>
      <ul className="list-disc ps-5 text-sm">
        {card.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {!entry.done ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(entry.action, true)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${card.danger ? "bg-danger" : "bg-accent"}`}
          >
            {card.confirmLabel ?? "אישור"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(entry.action, false)}
            className="rounded-md border border-border px-4 py-1.5 text-sm"
          >
            ביטול
          </button>
        </div>
      ) : (
        <p className={`text-sm ${entry.done === "ok" ? "text-accent" : entry.done === "failed" ? "text-danger" : "text-muted"}`}>
          {entry.done === "cancelled" ? "בוטל" : entry.result}
          {entry.resultLink && (
            <>
              {" · "}
              <Link href={entry.resultLink.href} className="underline">
                {entry.resultLink.label}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
