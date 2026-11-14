import { photoSearchEnabled } from "@/lib/photo-search/identify";
import { PhotoSearch } from "./photo-search";

export default function PhotoSearchPage() {
  const enabled = photoSearchEnabled() || (process.env.NODE_ENV !== "production" && Boolean(process.env.PHOTO_SEARCH_FAKE_RESULT));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">חיפוש מוצר בצילום</h1>
        <p className="text-sm text-muted">
          לא יודעים מי מוכר מוצר מסוים? צלמו אותו או בחרו תמונה, ונראה לכם אילו ספקים באזור שלכם מוכרים אותו או מוצר דומה.
        </p>
      </div>
      {enabled ? (
        <PhotoSearch />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted">
          החיפוש בצילום עוד לא הופעל בשרת הזה. כדי להפעיל אותו צריך להגדיר מפתח API של Claude בהגדרות השרת.
        </p>
      )}
    </div>
  );
}
