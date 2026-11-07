/**
 * בדיקת ספרת ביקורת של מספר זיהוי ישראלי (ח.פ., ע.מ. או ת.ז.): 9 ספרות,
 * משקלים 1,2,1,2... וסכום הספרות של כל מכפלה; הסכום הכולל מתחלק ב-10.
 */
export function isValidIsraeliNumber(value: string): boolean {
  if (!/^\d{5,9}$/.test(value)) return false;
  const digits = value.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const n = Number(digits[i]) * ((i % 2) + 1);
    sum += n > 9 ? n - 9 : n;
  }
  return sum % 10 === 0;
}
