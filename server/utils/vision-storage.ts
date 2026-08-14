import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createError } from "nitro/h3";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function readDimensions(data: Buffer, contentType: string) {
  if (contentType === "image/png" && data.subarray(1, 4).toString() === "PNG") {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (contentType === "image/jpeg") {
    let offset = 2;
    while (offset < data.length) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (contentType === "image/webp" && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") {
    return { width: 1, height: 1 };
  }
  throw createError({ statusCode: 400, statusMessage: "The image file is malformed or unsupported" });
}

export async function persistVisionImage(file: { data: Buffer; filename: string; type?: string }) {
  const contentType = file.type?.toLowerCase() || "";
  const maxBytes = Number(process.env.NITRO_VISION_MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
  if (!allowedTypes.has(contentType)) throw createError({ statusCode: 415, statusMessage: "Use a JPEG, PNG, or WebP image" });
  if (!file.data.length || file.data.length > maxBytes) throw createError({ statusCode: 413, statusMessage: "Image exceeds the configured upload limit" });
  const { width, height } = readDimensions(file.data, contentType);
  if (width < 320 || height < 240 || width * height > 40_000_000) throw createError({ statusCode: 400, statusMessage: "Use an image between 320×240 and 40 megapixels" });

  const root = path.resolve(process.env.NITRO_VISION_UPLOAD_DIR || "data/vision-images");
  await mkdir(root, { recursive: true });
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const fileName = `${randomUUID()}.${extension}`;
  const storagePath = path.join(root, fileName);
  await writeFile(storagePath, file.data, { flag: "wx" });
  return { storagePath, contentType, byteSize: file.data.length, width, height, checksum: createHash("sha256").update(file.data).digest("hex"), originalFileName: file.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "scan-image" };
}

export async function deleteVisionImage(storagePath: string) {
  const root = path.resolve(process.env.NITRO_VISION_UPLOAD_DIR || "data/vision-images");
  if (!storagePath.startsWith(`${root}${path.sep}`)) throw new Error("Refusing to delete a path outside vision storage");
  await rm(storagePath, { force: true });
}
