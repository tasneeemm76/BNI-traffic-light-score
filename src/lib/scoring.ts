import { PrismaClient, UploadSource, UploadStatus } from "@prisma/client";
import type { MainReportRow, TrainingRow } from "./validators";
import { normalizePersonKey } from "./importers";

// Color mapping functions
const colorByAbsolute = (score: number, maxScore: number): string => {
  if (maxScore <= 0) return "#d3d3d3";
  const percent = (score / maxScore) * 100.0;
  if (percent >= 70) return "#008000"; // Green
  if (percent >= 50) return "#FFBF00"; // Amber
  if (percent >= 30) return "#ff0000"; // Red
  return "#808080"; // Grey
};

const colorByTotalScore = (totalScore: number): string => {
  if (totalScore >= 70) return "#008000"; // Green
  if (totalScore >= 50) return "#FFBF00"; // Amber
  if (totalScore >= 30) return "#ff0000"; // Red
  return "#808080"; // Grey
};

// Scoring functions matching Python logic
const calculateReferralsScore = (refPerWeek: number): number => {
  if (refPerWeek >= 1.2) return 20;
  if (refPerWeek >= 1) return 15;
  if (refPerWeek >= 0.75) return 10;
  if (refPerWeek >= 0.5) return 5;
  return 0;
};

const calculateVisitorsScore = (visitorsPerWeek: number): number => {
  if (visitorsPerWeek >= 0.75) return 20;
  if (visitorsPerWeek >= 0.5) return 15;
  if (visitorsPerWeek >= 0.25) return 10;
  if (visitorsPerWeek >= 0.1) return 5;
  return 0;
};

const calculateAbsenteeismScore = (absentCount: number): number => {
  if (absentCount === 0) return 15;
  if (absentCount === 1) return 10;
  if (absentCount === 2) return 5;
  return 0; // A > 2
};

const calculateTrainingScore = (ceuCount: number): number => {
  if (ceuCount > 2) return 15;
  if (ceuCount === 2) return 10;
  if (ceuCount === 1) return 5;
  return 0; // ceuCount <= 0
};

const calculateTestimonialsScore = (testimonialsPerWeek: number): number => {
  if (testimonialsPerWeek >= 0.075) return 10;
  if (testimonialsPerWeek > 0) return 5;
  return 0;
};

const calculateTYFCBScore = (tyfcb: number): number => {
  if (tyfcb >= 2000000) return 15;
  if (tyfcb >= 1000000) return 10;
  if (tyfcb >= 500000) return 5;
  return 0;
};

const calculateArrivalScore = (lateCount: number): number => {
  return lateCount === 0 ? 5 : 0;
};

export type ScoreComponent = {
  key: string;
  label: string;
  value: number;
  score: number;
  maxScore: number;
  color: string;
};

export type MemberScoreResult = {
  memberName: string;
  chapter?: string;
  normalizedName: string;
  totalScore: number;
  colorBand: string;
  metrics: ScoreComponent[];
  raw: {
    referralsPerWeek: number;
    visitorsPerWeek: number;
    testimonialsPerWeek: number;
    trainingCount: number;
    tyfcb: number;
    absenteeismRate: number;
    arrivalLateRate: number;
    totalWeeks: number;
    periodMonth: Date;
  };
};


const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
};

const buildTrainingMap = (trainingRows: TrainingRow[]) => {
  const map = new Map<string, number>();
  for (const row of trainingRows) {
    const key = normalizePersonKey(row.firstName, row.lastName);
    map.set(key, (map.get(key) ?? 0) + row.credits);
  }
  return map;
};

const normalizeMonth = (date?: Date) => {
  const source = date ?? new Date();
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1));
};

