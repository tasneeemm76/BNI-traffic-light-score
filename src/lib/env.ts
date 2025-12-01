import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  FILE_STORAGE_ROOT: z.string().default("./storage/uploads"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  FILE_STORAGE_ROOT: process.env.FILE_STORAGE_ROOT,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  console.error("❌ Invalid environment variables", parsed.error.flatten().fieldErrors);
  // In production, fail fast; in development, warn
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid environment configuration");
  }
  console.warn("⚠️  Environment validation failed, using defaults where possible");
}

export const env = parsed.success ? parsed.data : {
  DATABASE_URL: process.env.DATABASE_URL || "",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  FILE_STORAGE_ROOT: process.env.FILE_STORAGE_ROOT || "./storage/uploads",
  NODE_ENV: (process.env.NODE_ENV as "development" | "production" | "test") || "development",
};



