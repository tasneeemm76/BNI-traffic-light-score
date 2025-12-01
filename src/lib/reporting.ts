import { PrismaClient } from "@prisma/client";
import { dateRangeSchema, memberQuerySchema } from "./validators";

export async function getScoresByDateRange(prisma: PrismaClient, params: { start: Date; end: Date }) {
  const parsed = dateRangeSchema.parse(params);
  return prisma.memberData.findMany({
    where: {
      periodMonth: {
        gte: parsed.start,
        lte: parsed.end,
      },
    },
    include: {
      member: true,
      upload: true,
    },
    orderBy: [
      { periodMonth: "desc" },
      { totalScore: "desc" },
    ],
  });
}

export async function deleteScoresByDateRange(prisma: PrismaClient, params: { start: Date; end: Date }) {
  const parsed = dateRangeSchema.parse(params);
  return prisma.$transaction(async (tx) => {
    const uploads = await tx.reportUpload.findMany({
      where: {
        periodStart: { gte: parsed.start },
        periodEnd: { lte: parsed.end },
      },
    });

    const uploadIds = uploads.map((upload) => upload.id);
    if (uploadIds.length === 0) return { deleted: 0 };

    await tx.memberData.deleteMany({
      where: { uploadId: { in: uploadIds } },
    });
    await tx.trainingData.deleteMany({
      where: { uploadId: { in: uploadIds } },
    });
    const result = await tx.reportUpload.deleteMany({
      where: { id: { in: uploadIds } },
    });
    return { deleted: result.count };
  });
}

export async function getHeatmap(prisma: PrismaClient, params: { start: Date; end: Date }) {
  const parsed = dateRangeSchema.parse(params);
  const rows = await prisma.memberData.findMany({
    where: {
      periodMonth: {
        gte: parsed.start,
        lte: parsed.end,
      },
    },
    include: { member: true },
    orderBy: [{ member: { displayName: "asc" } }, { periodMonth: "asc" }],
  });

  const matrix: Record<string, Record<string, { score: number; color: string }>> = {};

  for (const row of rows) {
    const name = row.member.displayName;
    const monthKey = row.periodMonth.toISOString().slice(0, 7);
    matrix[name] ??= {};
    matrix[name][monthKey] = { score: row.totalScore, color: row.colorBand };
  }

  return matrix;
}

export async function listScoreResults(prisma: PrismaClient) {
  const rows = await prisma.memberData.findMany({
    include: { member: true, upload: true },
    orderBy: [{ totalScore: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    member: row.member.displayName,
    chapter: row.member.chapter,
    totalScore: row.totalScore,
    colorBand: row.colorBand,
    periodMonth: row.periodMonth,
    source: row.upload.source,
    label: row.upload.label,
  }));
}

export async function getMonthDetail(prisma: PrismaClient, month: Date) {
  const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59));
  return prisma.memberData.findMany({
    where: {
      periodMonth: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    include: {
      member: true,
    },
    orderBy: [{ totalScore: "desc" }],
  });
}

export async function getMemberAnalysis(prisma: PrismaClient, params: { memberId: string; limit?: number }) {
  const parsed = memberQuerySchema.parse(params);
  return prisma.memberData.findMany({
    where: { memberId: parsed.memberId },
    include: { upload: true },
    orderBy: [{ periodMonth: "asc" }],
    take: parsed.limit,
  });
}



