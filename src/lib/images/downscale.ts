/** מקטין תמונה בדפדפן לפני ההעלאה, כדי שתמונה מהטלפון לא תשלח כמה מגה */
export async function downscaleImage(file: File, maxSide = 1200): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("לא הצלחנו לקרוא את הקובץ. נא לבחור תמונה מסוג JPG, PNG או WEBP");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // רקע לבן לתמונות שקופות, כי JPEG לא שומר שקיפות
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("לא הצלחנו לעבד את התמונה");
  return new File([blob], "product.jpg", { type: "image/jpeg" });
}
