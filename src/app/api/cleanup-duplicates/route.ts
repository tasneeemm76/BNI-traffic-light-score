import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Find all MemberData entries grouped by member and periodMonth
    const allData = await prisma.memberData.findMany({
      include: {
        member: true,
        upload: true,
      },
      orderBy: [
        { member: { displayName: "asc" } },
        { periodMonth: "asc" },
        { totalScore: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Group by member name and periodMonth
    const grouped = new Map<string, typeof allData>();
    
    for (const row of allData) {
      const key = `${row.member.displayName.trim().toLowerCase()}_${row.periodMonth.toISOString().slice(0, 7)}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }

    // Find duplicates and keep only the best one
    const toDelete: string[] = [];
    
    for (const [key, rows] of grouped.entries()) {
      if (rows.length > 1) {
        // Sort by score (descending) and creation date (descending)
        rows.sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        // Keep the first (best) one, mark others for deletion
        for (let i = 1; i < rows.length; i++) {
          toDelete.push(rows[i].id);
        }
      }
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ message: "No duplicates found", deleted: 0 });
    }

    // Delete duplicate records
    const result = await prisma.memberData.deleteMany({
      where: {
        id: { in: toDelete },
      },
    });

    return NextResponse.json({
      message: `Deleted ${result.count} duplicate records`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("Error cleaning up duplicates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clean up duplicates" },
      { status: 500 }
    );
  }
}

