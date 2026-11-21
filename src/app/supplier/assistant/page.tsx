import { AgentChat } from "@/components/agent/agent-chat";
import { agentEnabled } from "@/lib/agent/core";
import { SUPPLIER_INTRO, SUPPLIER_SUGGESTIONS } from "@/lib/agent/supplier/prompt";
import { requireRole } from "@/lib/auth/current";
import { cancelSupplierAction, confirmSupplierAction, sendToSupplierAgent } from "./actions";

export const metadata = { title: "עוזר AI" };

export default async function SupplierAssistant() {
  const session = await requireRole("SUPPLIER");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">עוזר AI</h1>
        <p className="text-sm text-muted">
          שאלו על המחירון, על המיקום מול השוק ועל פניות של לקוחות. העוזר יכול להכין עדכון מחיר או תשובה ללקוח, והם
          נשמרים רק אחרי שתאשרו. העוזר לא רואה מחירים של ספקים אחרים ולא פרטי קשר של לקוחות.
        </p>
      </div>
      <AgentChat
        storageKey={`agent:supplier:${session.userId}`}
        intro={SUPPLIER_INTRO}
        suggestions={SUPPLIER_SUGGESTIONS}
        send={sendToSupplierAgent}
        confirm={confirmSupplierAction}
        cancel={cancelSupplierAction}
        enabled={agentEnabled()}
      />
    </div>
  );
}
