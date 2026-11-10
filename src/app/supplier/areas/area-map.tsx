"use client";

import "leaflet/dist/leaflet.css";
import type { Circle as LeafletCircle, Map as LeafletMap } from "leaflet";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormError, Input, SubmitButton } from "@/components/form";
import { DEFAULT_RADIUS_KM, ISRAEL_CENTER, MAX_RADIUS_KM, MIN_RADIUS_KM, type Circle } from "@/lib/geo";
import { saveDeliveryAreas } from "./actions";

export interface Area extends Circle {
  label: string;
}

interface SearchHit {
  label: string;
  full: string;
  lat: number;
  lng: number;
}

const ACCENT = "#0f766e";
const SELECTED = "#b42318";

/** חיפוש עיר או כתובת בישראל (OpenStreetMap), לדיוק האזור */
async function searchPlaces(q: string): Promise<SearchHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "json", countrycodes: "il", limit: "6", "accept-language": "he" }).toString();
  const res = await fetch(url);
  if (!res.ok) return [];
  const hits = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return hits.map((h) => ({
    label: h.display_name.split(",")[0].trim(),
    full: h.display_name,
    lat: Number(h.lat),
    lng: Number(h.lon),
  }));
}

/**
 * מפת אזורי החלוקה של הספק: כל אזור הוא עיגול סביב נקודה.
 * לחיצה על המפה מוסיפה עיגול; חיפוש עיר מעל המפה מוסיף עיגול סביב העיר. הרדיוס נקבע לכל עיגול בנפרד.
 */
