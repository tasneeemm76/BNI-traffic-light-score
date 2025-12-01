import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSuggestions } from "@/lib/suggestions";

/**
 * Member Analysis API
 * 
 * This endpoint fetches month-wise performance data for members from uploaded files stored in the database.
 * Each MemberData record represents one month's calculated scores for one member from one upload.
 * 
 * Data flow:
 * 1. Files are uploaded via /api/upload_file
 * 2. Data is parsed, scores are calculated, and stored in MemberData table
 * 3. This endpoint retrieves all MemberData records grouped by member
 * 4. Results are organized month-wise using the upload's period (label or periodMonth)
 */

// Color mapping functions
function colorByAbsolute(score: number, maxScore: number): string {
  if (maxScore <= 0) return "#808080";
  const percent = (score / maxScore) * 100.0;
  if (percent >= 70) return "#008000";
  if (percent >= 50) return "#FFBF00";
  if (percent >= 30) return "#ff0000";
  return "#808080";
}

function colorByTotalScore(totalScore: number): string {
  if (totalScore >= 70) return "#008000";
  if (totalScore >= 50) return "#FFBF00";
  if (totalScore >= 30) return "#ff0000";
  return "#808080";
}

// Helper function to extract raw values from rawMetrics
function extractRawValues(rawMetrics: any, upload: any) {
  // Try to extract from rawMetrics array (ScoreComponent[])
  let P = 0, A = 0, S = 0, M = 0, RGI = 0, RGO = 0, V = 0, T = 0, L = 0;
  
  if (Array.isArray(rawMetrics)) {
    // The rawMetrics contains ScoreComponent[], but we need the original row values
    // We'll reconstruct from stored per-week rates and totalWeeks
    // This is a limitation - we don't store the original P, A, S, M, L values
    // So we'll use what we have
  }
  
  // We can't get exact P, A, S, M, L from stored data, so we'll work with what we have
  // The suggestions will use the per-week rates and scores instead
  return { P, A, S, M, RGI, RGO, V, T, L };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const selectedMember = searchParams.get("member");

    // Get all members with their data points from uploaded files
    // Each MemberData record represents one month's data for one member from one upload
    const allData = await prisma.memberData.findMany({
      where: {
        upload: {
          source: "ADMIN", // Only show data from admin uploads
          status: "PROCESSED", // Only show processed uploads
        },
      },
      include: {
        member: true,
        upload: {
          select: {
            id: true,
            label: true,
            periodStart: true,
            periodEnd: true,
            totalWeeks: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { upload: { periodStart: "asc" } }, // Order by upload period (month)
        { periodMonth: "asc" }, // Then by periodMonth within the upload
        { totalScore: "desc" },
      ],
    });

    if (allData.length === 0) {
      return NextResponse.json({
        error: "No stored score results found. Please upload files first.",
        memberNames: [],
        selectedMember: null,
        members: [],
        suggestions: [],
      });
    }

    console.log(`Member Analysis: Found ${allData.length} data points from ${new Set(allData.map(d => d.upload.id)).size} uploaded files`);

    // Group by member name - each member can have multiple records (one per month/upload)
    const membersMap = new Map<string, any[]>();

    for (const row of allData) {
      const name = row.member.displayName;
      
      // Skip ignored members (you can add is_ignored_member logic here if needed)
      
      const total = row.totalScore || 0;
      const color = colorByTotalScore(total);

      // Extract individual scores from rawMetrics
      const rawMetrics = row.rawMetrics as any;
      let absentScore = 0, referralsScore = 0, tyfcbScore = 0, visitorsScore = 0;
      let testimonialsScore = 0, onTimeScore = 0, trainingScore = 0;

      if (Array.isArray(rawMetrics)) {
        for (const metric of rawMetrics) {
          if (metric.key === "absenteeism") absentScore = metric.score || 0;
          if (metric.key === "referrals") referralsScore = metric.score || 0;
          if (metric.key === "tyfcb") tyfcbScore = metric.score || 0;
          if (metric.key === "visitors") visitorsScore = metric.score || 0;
          if (metric.key === "testimonials") testimonialsScore = metric.score || 0;
          if (metric.key === "arrival") onTimeScore = metric.score || 0;
          if (metric.key === "training") trainingScore = metric.score || 0;
        }
      }

      // Format period label from the upload's label or period dates
      // Use the upload label (e.g., "November 2025") if available, otherwise format from periodMonth
      let periodLabel: string;
      if (row.upload.label) {
        periodLabel = row.upload.label;
      } else {
        const periodDate = row.periodMonth;
        periodLabel = `${periodDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
      }

      if (!membersMap.has(name)) {
        membersMap.set(name, []);
      }

      membersMap.get(name)!.push({
        period: periodLabel,
        date: row.upload.periodEnd.toISOString(), // Use ISO string for consistent serialization
        total: Math.round(total),
        color: color,
        absent: { value: absentScore },
        referrals: { value: referralsScore },
        tyfcb: { value: tyfcbScore },
        visitors: { value: visitorsScore },
        testimonials: { value: testimonialsScore },
        on_time: { value: onTimeScore },
        training: { value: trainingScore },
        report_obj: row.upload,
        member_obj: row.member,
        memberData: row,
      });
    }

    const memberNames = Array.from(membersMap.keys()).sort();
    let finalMembers: any[] = [];
    let suggestions: any[] = [];

    // If a member is selected, show their details and generate suggestions
    if (selectedMember && membersMap.has(selectedMember)) {
      const records = membersMap.get(selectedMember)!;
      // Sort by date (period end date) to show chronological order (oldest to newest)
      records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log(`Member Analysis: Showing ${records.length} month(s) of data for "${selectedMember}":`, 
        records.map(r => r.period).join(", "));
      
      finalMembers = [[selectedMember, records]];

      // Get the latest record (most recent upload period)
      const latest = records[records.length - 1];
      const memberData = latest.memberData;
      const upload = latest.report_obj;

      // Get per-week metrics from stored data (calculated from uploaded files)
      const totalWeeks = upload.totalWeeks || 4;
      const refPerWeek = memberData.referralsPerWeek || 0;
      const visitorsPerWeek = memberData.visitorsPerWeek || 0;
      const testimonialsPerWeek = memberData.testimonialsPerWeek || 0;

      // Extract raw values from rawMetrics if available
      // The rawMetrics JSON contains the original calculated values
      const rawMetrics = memberData.rawMetrics as any;
      let A = 0, L = 0;
      
      // Try to extract from rawMetrics structure
      if (Array.isArray(rawMetrics)) {
        // Look for raw values in the metrics array
        // The rawMetrics might contain the original row data
        // For now, we'll estimate from stored rates
        A = Math.round((memberData.absenteeism || 0) * totalWeeks);
        L = Math.round((1 - (memberData.arrivalOnTime || 0)) * totalWeeks);
      } else if (rawMetrics && typeof rawMetrics === 'object') {
        // Check if raw values are stored directly
        if ('totalWeeks' in rawMetrics) {
          // We can calculate A and L from the rates
          A = Math.round((memberData.absenteeism || 0) * (rawMetrics.totalWeeks || totalWeeks));
          L = Math.round((1 - (memberData.arrivalOnTime || 0)) * (rawMetrics.totalWeeks || totalWeeks));
        } else {
          // Fallback to rate-based estimation
          A = Math.round((memberData.absenteeism || 0) * totalWeeks);
          L = Math.round((1 - (memberData.arrivalOnTime || 0)) * totalWeeks);
        }
      } else {
        // Fallback: estimate from rates
        A = Math.round((memberData.absenteeism || 0) * totalWeeks);
        L = Math.round((1 - (memberData.arrivalOnTime || 0)) * totalWeeks);
      }

      // Generate suggestions with personalized data
      suggestions = generateSuggestions({
        total_score: latest.total,
        referrals_week_score: latest.referrals.value,
        visitors_week_score: latest.visitors.value,
        absenteeism_score: latest.absent.value,
        training_score: latest.training.value,
        testimonials_week_score: latest.testimonials.value,
        tyfcb_score: latest.tyfcb.value,
        arriving_on_time_score: latest.on_time.value,
        A: A,
        CEU: memberData.trainingCount || 0,
        TYFCB: memberData.tyfcb || 0,
        ref_per_week: refPerWeek,
        visitors_per_week: visitorsPerWeek,
        testimonials_per_week: testimonialsPerWeek,
        total_meetings: totalWeeks, // Using totalWeeks as proxy for total meetings
        total_weeks: totalWeeks, // Pass total_weeks for suggestion calculations
      });
    }

    return NextResponse.json({
      members: finalMembers,
      memberNames,
      selectedMember,
      suggestions,
    });
  } catch (error) {
    console.error("Error fetching member analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch member analysis data" },
      { status: 500 }
    );
  }
}