export function calculateMemberScores(mainRows: MainReportRow[], trainingRows: TrainingRow[]) {
  const trainingMap = buildTrainingMap(trainingRows);
  const results: MemberScoreResult[] = [];

  for (const row of mainRows) {
    // Calculate total meetings (P + A + S + M) for total_weeks
    const totalMeetings = row.p + row.a + row.s + row.m;
    const totalWeeks = totalMeetings > 0 ? totalMeetings : 1; // Avoid division by zero
    
    // Raw values
    const rgi = row.rgi ?? 0;
    const rgo = row.rgo ?? 0;
    const v = row.v ?? 0;
    const t = row.t ?? 0;
    const a = row.a ?? 0;
    const l = row.l ?? 0;
    const tyfcb = row.tyfcb ?? 0;
    const ceu = row.ceu ?? 0;
    
    // Per-week metrics
    const totalReferrals = rgi + rgo;
    const referralsPerWeek = totalReferrals / totalWeeks;
    const visitorsPerWeek = v / totalWeeks;
    const testimonialsPerWeek = t / totalWeeks;
    
    const { firstName, lastName } = splitName(row.memberName);
    const normalizedName = normalizePersonKey(firstName, lastName);
    
    // Training override (if provided from training report)
    const trainingCount = trainingMap.get(normalizedName) ?? ceu;
    
    // Calculate scores using new logic
    const refScore = calculateReferralsScore(referralsPerWeek);
    const visitorScore = calculateVisitorsScore(visitorsPerWeek);
    const absenteeismScore = calculateAbsenteeismScore(a);
    const trainingScore = calculateTrainingScore(trainingCount);
    const testimonialScore = calculateTestimonialsScore(testimonialsPerWeek);
    const tyfcbScore = calculateTYFCBScore(tyfcb);
    const arrivalScore = calculateArrivalScore(l);
    
    // Total score
    const totalScore = refScore + visitorScore + absenteeismScore + trainingScore + testimonialScore + tyfcbScore + arrivalScore;
    
    // Build metrics array
    const metrics: ScoreComponent[] = [
      {
        key: "referrals",
        label: "Referrals / Week",
        value: referralsPerWeek,
        score: refScore,
        maxScore: 20,
        color: colorByAbsolute(refScore, 20),
      },
      {
        key: "visitors",
        label: "Visitors / Week",
        value: visitorsPerWeek,
        score: visitorScore,
        maxScore: 20,
        color: colorByAbsolute(visitorScore, 20),
      },
      {
        key: "absenteeism",
        label: "Absenteeism",
        value: a, // Absolute count, not rate
        score: absenteeismScore,
        maxScore: 15,
        color: colorByAbsolute(absenteeismScore, 15),
      },
      {
        key: "training",
        label: "Training Credits",
        value: trainingCount,
        score: trainingScore,
        maxScore: 15,
        color: colorByAbsolute(trainingScore, 15),
      },
      {
        key: "testimonials",
        label: "Testimonials / Week",
        value: testimonialsPerWeek,
        score: testimonialScore,
        maxScore: 10,
        color: colorByAbsolute(testimonialScore, 10),
      },
      {
        key: "tyfcb",
        label: "TYFCB",
        value: tyfcb,
        score: tyfcbScore,
        maxScore: 15,
        color: colorByAbsolute(tyfcbScore, 15),
      },
      {
        key: "arrival",
        label: "Arrival on Time",
        value: l === 0 ? 1 : 0, // 1 if on time, 0 if late
        score: arrivalScore,
        maxScore: 5,
        color: colorByAbsolute(arrivalScore, 5),
      },
    ];

    results.push({
      memberName: row.memberName,
      chapter: row.chapter,
      normalizedName,
      totalScore: Math.round(totalScore),
      colorBand: colorByTotalScore(totalScore),
      metrics,
      raw: {
        referralsPerWeek,
        visitorsPerWeek,
        testimonialsPerWeek,
        trainingCount,
        tyfcb,
        absenteeismRate: a / totalWeeks, // Keep for backward compatibility
        arrivalLateRate: l / totalWeeks, // Keep for backward compatibility
        totalWeeks,
        periodMonth: normalizeMonth(row.period),
      },
    });
  }

  return results;
}

