import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "./env";

const ensureDir = async (dir: string) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // In serverless environments, directory might already exist
    if (error instanceof Error && !error.message.includes("EEXIST")) {
      throw error;
    }
  }
};

/**
 * Persists uploaded file to storage
 * In production on Vercel, consider using Vercel Blob Storage or S3
 * Local filesystem works but files are ephemeral in serverless environments
 */
export async function persistUpload(buffer: Buffer, originalName: string) {
  const ext = path.extname(originalName);
  const fileName = `${crypto.randomUUID()}${ext}`;
  const storageRoot = env.FILE_STORAGE_ROOT || "./storage/uploads";
  const fullPath = path.join(storageRoot, fileName);
  
  try {
    await ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
    return { fileName, fullPath };
  } catch (error) {
    console.error("Error persisting file:", error);
    // In serverless, we might not have write access - log but don't fail
    // Consider implementing cloud storage adapter for production
    throw new Error(
      `Failed to save file. ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}



