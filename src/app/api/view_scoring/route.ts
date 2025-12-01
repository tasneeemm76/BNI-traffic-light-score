import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScoresByDateRange, deleteScoresByDateRange } from "@/lib/reporting";

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = parseDate(searchParams.get("start"));
  const end = parseDate(searchParams.get("end"));
  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params are required" }, { status: 400 });
  }
  const rows = await getScoresByDateRange(prisma, { start, end });
  return NextResponse.json({ rows });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const start = parseDate(body.start ?? null);
  const end = parseDate(body.end ?? null);
  if (!start || !end) {
    return NextResponse.json({ error: "Payload requires { start, end }" }, { status: 400 });
  }
  const result = await deleteScoresByDateRange(prisma, { start, end });
  return NextResponse.json(result);
}



