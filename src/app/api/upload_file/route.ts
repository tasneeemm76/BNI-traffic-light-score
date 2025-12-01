import { NextResponse } from "next/server";
import { UploadSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseMainReport, parseTrainingReport, type ReportMetadata } from "@/lib/importers";
import { calculateMemberScores, persistScoreRun } from "@/lib/scoring";

export async function POST(request: Request) {
  const formData = await request.formData();
  const mainFile = formData.get("mainReport");
  if (!(mainFile instanceof File)) {
    return NextResponse.json({ error: "mainReport file is required" }, { status: 400 });
  }

  const trainingFile = formData.get("trainingReport");
  const sourceParam = formData.get("source")?.toString();
  const source =
    sourceParam && sourceParam.toUpperCase() === "USER_PREVIEW"
      ? UploadSource.USER_PREVIEW
      : UploadSource.ADMIN;
  
  // Get chapter from formData (user input), will prioritize over metadata
  const chapterFromForm = formData.get("chapter")?.toString();

  try {
    // Read files into memory - no file persistence needed
    // Data is processed and saved directly to database
    const mainBuffer = Buffer.from(await mainFile.arrayBuffer());
    const trainingBuffer =
      trainingFile instanceof File ? Buffer.from(await trainingFile.arrayBuffer()) : null;

    // Parse files and extract data
    const [mainReportResult, trainingReportResult] = await Promise.all([
      parseMainReport(mainBuffer, mainFile.name),
      trainingBuffer && trainingFile instanceof File
        ? parseTrainingReport(trainingBuffer, trainingFile.name)
        : Promise.resolve({ rows: [], metadata: {} as ReportMetadata }),
    ]);

    const { rows: mainRows, metadata } = mainReportResult;
    const { rows: trainingRows, metadata: trainingMetadata } = trainingReportResult;
    
    // Use chapter from formData if provided, otherwise use metadata
    // Prioritize user-selected chapter over metadata
    const finalMetadata = {
      chapter: chapterFromForm || metadata.chapter || trainingMetadata?.chapter,
      fromDate: metadata.fromDate || trainingMetadata?.fromDate,
      toDate: metadata.toDate || trainingMetadata?.toDate,
    };

    if (mainRows.length === 0) {
      // Provide more helpful error message
      const errorDetails = [
        "No valid member rows detected.",
        "Please ensure your file has:",
        "1. A header row with either:",
        "   - 'First Name' and 'Last Name' columns, OR",
        "   - 'Member' or 'Name' column",
        "2. Data rows below the header with member information",
        "3. At least one numeric column (P, A, L, M, S, etc.)"
      ].join("\n");
      
      return NextResponse.json({ 
        error: errorDetails
      }, { status: 400 });
    }

    const scores = calculateMemberScores(mainRows, trainingRows);
    
    if (scores.length === 0) {
      return NextResponse.json({ 
        error: "No scores calculated from the uploaded data. Please check your file format." 
      }, { status: 400 });
    }
    
    // Generate label from end date: "May 2025" from "31-05-25"
    // Use toDate if available, otherwise use periodMonth from first score
    let generatedLabel: string | undefined;
    try {
      let endDate: Date | undefined = finalMetadata.toDate;
      
      console.log("Label generation - finalMetadata.toDate:", finalMetadata.toDate?.toISOString());
      console.log("Label generation - finalMetadata.fromDate:", finalMetadata.fromDate?.toISOString());
      
      // Fallback to periodMonth from first score if toDate is not available
      if (!endDate && scores.length > 0 && scores[0]?.raw?.periodMonth) {
        endDate = new Date(scores[0].raw.periodMonth);
        console.log("Label generation - using fallback periodMonth:", endDate.toISOString());
      }
      
      if (endDate && !isNaN(endDate.getTime())) {
        const monthName = endDate.toLocaleDateString("en-US", { month: "long" });
        const year = endDate.getFullYear();
        generatedLabel = `${monthName} ${year}`;
        console.log(`Generated label: "${generatedLabel}" from date: ${endDate.toISOString()}`);
      } else {
        console.warn("Label generation - no valid endDate found");
      }
    } catch (labelError) {
      console.error("Could not generate label from date:", labelError);
    }

    // Validate dates before passing to persistScoreRun
    const validateDateForPrisma = (date: Date | undefined): Date | undefined => {
      if (!date) return undefined;
      if (isNaN(date.getTime())) {
        console.warn("Invalid date detected, ignoring:", date);
        return undefined;
      }
      const year = date.getFullYear();
      if (year < 1900 || year > 2100) {
        console.warn(`Date year ${year} is out of range, ignoring:`, date);
        return undefined;
      }
      return date;
    };

    const validatedPeriodStart = validateDateForPrisma(finalMetadata.fromDate);
    const validatedPeriodEnd = validateDateForPrisma(finalMetadata.toDate);

    console.log("Upload route - validated dates:", {
      fromDate: validatedPeriodStart?.toISOString(),
      toDate: validatedPeriodEnd?.toISOString(),
      label: generatedLabel,
    });

    try {
      // Save data to database - no file storage needed
      // Files are processed in memory and data is persisted to DB
      const uploadResult = await persistScoreRun({
        prisma,
        scores,
        trainingRows,
        label: generatedLabel,
        // No file paths - files are not persisted, only data is saved
        mainFilePath: undefined,
        trainingFilePath: undefined,
        source,
        chapter: finalMetadata.chapter,
        periodStart: validatedPeriodStart,
        periodEnd: validatedPeriodEnd,
      });

      console.log("Upload successful:", {
        uploadId: uploadResult.id,
        label: uploadResult.label,
        periodStart: uploadResult.periodStart,
        periodEnd: uploadResult.periodEnd,
        scoresCount: scores.length,
      });

      return NextResponse.json({ 
        count: scores.length, 
        scores,
        uploadId: uploadResult.id,
        message: "Data saved successfully"
      });
    } catch (persistError) {
      console.error("Error persisting scores:", persistError);
      return NextResponse.json(
        {
          error: persistError instanceof Error 
            ? `Failed to save data: ${persistError.message}` 
            : "Failed to save data to database. Please try again.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process upload. Check file headers.",
      },
      { status: 400 }
    );
  }
}


