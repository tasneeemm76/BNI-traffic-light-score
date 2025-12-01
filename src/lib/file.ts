import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "./env";
import os from "os";

/**
 * Gets the appropriate storage directory based on environment
 * - In Vercel/serverless: uses /tmp (only writable directory)
 * - In local dev: uses configured FILE_STORAGE_ROOT or ./storage/uploads
 */
const getStorageRoot = (): string => {
  // Check if we're in a serverless environment (Vercel)
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
  
  if (isVercel) {
    // Use /tmp in Vercel (only writable directory in serverless)
    return path.join(os.tmpdir(), "bni-uploads");
  }
  
  // Local development - use configured path or default
  return env.FILE_STORAGE_ROOT || "./storage/uploads";
};

const ensureDir = async (dir: string) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // In serverless environments, directory might already exist
    if (error instanceof Error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      // EEXIST means directory already exists, which is fine
      if (errorCode === "EEXIST") {
        return;
      }
      // ENOENT means parent directory doesn't exist, try again with recursive
      if (errorCode === "ENOENT") {
        try {
          await fs.mkdir(dir, { recursive: true });
          return;
        } catch (retryError) {
          // If still fails, throw original error
          throw error;
        }
      }
    }
    throw error;
  }
};

/**
 * Persists uploaded file to storage
 * 
 * In production on Vercel:
 * - Files are stored in /tmp (ephemeral, cleared on function restart)
 * - File paths are stored in DB but files may not persist
 * - Consider using Vercel Blob Storage or S3 for persistent storage
 * 
 * In local development:
 * - Files are stored in configured FILE_STORAGE_ROOT or ./storage/uploads
 */
export async function persistUpload(buffer: Buffer, originalName: string): Promise<{ fileName: string; fullPath: string } | null> {
  const ext = path.extname(originalName);
  const fileName = `${crypto.randomUUID()}${ext}`;
  const storageRoot = getStorageRoot();
  const fullPath = path.join(storageRoot, fileName);
  
  try {
    await ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
    return { fileName, fullPath };
  } catch (error) {
    // In serverless environments, file storage may fail
    // Since data is already processed and stored in DB, file persistence is optional
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    
    console.warn(
      `File storage failed (non-critical): ${errorMessage}. ` +
      `Data is already processed and stored in database. ` +
      `File path will not be saved.`
    );
    
    // Return null to indicate file wasn't persisted, but don't throw
    // The upload can still succeed without file storage
    return null;
  }
}



