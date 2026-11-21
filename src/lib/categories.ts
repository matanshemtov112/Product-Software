import { db } from "@/lib/db";

export interface CategoryNode {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

/** תחומים ראשיים ותתי-התחומים שלהם, לפי שם */
export async function categoryTree(): Promise<CategoryNode[]> {
  const all = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, parentId: true } });
  return all
    .filter((c) => !c.parentId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      children: all.filter((x) => x.parentId === c.id).map(({ id, name }) => ({ id, name })),
    }));
}

/**
 * הסוגים שאפשר לשייך אליהם מוצר: תת-תחום, או תחום ראשי שאין לו תתי-תחומים.
 * allowed מגביל לתחומים של ספק (null = הכל).
 */
export function selectableCategories(tree: CategoryNode[], allowed: string[] | null) {
  const ok = (id: string) => allowed === null || allowed.includes(id);
  return tree
    .map((c) => ({
      group: c.name,
      options: c.children.length ? c.children.filter((x) => ok(x.id)) : ok(c.id) ? [{ id: c.id, name: c.name }] : [],
    }))
    .filter((g) => g.options.length > 0);
}

/** בחירת תחום ראשי כוללת את כל תתי-התחומים שלו */
export function expandCategoryIds(tree: CategoryNode[], selected: string[]): string[] {
  const ids = new Set(selected);
  for (const c of tree) if (ids.has(c.id)) for (const child of c.children) ids.add(child.id);
  return [...ids];
}
