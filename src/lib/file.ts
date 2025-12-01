/**
 * File persistence is disabled - files are processed in memory only
 * Data is saved directly to the database without file storage
 * 
 * This function is kept for backwards compatibility but always returns null
 * to prevent any file system operations in serverless environments
 */
export async function persistUpload(_buffer: Buffer, _originalName: string): Promise<null> {
  // File persistence is disabled - no files are saved
  // All data is processed in memory and saved directly to database
  return null;
}



