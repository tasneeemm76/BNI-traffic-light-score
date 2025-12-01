import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const uploads = await prisma.reportUpload.findMany({
      where: {
        source: "ADMIN",
        status: "PROCESSED",
      },
      orderBy: {
        periodStart: "desc",
      },
      select: {
        id: true,
        label: true,
        chapter: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
        dataPoints: {
          select: {
            id: true,
          },
        },
      },
    });

    const periods = uploads.map((upload) => ({
      id: upload.id,
      label: upload.label,
      chapter: upload.chapter,
      periodStart: upload.periodStart.toISOString(),
      periodEnd: upload.periodEnd.toISOString(),
      createdAt: upload.createdAt.toISOString(),
      memberCount: upload.dataPoints.length,
      periodDisplay: `${upload.periodStart.toLocaleDateString()} – ${upload.periodEnd.toLocaleDateString()}`,
    }));

    return NextResponse.json({ periods });
  } catch (error) {
    console.error("Error fetching upload periods:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload periods" },
      { status: 500 }
    );
  }
}

