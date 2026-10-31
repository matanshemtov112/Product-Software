import { describe, expect, it } from "vitest";
import { checkImage, MAX_IMAGE_BYTES } from "./images";

const file = (bytes: number[], size?: number) => {
  const data = new Uint8Array(size ?? bytes.length);
  data.set(bytes);
  return new File([data], "x", { type: "image/jpeg" });
};

describe("checkImage", () => {
  it("returns null when no file was chosen", async () => {
    expect(await checkImage(null)).toBeNull();
    expect(await checkImage(new File([], "empty"))).toBeNull();
  });

  it("detects the type from the file content", async () => {
    expect(await checkImage(file([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(await checkImage(file([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toMatchObject({ ok: true, contentType: "image/png" });
    const webp = [..."RIFF"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."WEBP"].map((c) => c.charCodeAt(0)));
    expect(await checkImage(file(webp))).toMatchObject({ ok: true, contentType: "image/webp" });
  });

  it("rejects files that are not images even if they claim to be", async () => {
    expect(await checkImage(file([0x3c, 0x73, 0x76, 0x67]))).toMatchObject({ ok: false });
  });

  it("rejects files over the size limit", async () => {
    expect(await checkImage(file([0xff, 0xd8, 0xff], MAX_IMAGE_BYTES + 1))).toMatchObject({ ok: false });
  });
});