type PersistScoreParams = {
  prisma: PrismaClient;
  scores: MemberScoreResult[];
  trainingRows: TrainingRow[];
  label?: string | null;
  mainFilePath?: string;
  trainingFilePath?: string;
  periodStart?: Date;
  periodEnd?: Date;
  source?: UploadSource;
  totalWeeks?: number;
  chapter?: string;
};

// Validate and normalize a date to ensure it's valid
const validateDate = (date: Date | undefined, fallback: Date): Date => {
  if (!date) return fallback;
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn("Invalid date provided, using fallback:", date);
    return fallback;
  }
  
  // Check if date is in a reasonable range (1900-2100)
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    console.warn(`Date year ${year} is out of reasonable range, using fallback`);
    return fallback;
  }
  
  return date;
};

export async function persistScoreRun(params: PersistScoreParams) {
  const prisma = params.prisma;
  
  // Get fallback date (current date)
  const fallbackDate = new Date();
  
  // Validate periodStart
  let periodStart: Date;
  if (params.periodStart) {
    periodStart = validateDate(params.periodStart, fallbackDate);
  } else if (params.scores[0]?.raw?.periodMonth) {
    periodStart = validateDate(new Date(params.scores[0].raw.periodMonth), fallbackDate);
  } else {
    periodStart = fallbackDate;
  }
  
  // Validate periodEnd
  let periodEnd: Date;
  if (params.periodEnd) {
    periodEnd = validateDate(params.periodEnd, fallbackDate);
  } else {
    // Calculate end of month from periodStart
    const year = periodStart.getUTCFullYear();
    const month = periodStart.getUTCMonth();
    periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
    
    // Validate the calculated date
    if (isNaN(periodEnd.getTime()) || periodEnd.getFullYear() < 1900 || periodEnd.getFullYear() > 2100) {
      console.warn("Calculated periodEnd is invalid, using fallback");
      periodEnd = new Date(Date.UTC(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth() + 1, 0, 23, 59, 59));
    }
  }

  console.log("persistScoreRun - periodStart:", periodStart.toISOString(), "periodEnd:", periodEnd.toISOString());

  if (params.scores.length === 0) {
    throw new Error("No scores to persist");
  }

  return prisma.$transaction(async (tx) => {
    // Check for existing uploads with the SAME period (same month/year)
    // Only replace if the period is exactly the same, not just overlapping
    // This allows multiple different months to coexist
    
    // Normalize dates to month/year for comparison
    const newPeriodYear = periodStart.getUTCFullYear();
    const newPeriodMonth = periodStart.getUTCMonth();
    const newPeriodEndYear = periodEnd.getUTCFullYear();
    const newPeriodEndMonth = periodEnd.getUTCMonth();
    
    // Find uploads where the period start and end fall in the same month/year
    // This means we're looking for uploads that represent the same reporting period
    const existingUploads = await tx.reportUpload.findMany({
      where: {
        source: params.source ?? UploadSource.ADMIN,
        status: {
          in: [UploadStatus.PROCESSED, UploadStatus.PROCESSING],
        },
      },
    });

    // Filter to find uploads with the same period (same month/year for both start and end)
    const samePeriodUploads = existingUploads.filter((upload) => {
      const existingStartYear = upload.periodStart.getUTCFullYear();
      const existingStartMonth = upload.periodStart.getUTCMonth();
      const existingEndYear = upload.periodEnd.getUTCFullYear();
      const existingEndMonth = upload.periodEnd.getUTCMonth();
      
      // Consider it the same period if:
      // 1. Start dates are in the same month/year, AND
      // 2. End dates are in the same month/year
      // This allows for slight day differences but ensures same reporting period
      const sameStartPeriod = existingStartYear === newPeriodYear && existingStartMonth === newPeriodMonth;
      const sameEndPeriod = existingEndYear === newPeriodEndYear && existingEndMonth === newPeriodEndMonth;
      
      return sameStartPeriod && sameEndPeriod;
    });

    console.log(`Found ${samePeriodUploads.length} upload(s) with the same period (${newPeriodYear}-${String(newPeriodMonth + 1).padStart(2, '0')}) out of ${existingUploads.length} total uploads`);

    // If we find existing uploads for the exact same period, delete them and their related data
    if (samePeriodUploads.length > 0) {
      const existingUploadIds = samePeriodUploads.map((u) => u.id);
      
      console.log(`Replacing ${existingUploadIds.length} upload(s) for the same period`);
      
      // Delete related MemberData
      await tx.memberData.deleteMany({
        where: {
          uploadId: { in: existingUploadIds },
        },
      });

      // Delete related TrainingData
      await tx.trainingData.deleteMany({
        where: {
          uploadId: { in: existingUploadIds },
        },
      });

      // Delete the old uploads
      await tx.reportUpload.deleteMany({
        where: {
          id: { in: existingUploadIds },
        },
      });
    } else {
      console.log(`No existing uploads found for this period. Creating new upload.`);
    }

    const upload = await tx.reportUpload.create({
      data: {
        label: params.label,
        chapter: params.chapter,
        periodStart,
        periodEnd,
        totalWeeks: params.totalWeeks ?? Math.max(1, Math.round(params.scores[0]?.raw.totalWeeks ?? 4)),
        status: UploadStatus.PROCESSING,
        source: params.source ?? UploadSource.ADMIN,
        mainFilePath: params.mainFilePath,
        trainingFilePath: params.trainingFilePath,
      },
    });

    // Persist training rows (even if unmatched) for traceability.
    for (const row of params.trainingRows) {
      const normalizedName = normalizePersonKey(row.firstName, row.lastName);
      const member = await tx.member.findFirst({ where: { normalizedName } });
      await tx.trainingData.create({
        data: {
          uploadId: upload.id,
          memberId: member?.id,
          trainingCount: row.credits,
          normalizedName,
          rawRow: row,
        },
      });
    }

    for (const score of params.scores) {
      const member = await tx.member.upsert({
        where: { normalizedName: score.normalizedName },
        update: {
          displayName: score.memberName,
          firstName: splitName(score.memberName).firstName,
          lastName: splitName(score.memberName).lastName,
          chapter: score.chapter,
        },
        create: {
          normalizedName: score.normalizedName,
          displayName: score.memberName,
          firstName: splitName(score.memberName).firstName,
          lastName: splitName(score.memberName).lastName,
          chapter: score.chapter,
        },
      });

      await tx.memberData.upsert({
        where: {
          memberId_uploadId: {
            memberId: member.id,
            uploadId: upload.id,
          },
        },
        update: {
          totalScore: score.totalScore,
          colorBand: score.colorBand,
          referralsPerWeek: score.raw.referralsPerWeek,
          visitorsPerWeek: score.raw.visitorsPerWeek,
          testimonialsPerWeek: score.raw.testimonialsPerWeek,
          trainingCount: score.raw.trainingCount,
          tyfcb: score.raw.tyfcb,
          absenteeism: score.raw.absenteeismRate,
          arrivalOnTime: 1 - score.raw.arrivalLateRate,
          periodMonth: score.raw.periodMonth,
          rawMetrics: score.metrics,
        },
        create: {
          memberId: member.id,
          uploadId: upload.id,
          periodMonth: score.raw.periodMonth,
          totalScore: score.totalScore,
          colorBand: score.colorBand,
          referralsPerWeek: score.raw.referralsPerWeek,
          visitorsPerWeek: score.raw.visitorsPerWeek,
          testimonialsPerWeek: score.raw.testimonialsPerWeek,
          trainingCount: Math.round(score.raw.trainingCount),
          tyfcb: score.raw.tyfcb,
          absenteeism: score.raw.absenteeismRate,
          arrivalOnTime: 1 - score.raw.arrivalLateRate,
          rawMetrics: score.metrics,
        },
      });
    }

    await tx.reportUpload.update({
      where: { id: upload.id },
      data: {
        status: UploadStatus.PROCESSED,
        updatedAt: new Date(),
      },
    });

    return upload;
  });
}

