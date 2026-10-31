import Link from "next/link";
import { Card } from "@/components/form";

const steps = [
  { title: "בונים סל", body: "מזינים את המוצרים והכמויות שהעסק קונה בחודש." },
  { title: "משווים", body: "המערכת מחשבת את המחיר שמגיע לכם לפי היקף הרכש אצל כל ספק, כולל משלוח ומינימום הזמנה." },
  { title: "חוסכים", body: "מקבלים שלוש אפשרויות: הזולה ביותר, ספק יחיד, ושילוב מומלץ, עם הסבר למה." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pt-6">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          בהינתן מה שאתם קונים וכמה, מה הדרך הכי טובה לקנות עכשיו?
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          השוואת סלי רכש בין ספקים לעסקי מזון: מסעדות, בתי קפה, קייטרינג ומאפיות. המחירים מוצגים ללא מע״מ.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/register?kind=customer" className="rounded-md bg-accent px-4 py-2 font-medium text-white">
            הרשמה לעסק
          </Link>
          <Link href="/register?kind=supplier" className="rounded-md border border-border bg-surface px-4 py-2 font-medium">
            הרשמה לספק
          </Link>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.title} title={`${i + 1}. ${s.title}`}>
            <p className="text-sm text-muted">{s.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
