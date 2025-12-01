import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listScoreResults } from "@/lib/reporting";

export async function GET() {
  const rows = await listScoreResults(prisma);
  return NextResponse.json({ rows });
}



