import { AgentChat } from "@/components/agent/agent-chat";
import { agentEnabled, NOT_CONFIGURED } from "@/lib/agent/core";
import { CUSTOMER_SUGGESTIONS } from "@/lib/agent/customer/prompt";
import { requireRole } from "@/lib/auth/current";
import { customerFakeEnabled } from "@/lib/agent/customer/dev-fake";
import { customerAgentCancel, customerAgentConfirm, customerAgentTurn } from "./actions";

export default async function AssistantPage() {
  const session = await requireRole("CUSTOMER");
  const enabled = agentEnabled() || customerFakeEnabled();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">העוזר החכם</h1>
        <p className="text-sm text-muted">
          כתבו מה אתם צריכים, והעוזר ימצא מוצרים, יבנה ויעדכן סלים, יסביר את ההשוואה ויבדוק את הפניות שלכם. כל שינוי
          מחכה לאישור שלכם, ופניות לספקים אתם שולחים בעצמכם.
        </p>
      </div>
      {!enabled && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted">{NOT_CONFIGURED}</p>
      )}
      <AgentChat
        storageKey={`agent:customer:${session.userId}`}
        intro="שלום! אני העוזר של המסעדה. אפשר לבקש ממני לבנות סל, לבדוק איפה חוסכים, או לבדוק מה קורה עם הפניות. הנה כמה רעיונות:"
        suggestions={CUSTOMER_SUGGESTIONS}
        send={customerAgentTurn}
        confirm={customerAgentConfirm}
        cancel={customerAgentCancel}
        enabled={enabled}
      />
    </div>
  );
}
