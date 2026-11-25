"use client";

export function DeleteBasketButton({
  basketId,
  name,
  action,
}: {
  basketId: string;
  name: string;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`למחוק את "${name}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="basketId" value={basketId} />
      <button className="text-danger hover:underline">מחיקה</button>
    </form>
  );
}
