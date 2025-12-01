import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "./env";

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export async function persistUpload(buffer: Buffer, originalName: string) {
  const ext = path.extname(originalName);
  const fileName = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(env.FILE_STORAGE_ROOT, fileName);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, buffer);
  return { fileName, fullPath };
}



