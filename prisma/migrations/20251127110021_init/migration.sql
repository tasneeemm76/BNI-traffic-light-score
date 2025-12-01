-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('ADMIN', 'USER_PREVIEW');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "chapter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportUpload" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalWeeks" INTEGER NOT NULL DEFAULT 4,
    "status" "UploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "source" "UploadSource" NOT NULL DEFAULT 'ADMIN',
    "mainFilePath" TEXT,
    "trainingFilePath" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberData" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "referralsPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visitorsPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "testimonialsPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trainingCount" INTEGER NOT NULL DEFAULT 0,
    "tyfcb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absenteeism" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "arrivalOnTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colorBand" TEXT NOT NULL,
    "rawMetrics" JSONB NOT NULL,

    CONSTRAINT "MemberData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingData" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "uploadId" TEXT NOT NULL,
    "trainingCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedName" TEXT,
    "rawRow" JSONB NOT NULL,

    CONSTRAINT "TrainingData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_normalizedName_key" ON "Member"("normalizedName");

-- CreateIndex
CREATE INDEX "MemberData_periodMonth_idx" ON "MemberData"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MemberData_memberId_uploadId_key" ON "MemberData"("memberId", "uploadId");

-- AddForeignKey
ALTER TABLE "MemberData" ADD CONSTRAINT "MemberData_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberData" ADD CONSTRAINT "MemberData_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "ReportUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingData" ADD CONSTRAINT "TrainingData_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingData" ADD CONSTRAINT "TrainingData_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "ReportUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
