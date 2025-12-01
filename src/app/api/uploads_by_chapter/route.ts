import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get("chapter");

  if (!chapter) {
    return NextResponse.json({ error: "Chapter parameter is required" }, { status: 400 });
  }

  try {
    const uploads = await prisma.reportUpload.findMany({
      where: {
        chapter: chapter,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        label: true,
        chapter: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        createdAt: true,
        source: true,
      },
    });

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("Error fetching uploads by chapter:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch uploads",
      },
      { status: 500 }
    );
  }
}