export function AreaMap({ initial, canEdit }: { initial: Area[]; canEdit: boolean }) {
  const [areas, setAreas] = useState<Area[]>(initial);
  const [selected, setSelected] = useState<number | null>(initial.length ? 0 : null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [state, action, pending] = useActionState(saveDeliveryAreas, {});
  const [dirty, setDirty] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const shapes = useRef<LeafletCircle[]>([]);
  // ה-handler של לחיצה על המפה נוצר פעם אחת, ולכן קורא את הערכים העדכניים דרך ref
  const canEditRef = useRef(canEdit);

  const update = (next: Area[], select: number | null = selected) => {
    setAreas(next);
    setSelected(select);
    setDirty(true);
  };

  const add = (area: Area) => {
    setAreas((current) => {
      setSelected(current.length);
      return [...current, area];
    });
    setDirty(true);
  };

  // יצירת המפה פעם אחת (Leaflet עובד רק בדפדפן)
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      leaflet.current = L;
      const m = L.map(box.current, { center: [ISRAEL_CENTER.lat, ISRAEL_CENTER.lng], zoom: 7 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e) => {
        if (!canEditRef.current) return;
        add({ label: "אזור על המפה", lat: e.latlng.lat, lng: e.latlng.lng, radiusKm: DEFAULT_RADIUS_KM });
      });
      map.current = m;
      setAreas((a) => [...a]); // ציור ראשון של העיגולים הקיימים
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ציור העיגולים מחדש בכל שינוי
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    for (const s of shapes.current) s.remove();
    shapes.current = areas.map((a, i) => {
      const color = i === selected ? SELECTED : ACCENT;
      const c = L.circle([a.lat, a.lng], { radius: a.radiusKm * 1000, color, weight: 2, fillOpacity: 0.15 })
        .addTo(m)
        .bindTooltip(`${a.label} · ${a.radiusKm} ק״מ`);
      c.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelected(i);
      });
      return c;
    });
  }, [areas, selected]);

  // כשהעיגולים נטענים בפעם הראשונה, המפה מתמקדת בהם
  const fitted = useRef(false);
  useEffect(() => {
    const L = leaflet.current;
    if (fitted.current || !L || !map.current || shapes.current.length === 0) return;
    fitted.current = true;
    map.current.fitBounds(L.featureGroup(shapes.current).getBounds(), { padding: [20, 20] });
  }, [areas]);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setHits(await searchPlaces(query.trim()));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const choose = (hit: SearchHit) => {
    setHits(null);
    setQuery("");
    map.current?.setView([hit.lat, hit.lng], 11);
    if (canEdit) add({ label: hit.label, lat: hit.lat, lng: hit.lng, radiusKm: DEFAULT_RADIUS_KM });
  };

  const current = selected !== null ? areas[selected] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder="חיפוש עיר או יישוב, למשל: רמת גן"
            aria-label="חיפוש עיר"
          />
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="shrink-0 rounded-md border border-border px-4 text-sm hover:bg-accent-soft"
          >
            {searching ? "מחפש..." : "חיפוש"}
          </button>
        </div>
        {hits && (
          <ul className="absolute top-full z-[1000] mt-1 w-full rounded-md border border-border bg-surface text-sm shadow-lg">
            {hits.length === 0 ? (
              <li className="px-3 py-2 text-muted">לא נמצא. נסו שם אחר.</li>
            ) : (
              hits.map((h) => (
                <li key={`${h.lat},${h.lng}`}>
                  <button
                    type="button"
                    onClick={() => choose(h)}
                    className="block w-full px-3 py-2 text-start hover:bg-accent-soft"
                  >
                    <span className="font-medium">{h.label}</span>
                    <span className="block truncate text-xs text-muted">{h.full}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div ref={box} className="h-[28rem] w-full overflow-hidden rounded-lg border border-border" dir="ltr" />
      <p className="-mt-2 text-xs text-muted">
        {canEdit
          ? "לחיצה על המפה מוסיפה אזור במקום שלחצתם. חיפוש עיר מוסיף אזור סביב העיר. לחיצה על עיגול בוחרת אותו לעריכה."
          : "רק מנהל יכול לשנות את אזורי החלוקה."}
      </p>

      {current && selected !== null && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
              <span className="text-muted">שם האזור</span>
              <Input
                value={current.label}
                maxLength={60}
                disabled={!canEdit}
                onChange={(e) => update(areas.map((a, i) => (i === selected ? { ...a, label: e.target.value } : a)))}
              />
            </label>
            {canEdit && (
              <button
                type="button"
                onClick={() => update(areas.filter((_, i) => i !== selected), null)}
                className="rounded-md px-3 py-2 text-sm text-danger hover:bg-accent-soft"
              >
                מחיקת האזור
              </button>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">רדיוס: {current.radiusKm} ק״מ סביב הנקודה</span>
            <input
              type="range"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              step={1}
              value={current.radiusKm}
              disabled={!canEdit}
              onChange={(e) =>
                update(areas.map((a, i) => (i === selected ? { ...a, radiusKm: Number(e.target.value) } : a)))
              }
              className="accent-accent"
              dir="ltr"
            />
          </label>
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">האזורים שלכם ({areas.length})</span>
        {areas.length === 0 ? (
          <p className="text-muted">עוד לא סימנתם אזורים. עד שתסמנו, ההשוואות משתמשות באזורים הכלליים של החשבון.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {areas.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(i);
                    map.current?.setView([a.lat, a.lng], 10);
                  }}
                  className={`rounded-md border px-3 py-1 ${i === selected ? "border-danger text-danger" : "border-border"}`}
                >
                  {a.label} · {a.radiusKm} ק״מ
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <form action={action} onSubmit={() => setDirty(false)} className="flex items-center gap-4">
          <input type="hidden" name="areas" value={JSON.stringify(areas)} />
          <SubmitButton pending={pending}>שמירת האזורים</SubmitButton>
          {state.saved && !dirty && <span className="text-sm text-accent">נשמר. ההשוואות מתעדכנות לפי האזורים החדשים.</span>}
          {dirty && <span className="text-sm text-muted">יש שינויים שלא נשמרו</span>}
        </form>
      )}
      <FormError message={state.error} />
    </div>
  );
}
