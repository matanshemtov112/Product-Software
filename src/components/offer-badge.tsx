import { OFFER_STAGE_LABEL, OFFER_STAGE_STYLE, type OfferStage } from "@/lib/offer-status";

/** תגית סטטוס של הצעת מחיר */
export function OfferBadge({ stage }: { stage: OfferStage }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${OFFER_STAGE_STYLE[stage]}`}>
      {OFFER_STAGE_LABEL[stage]}
    </span>
  );
}
