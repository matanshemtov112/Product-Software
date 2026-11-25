"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, FormError, Input, SubmitButton } from "@/components/form";
import { changePassword } from "@/lib/auth/password-actions";
import {
  confirmTotpSetup,
  disableTotp,
  type MfaFormState,
  regenerateRecoveryCodes,
} from "@/lib/auth/two-factor-actions";

const codeInput = (
  <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} dir="ltr" required />
);

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-accent bg-accent-soft p-4" role="status">
      <p className="text-sm font-medium">קודי הגיבוי שלכם (מוצגים רק עכשיו):</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm" dir="ltr">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        שמרו אותם במקום בטוח (מודפסים, או במנהל סיסמאות). כל קוד עובד פעם אחת, אם הטלפון אבד.
      </p>
      <a
        href="/account/security"
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        שמרתי את הקודים
      </a>
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <Field label="הסיסמה הנוכחית">
        <Input name="current" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <Field label="סיסמה חדשה (8 תווים לפחות)">
        <Input name="newPassword" type="password" autoComplete="new-password" dir="ltr" minLength={8} required />
      </Field>
      <Field label="הסיסמה החדשה שוב">
        <Input name="confirm" type="password" autoComplete="new-password" dir="ltr" minLength={8} required />
      </Field>
      <FormError message={state.error} />
      {state.done && (
        <p role="status" className="text-sm text-good">
          הסיסמה שונתה. שאר המכשירים נותקו.
        </p>
      )}
      <SubmitButton pending={pending}>שינוי סיסמה</SubmitButton>
    </ActionForm>
  );
}

export function RegenerateCodesForm() {
  const [state, action, pending] = useActionState<MfaFormState, FormData>(regenerateRecoveryCodes, {});
  if (state.codes) return <RecoveryCodes codes={state.codes} />;
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <Field label="קוד מהאפליקציה">{codeInput}</Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>קודי גיבוי חדשים</SubmitButton>
    </ActionForm>
  );
}

export function DisableForm() {
  const [state, action, pending] = useActionState<MfaFormState, FormData>(disableTotp, {});
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <Field label="הסיסמה">
        <Input name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <Field label="קוד מהאפליקציה">{codeInput}</Field>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>כיבוי האימות הדו-שלבי</SubmitButton>
    </ActionForm>
  );
}

/**
 * כל תוכן כרטיס האימות הדו-שלבי ברכיב אחד שנשאר על המסך גם כשהדף מתרענן אחרי ההפעלה,
 * כדי שקודי הגיבוי (שמוצגים פעם אחת בלבד) לא ייעלמו לפני שהמשתמש שמר אותם.
 */
export function TwoFactorPanel({
  enabledSince,
  recoveryLeft,
  setup,
  isAdmin,
  startAction,
}: {
  enabledSince: string | null;
  recoveryLeft: number;
  setup: { qr: string; secret: string } | null;
  isAdmin: boolean;
  startAction: () => Promise<void>;
}) {
  const [state, action, pending] = useActionState<MfaFormState, FormData>(confirmTotpSetup, {});
  if (state.codes) return <RecoveryCodes codes={state.codes} />;
  if (enabledSince) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          <span className="font-medium text-good">פעיל ✓</span> מאז {enabledSince}. כל כניסה דורשת גם קוד מהאפליקציה.
          נשארו {recoveryLeft} קודי גיבוי.
        </p>
        <details>
          <summary className="cursor-pointer text-sm text-accent">קודי גיבוי חדשים</summary>
          <div className="mt-3">
            <RegenerateCodesForm />
          </div>
        </details>
        {!isAdmin && (
          <details>
            <summary className="cursor-pointer text-sm text-muted">כיבוי האימות הדו-שלבי</summary>
            <div className="mt-3">
              <DisableForm />
            </div>
          </details>
        )}
      </div>
    );
  }
  if (setup) {
    return (
      <div className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm">
          <li>התקינו בטלפון אפליקציית אימות: Google Authenticator או Microsoft Authenticator.</li>
          <li>באפליקציה לחצו על + וסרקו את הקוד.</li>
          <li>הקלידו כאן את 6 הספרות שמופיעות באפליקציה.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr} alt="קוד QR לאפליקציית האימות" width={220} height={220} className="self-center" />
        <p className="text-center text-xs text-muted">
          לא מצליחים לסרוק? הקלידו באפליקציה את הקוד:{" "}
          <span className="font-mono" dir="ltr">
            {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
          </span>
        </p>
        <ActionForm action={action} className="flex flex-col gap-3">
          <Field label="הקוד בן 6 הספרות שמופיע עכשיו באפליקציה">{codeInput}</Field>
          <FormError message={state.error} />
          <SubmitButton pending={pending}>הפעלת אימות דו-שלבי</SubmitButton>
        </ActionForm>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        גם אם מישהו ישיג את הסיסמה שלכם, הוא לא יוכל להיכנס בלי הקוד שמופיע בטלפון שלכם. מומלץ מאוד, במיוחד למנהלים.
      </p>
      <form action={startAction}>
        <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          הפעלת אימות דו-שלבי
        </button>
      </form>
    </div>
  );
}
