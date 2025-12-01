import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get unique chapters from ReportUpload
    const uploadChapters = await prisma.reportUpload.findMany({
      where: {
        chapter: {
          not: null,
        },
      },
      select: {
        chapter: true,
      },
    });

    // Get unique chapters from Member
    const memberChapters = await prisma.member.findMany({
      where: {
        chapter: {
          not: null,
        },
      },
      select: {
        chapter: true,
      },
    });

    // Combine and deduplicate chapters
    const allChapters = new Set<string>();
    
    uploadChapters.forEach((u) => {
      if (u.chapter) allChapters.add(u.chapter);
    });
    
    memberChapters.forEach((m) => {
      if (m.chapter) allChapters.add(m.chapter);
    });

    // Convert to sorted array
    const chaptersArray = Array.from(allChapters).sort();

    // Ensure "PATRONS" is in the list and set as first option
    if (!chaptersArray.includes("PATRONS")) {
      chaptersArray.unshift("PATRONS");
    } else {
      // Move PATRONS to the front if it exists
      const patronsIndex = chaptersArray.indexOf("PATRONS");
      if (patronsIndex > 0) {
        chaptersArray.splice(patronsIndex, 1);
        chaptersArray.unshift("PATRONS");
      }
    }

    return NextResponse.json({ chapters: chaptersArray });
  } catch (error) {
    console.error("Error fetching chapters:", error);
    // Return PATRONS as fallback
    return NextResponse.json({ chapters: ["PATRONS"] });
  }
}

