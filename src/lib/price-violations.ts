// דיווחי הפרת מחיר: הספלים לכל שלב וטקסטים. בלי גישה למסד, כדי שיהיה קל לבדוק

/** מספר הדיווחים הפעילים שמעביר ספק לכל שלב: בדיקה, הודעה לספק, ירידה באמינות, השעיה */
export const VIOLATION_THRESHOLDS = [7, 15, 25, 40] as const;

/** כמה זמן דיווח נספר */
export const VIOLATION_WINDOW_DAYS = 90;
/** לקוח מדווח על אותו מוצר אצל אותו ספק רק פעם בתקופה הזו */
export const REPEAT_REPORT_DAYS = 30;

/** בכמה יורדת האמינות בשלב 3, ומה הרצפה */
export const RELIABILITY_PENALTY = 0.3;
export const RELIABILITY_FLOOR = 0.3;

export const STAGE_LABEL = ["תקין", "לבדיקה", "קיבל הודעה", "אמינות הורדה", "מושעה"] as const;

/** השלב (0 עד 4) לפי מספר הדיווחים הפעילים */
export function violationStage(activeReports: number) {
  return VIOLATION_THRESHOLDS.filter((t) => activeReports >= t).length;
}

/** כמה דיווחים חסרים לשלב הבא, או null בשלב האחרון */
export function reportsToNextStage(activeReports: number) {
  const next = VIOLATION_THRESHOLDS.find((t) => activeReports < t);
  return next === undefined ? null : next - activeReports;
}

export const penalized = (reliability: number) =>
  Math.max(RELIABILITY_FLOOR, Math.round((reliability - RELIABILITY_PENALTY) * 100) / 100);

/** תחילת חלון הספירה */
export const windowStart = (now = new Date(), days = VIOLATION_WINDOW_DAYS) =>
  new Date(now.getTime() - days * 86_400_000);

/** ההודעות שהספק מקבל כשהוא עובר שלב (שלב 1 הוא רק סימון אצל המנהל) */
export const STAGE_MESSAGE: Record<2 | 3 | 4, { title: string; body: string }> = {
  2: {
    title: "היי, קיבלנו הרבה הערות לגבי הפרת מחיר. אנא בדקו את עצמכם",
    body:
      "כמה לקוחות דיווחו שהמחיר שנגבה מהם בפועל היה שונה מהמחיר שמופיע אצלכם במערכת. " +
      "בדקו שהמחירים ברשימת המוצרים מעודכנים ותואמים למה שאתם גובים, ועדכנו מחיר שהשתנה. " +
      "בדף הבית שלכם מופיעים המוצרים שדווחו. אם הדיווחים יימשכו, ציון האמינות שלכם ירד, ובהמשך החשבון עלול להיות מושעה.",
  },
  3: {
    title: "ציון האמינות שלכם ירד בגלל דיווחים על הפרת מחיר",
    body:
      "המשכנו לקבל דיווחים מלקוחות שהמחיר שנגבה שונה מהמחיר במערכת, ולכן אתם מופיעים נמוך יותר בהשוואות. " +
      "עדכנו את המחירים ברשימת המוצרים כדי שיתאימו למה שאתם גובים. אם הדיווחים יימשכו, החשבון יושעה.",
  },
  4: {
    title: "החשבון שלכם הושעה בגלל דיווחים רבים על הפרת מחיר",
    body:
      "בזמן ההשעיה לקוחות לא רואים אתכם בהשוואות. צוות הפלטפורמה יבדוק את הדיווחים וייצור איתכם קשר. " +
      "בינתיים כדאי לעדכן את המחירים ברשימת המוצרים.",
  },
};
