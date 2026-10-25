"use server";

import { requireRole } from "@/lib/auth/current";
import { catalogForBasket } from "@/lib/customer/catalog";
import { customerForUser } from "@/lib/customer/quotes";
import { claudeIdentifier, parseIdentification, type Identification, type PhotoImage } from "@/lib/photo-search/identify";
import { groupMatches, type PhotoMatches } from "@/lib/photo-search/match";
import { offersForProducts } from "@/lib/photo-search/offers";
import { checkImage } from "@/lib/supplier/images";

export interface PhotoSearchState {
  error?: string;
  description?: string;
  matches?: PhotoMatches;
}

/**
 * לבדיקות בלבד: תשובת זיהוי קבועה במקום קריאה ל-Claude, כדי לבדוק את המסך בלי מפתח API.
 * לא פעיל בייצור.
 */
function fakeIdentification(catalogNames: string[]): Identification | null {
  const fake = process.env.PHOTO_SEARCH_FAKE_RESULT;
  if (!fake || process.env.NODE_ENV === "production") return null;
  return parseIdentification(fake, catalogNames);
}

export async function searchByPhoto(_: PhotoSearchState, form: FormData): Promise<PhotoSearchState> {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const image = await checkImage(form.get("photo"));
  if (!image) return { error: "נא לצלם או לבחור תמונה" };
  if (!image.ok) return { error: image.error };

  const catalog = (await catalogForBasket()).map((c) => ({ name: c.name, category: c.category }));
  const result =
    fakeIdentification(catalog.map((c) => c.name)) ??
    (await claudeIdentifier({ data: image.data, mediaType: image.contentType as PhotoImage["mediaType"] }, catalog));

  if (result.kind === "not_configured") return { error: "החיפוש בצילום עוד לא הופעל בשרת הזה." };
  if (result.kind === "refused") return { error: "לא הצלחנו לזהות את התמונה. נסו תמונה אחרת של המוצר." };
  if (result.kind === "error") return { error: result.message };

  const offers = await offersForProducts([...result.exact, ...result.similar], customer.regionId);
  return { description: result.description, matches: groupMatches(result, offers) };
}
