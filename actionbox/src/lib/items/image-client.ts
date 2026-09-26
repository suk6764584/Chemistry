// Screenshots carry small text, so keep enough resolution for the AI to read it.
const MAX_EDGE = 1600;
const MAX_BYTES = 1_300_000;
const ATTEMPTS = [
  { edge: MAX_EDGE, quality: 0.82 },
  { edge: 1280, quality: 0.72 },
  { edge: 960, quality: 0.65 },
];

export async function compressImageFile(file: File): Promise<{ base64: string; mime: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 올릴 수 있습니다.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("이 이미지 형식은 열 수 없습니다. JPG나 PNG로 올려 주세요.");
  }

  try {
    for (const { edge, quality } of ATTEMPTS) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("이미지를 처리할 수 없습니다.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("이미지 압축에 실패했습니다.");
      if (blob.size <= MAX_BYTES) return { base64: await toBase64(blob), mime: "image/jpeg" };
    }
  } finally {
    bitmap.close();
  }
  throw new Error("이미지가 너무 큽니다. 다른 사진을 선택해 주세요.");
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
