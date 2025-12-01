import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHeatmap } from "@/lib/reporting";

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
  const heatmap = await getHeatmap(prisma, { start, end });
  return NextResponse.json({ heatmap });
}



